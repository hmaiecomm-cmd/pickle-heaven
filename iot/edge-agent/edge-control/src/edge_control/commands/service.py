"""Command intake (validate -> policy -> durable insert) and the executor/worker that drains the queue."""
from __future__ import annotations

import collections
import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from typing import Any, Callable

from edge_control.commands.policy import PolicyEngine
from edge_control.config.loader import AppConfig
from edge_control.controllers.access_controller import AccessController
from edge_control.controllers.hvac_controller import HvacController, validate_settings
from edge_control.controllers.outcome import Outcome
from edge_control.controllers.relay_controller import RelayController
from edge_control.devices.registry import DeviceRegistry
from edge_control.drivers.transports.bus import BusManager
from edge_control.errors import EdgeError, NotFound, PolicyError, Unprocessable
from edge_control.mapping.service import DeploymentService
from edge_control.security.audit_log import AuditLog
from edge_control.security.permissions import Principal, require_device
from edge_control.storage.command_repository import CommandRepository
from edge_control.storage.event_outbox import EventOutbox
from edge_control.storage.state_repository import StateRepository
from edge_control.util import parse_iso, to_iso, utcnow

log = logging.getLogger("edge.commands")


class RateLimited(EdgeError):
    status_code = 429
    code = "rate_limited"


class CommandService:
    def __init__(self, *, cfg: AppConfig, repo: CommandRepository, policy: PolicyEngine, registry: DeviceRegistry,
                 deployment: DeploymentService, audit: AuditLog, runtime_mode: str,
                 wake: Callable[[], None] | None = None):
        self.cfg, self.repo, self.policy, self.registry = cfg, repo, policy, registry
        self.deployment, self.audit, self.runtime_mode = deployment, audit, runtime_mode
        self.wake = wake or (lambda: None)
        self._rate: dict[str, collections.deque] = collections.defaultdict(collections.deque)
        self._rate_lock = threading.Lock()

    # ------------------------------------------------------------ helpers
    def _expiry(self, value: datetime | str | None) -> str:
        pol = self.cfg.policies
        now = utcnow()
        if value is None:
            exp = now + timedelta(seconds=pol.command_default_ttl_seconds)
        else:
            exp = parse_iso(value) if isinstance(value, str) else value
        if exp > now + timedelta(seconds=pol.command_max_ttl_seconds):
            raise Unprocessable(f"expires_at is more than {pol.command_max_ttl_seconds}s in the future",
                                code="expires_too_far")
        return to_iso(exp)  # type: ignore[return-value]

    def _rate_check(self, key: str) -> None:
        limit = self.cfg.policies.per_device_rate_limit_per_minute
        now = time.monotonic()
        with self._rate_lock:
            q = self._rate[key]
            while q and now - q[0] > 60:
                q.popleft()
            if len(q) >= limit:
                raise RateLimited(f"more than {limit} commands/minute for {key}", code="rate_limited")
            q.append(now)

    def _accept(self, p: Principal, *, command_id: str, type_: str, target: str, bus_id: str | None, payload: dict,
                expires_at: str, requested: dict, idempotent: bool, mapping_revision: int | None,
                driver_mode: str, source: str = "api") -> tuple[dict, bool]:
        existing = self.repo.get(command_id)
        if existing is None:
            self._rate_check(target)
        cmd, created = self.repo.create(command_id=command_id, type_=type_, target_id=target, bus_id=bus_id,
                                        payload=payload, expires_at=expires_at, actor=p.actor, source=source,
                                        requested_state=requested, idempotent=idempotent,
                                        mapping_revision=mapping_revision, driver_mode=driver_mode)
        if created:
            self.audit.write(actor=p.actor, role=p.role, action=f"command.{type_}", target=target,
                             command_id=command_id, result="accepted", detail={"payload": payload, "source": source})
            self.wake()
        return cmd, created

    # ------------------------------------------------------------ typed intake
    def submit_relay(self, p: Principal, circuit_id: str, *, command_id: str, on: bool,
                     expires_at: datetime | str | None, source: str = "api") -> tuple[dict, bool]:
        existing = self.repo.get(command_id)
        if existing is None:  # re-posting an identical command must return it even if policy changed since
            try:
                res = self.policy.resolve_for_write(circuit_id, on, source)
            except PolicyError as e:
                self.audit.write(actor=p.actor, role=p.role, action="command.relay.set_state", target=circuit_id,
                                 command_id=command_id, result="refused", detail={"code": e.code})
                raise
            require_device(p, res.controller.controller_id, "operator")
            bus_id, rev = (res.bus.bus_id if res.bus else res.controller.bus_id), res.revision
            drv_mode = self.registry.relay_driver(res.controller).mode
        else:
            bus_id, rev, drv_mode = existing["bus_id"], existing["mapping_revision"], existing["driver_mode"]
        return self._accept(p, command_id=command_id, type_="relay.set_state", target=circuit_id, bus_id=bus_id,
                            payload={"on": on}, expires_at=self._expiry(expires_at), requested={"on": on},
                            idempotent=True, mapping_revision=rev, driver_mode=drv_mode or "unknown", source=source)

    def submit_hvac(self, p: Principal, device_id: str, *, command_id: str, settings: dict[str, Any],
                    expires_at: datetime | str | None) -> tuple[dict, bool]:
        dev, drv = self.registry.hvac(device_id)
        require_device(p, device_id, dev.min_role)
        settings = {k: v for k, v in settings.items() if v is not None}
        if not settings:
            raise Unprocessable("at least one setting is required", code="empty_settings")
        validate_settings(drv.capabilities(), settings)
        return self._accept(p, command_id=command_id, type_="hvac.settings", target=device_id, bus_id=dev.bus_id,
                            payload=settings, expires_at=self._expiry(expires_at), requested=settings,
                            idempotent=True, mapping_revision=self.deployment.revision, driver_mode=drv.mode)

    def submit_unlock(self, p: Principal, door_id: str, *, command_id: str,
                      expires_at: datetime | str | None) -> tuple[dict, bool]:
        dev, drv = self.registry.access_for_door(door_id)
        require_device(p, dev.device_id, dev.min_role)
        return self._accept(p, command_id=command_id, type_="access.unlock", target=door_id, bus_id=dev.bus_id,
                            payload={"unlock": True}, expires_at=self._expiry(expires_at), requested={"unlock": True},
                            idempotent=False, mapping_revision=self.deployment.revision, driver_mode=drv.mode)

    def get(self, command_id: str) -> dict:
        c = self.repo.get(command_id)
        if c is None:
            raise NotFound("command not found", code="command_not_found")
        return c


