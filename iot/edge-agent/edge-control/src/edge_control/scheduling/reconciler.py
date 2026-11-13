"""Booking store and desired-state reconciliation.

The reconciler produces ordinary commands (source="scheduler") through CommandService, so every automatic
action passes the same policy engine, bus lock, audit log and outbox as an API call.
"""
from __future__ import annotations

import hashlib
import logging
import threading
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from edge_control.commands.policy import PolicyEngine
from edge_control.commands.service import CommandService
from edge_control.config.loader import AppConfig
from edge_control.errors import EdgeError, PolicyError, Unprocessable
from edge_control.scheduling.engine import Booking, Desired, apply_latest_revision, desired_for_circuit
from edge_control.security.permissions import Principal
from edge_control.storage.database import Database
from edge_control.storage.state_repository import StateRepository
from edge_control.util import parse_iso, to_iso, utcnow

log = logging.getLogger("edge.scheduler")
SCHEDULER = Principal(actor="scheduler", role="operator", via="internal")


class BookingStore:
    def __init__(self, db: Database):
        self.db = db

    def upsert_event(self, *, booking_id: str, court: str, start: str, end: str, status: str, revision: int) -> bool:
        """Idempotent: replays and older revisions are ignored.  Returns True if state changed."""
        if court not in ("court_a", "court_b"):
            raise Unprocessable("court must be court_a or court_b", code="invalid_court")
        if status not in ("active", "cancelled"):
            raise Unprocessable("status must be active or cancelled", code="invalid_status")
        s, e = parse_iso(start), parse_iso(end)
        if e <= s:
            raise Unprocessable("end must be after start", code="invalid_interval")
        row = self.db.fetchone("SELECT * FROM bookings WHERE booking_id=:i", i=booking_id)
        existing = None
        if row:
            existing = Booking(row["booking_id"], row["court"], parse_iso(row["start_at"]), parse_iso(row["end_at"]),
                               row["status"], row["revision"])
        keep = apply_latest_revision(existing, Booking(booking_id, court, s, e, status, revision))
        if keep is None:
            return False
        self.db.execute("""INSERT INTO bookings(booking_id,court,start_at,end_at,status,revision,received_at)
            VALUES (:i,:c,:s,:e,:st,:r,:n) ON CONFLICT(booking_id) DO UPDATE SET court=:c,start_at=:s,end_at=:e,
            status=:st,revision=:r,received_at=:n""", i=booking_id, c=court, s=to_iso(s), e=to_iso(e), st=status,
                        r=revision, n=to_iso(utcnow()))
        self.db.kv_set("bookings_last_sync", to_iso(utcnow()))  # type: ignore[arg-type]
        return True

    def mark_synced(self) -> None:
        self.db.kv_set("bookings_last_sync", to_iso(utcnow()))  # type: ignore[arg-type]

    def last_sync(self) -> datetime | None:
        v = self.db.kv_get("bookings_last_sync")
        return parse_iso(v) if v else None

    def all_active(self) -> list[Booking]:
        rows = self.db.fetchall("SELECT * FROM bookings WHERE status='active'")
        return [Booking(r["booking_id"], r["court"], parse_iso(r["start_at"]), parse_iso(r["end_at"]), r["status"], r["revision"])
                for r in rows]


class OverrideStore:
    def __init__(self, db: Database, max_minutes: int):
        self.db, self.max_minutes = db, max_minutes

    def set(self, circuit_id: str, desired: str, minutes: int, actor: str) -> datetime:
        if not 1 <= minutes <= self.max_minutes:
            raise Unprocessable(f"override must be 1..{self.max_minutes} minutes", code="override_too_long")
        exp = utcnow() + timedelta(minutes=minutes)
        self.db.execute("""INSERT INTO circuit_overrides(circuit_id,desired,expires_at,actor,created_at)
            VALUES (:c,:d,:e,:a,:n) ON CONFLICT(circuit_id) DO UPDATE SET desired=:d,expires_at=:e,actor=:a,created_at=:n""",
                        c=circuit_id, d=desired, e=to_iso(exp), a=actor, n=to_iso(utcnow()))
        return exp

    def get(self, circuit_id: str) -> tuple[str, datetime] | None:
        r = self.db.fetchone("SELECT desired, expires_at FROM circuit_overrides WHERE circuit_id=:c", c=circuit_id)
        if not r:
            return None
        exp = parse_iso(r["expires_at"])
        return (r["desired"], exp) if exp > utcnow() else None

    def clear(self, circuit_id: str) -> None:
        self.db.execute("DELETE FROM circuit_overrides WHERE circuit_id=:c", c=circuit_id)


class Reconciler:
    def __init__(self, cfg: AppConfig, policy: PolicyEngine, commands: CommandService, bookings: BookingStore,
                 overrides: OverrideStore, states: StateRepository):
        self.cfg, self.policy, self.commands = cfg, policy, commands
        self.bookings, self.overrides, self.states = bookings, overrides, states
        self.tz = ZoneInfo(cfg.site.timezone)
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self.last_run: dict[str, Desired] = {}

    def desired_all(self, now: datetime | None = None) -> dict[str, Desired]:
        now = now or utcnow()
        bks = self.bookings.all_active()
        sync = self.bookings.last_sync()
        return {c.circuit_id: desired_for_circuit(c, now, self.tz, bks, self.cfg.policies,
                                                  override=self.overrides.get(c.circuit_id), last_cloud_sync=sync)
                for c in self.cfg.circuits}

    def run_once(self, now: datetime | None = None) -> list[str]:
        now = now or utcnow()
        issued: list[str] = []
        self.last_run = self.desired_all(now)
        for cid, d in self.last_run.items():
            if d.state is None:
                continue
            want_on = d.state == "on"
            if self.policy.operability(cid, want_on)[0] is not None:
                continue  # unbound/bypass/etc.: nothing to reconcile
            st = self.states.get(cid)
            current = (st or {}).get("requested_state") or {}
            if st and current.get("on") == want_on and st["verification"] != "unknown":
                continue
            bucket = int(now.timestamp() // max(1, self.cfg.policies.reconcile_interval_seconds))
            command_id = "sched-" + hashlib.sha1(f"{cid}:{d.state}:{bucket}".encode()).hexdigest()[:20]
            try:
                self.commands.submit_relay(SCHEDULER, cid, command_id=command_id, on=want_on, expires_at=None, source="scheduler")
                issued.append(command_id)
            except (PolicyError, EdgeError) as e:
                log.info("scheduler skipped %s: %s", cid, getattr(e, "code", e))
        return issued

    def _loop(self) -> None:
        while not self._stop.wait(self.cfg.policies.reconcile_interval_seconds):
            try:
                self.run_once()
            except Exception:  # noqa: BLE001
                log.exception("reconcile failed")

    def start(self) -> None:
        self._thread = threading.Thread(target=self._loop, name="reconciler", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(3)