class CommandExecutor:
    """Runs ONE claimed command: expiry check -> bus lock -> controller -> persist result/state/event."""

    def __init__(self, *, repo: CommandRepository, states: StateRepository, outbox: EventOutbox, audit: AuditLog,
                 buses: BusManager, relay: RelayController, hvac: HvacController, access: AccessController):
        self.repo, self.states, self.outbox, self.audit, self.buses = repo, states, outbox, audit, buses
        self.relay, self.hvac, self.access = relay, hvac, access

    def execute(self, cmd: dict) -> Outcome:
        if parse_iso(cmd["expires_at"]) <= utcnow():  # re-check immediately before touching hardware
            out = Outcome("failed", error_code="command_expired", error_message="expired before execution")
            self.repo.finish(cmd["command_id"], "expired", verification="unverified",
                             error_code="command_expired", error_message=out.error_message)
            self._after(cmd, "expired", out)
            return out
        fn = {"relay.set_state": self.relay.set_state, "hvac.settings": self.hvac.apply,
              "access.unlock": self.access.unlock}.get(cmd["type"])
        if fn is None:
            out = Outcome("failed", error_code="unknown_command_type", error_message=cmd["type"])
        else:
            bus = cmd.get("bus_id")
            try:
                if bus:
                    with self.buses.exclusive(bus):
                        out = fn(cmd)
                else:
                    out = fn(cmd)
            except Exception as e:  # noqa: BLE001
                log.exception("executor crashed for %s", cmd["command_id"])
                out = Outcome("unknown" if cmd.get("sent_to_device") else "failed", verification="unknown",
                              error_code="internal_error", error_message=type(e).__name__)
        self.repo.finish(cmd["command_id"], out.status, reported_state=out.reported_state,
                         verification=out.verification, error_code=out.error_code, error_message=out.error_message)
        self._after(cmd, out.status, out)
        return out

    def _after(self, cmd: dict, status: str, out: Outcome) -> None:
        mode = out.state_update.get("mode") or cmd.get("driver_mode")
        kind = {"relay.set_state": "circuit", "hvac.settings": "hvac", "access.unlock": "door"}.get(cmd["type"], "other")
        if status == "succeeded":
            self.states.upsert(cmd["target_id"], kind, requested=cmd["requested_state"], reported=out.reported_state,
                               verification=out.verification, source=cmd["source"], driver_mode=mode)
        elif status == "unknown":
            self.states.upsert(cmd["target_id"], kind, requested=cmd["requested_state"], reported=None,
                               verification="unknown", source=cmd["source"], driver_mode=mode)
        self.audit.write(actor=cmd["actor"], role=None, action=f"command.{cmd['type']}.finished", target=cmd["target_id"],
                         command_id=cmd["command_id"], result=status,
                         detail={"error_code": out.error_code, "verification": out.verification, "driver_mode": mode})
        self.outbox.add("command.result", {"command_id": cmd["command_id"], "type": cmd["type"], "target_id": cmd["target_id"],
                                           "status": status, "verification": out.verification,
                                           "error_code": out.error_code, "driver_mode": mode,
                                           "finished_at": to_iso(utcnow())})


class CommandWorker:
    """Single-process dispatcher: claims commands from SQLite and runs them on a small thread pool.
    One command at a time per bus is guaranteed both here (dispatch skip) and by the bus lock."""

    def __init__(self, repo: CommandRepository, executor: CommandExecutor, threads: int = 4):
        self.repo, self.executor = repo, executor
        self._pool = ThreadPoolExecutor(max_workers=max(2, threads), thread_name_prefix="cmd")
        self._inflight_buses: set[str] = set()
        self._lock = threading.Lock()
        self._wake = threading.Event()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._futures: set = set()

    def wake(self) -> None:
        self._wake.set()

    def _dispatch_one(self) -> bool:
        with self._lock:
            skip = set(self._inflight_buses)
        cmd = self.repo.claim_next(skip)
        if cmd is None:
            return False
        bus = cmd.get("bus_id")
        if bus:
            with self._lock:
                self._inflight_buses.add(bus)

        def run() -> None:
            try:
                self.executor.execute(cmd)
            except Exception:  # noqa: BLE001
                log.exception("command %s crashed", cmd["command_id"])
            finally:
                if bus:
                    with self._lock:
                        self._inflight_buses.discard(bus)
                self._wake.set()

        fut = self._pool.submit(run)
        self._futures.add(fut)
        fut.add_done_callback(self._futures.discard)
        return True

    def run_pending(self, timeout: float = 15.0) -> None:
        """Synchronously drain the queue (tests / CLI)."""
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            progressed = self._dispatch_one()
            if not progressed:
                if not self._futures and self.repo.active_count() == 0:
                    return
                time.sleep(0.01)

    def _loop(self) -> None:
        while not self._stop.is_set():
            if not self._dispatch_one():
                self._wake.wait(0.5)
                self._wake.clear()

    def start(self) -> None:
        self._thread = threading.Thread(target=self._loop, name="command-worker", daemon=True)
        self._thread.start()

    def stop(self, timeout: float = 10.0) -> None:
        self._stop.set()
        self._wake.set()
        if self._thread:
            self._thread.join(timeout)
        self._pool.shutdown(wait=True, cancel_futures=False)
