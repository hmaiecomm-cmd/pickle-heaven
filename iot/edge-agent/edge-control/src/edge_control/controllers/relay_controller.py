"""Relay circuit control rules: policy re-check, target resolution, driver call."""
from __future__ import annotations

from edge_control.commands.policy import PolicyEngine
from edge_control.controllers.outcome import Outcome, outcome_from_exception
from edge_control.devices.registry import DeviceRegistry
from edge_control.drivers.base.relay_driver import OutputTarget
from edge_control.errors import PolicyError
from edge_control.storage.command_repository import CommandRepository


class RelayController:
    def __init__(self, policy: PolicyEngine, registry: DeviceRegistry, commands: CommandRepository):
        self.policy, self.registry, self.commands = policy, registry, commands

    def _target(self, circuit_id: str, desired_on: bool | None, source: str, expect_revision: int | None):
        res = self.policy.resolve_for_write(circuit_id, True if desired_on is None else desired_on, source) \
            if desired_on is not None else self.policy.resolve(circuit_id)
        if expect_revision is not None and res.revision != expect_revision:
            raise PolicyError("mapping changed after the command was accepted", code="mapping_changed",
                              details={"accepted_revision": expect_revision, "current_revision": res.revision})
        return res, OutputTarget(circuit_id, res.controller, res.binding, res.bus)

    def set_state(self, cmd: dict) -> Outcome:
        on = bool(cmd["payload"]["on"])
        sent = False
        try:
            res, target = self._target(cmd["target_id"], on, cmd["source"], cmd.get("mapping_revision"))
            driver = self.registry.relay_driver(res.controller)
            self.commands.mark_sent(cmd["command_id"])
            sent = True
            r = driver.write_output(target, on)
            reported = {"on": r.reported_on if r.reported_on is not None else None, **r.detail}
            verification = r.verification
            # Never claim confirmation unless the binding has a real feedback path and the driver says so.
            if driver.mode == "mock" or res.binding.feedback_type == "none":
                verification = "unverified"
            return Outcome("succeeded", reported_state=reported, verification=verification,
                           state_update={"mode": driver.mode})
        except Exception as e:  # noqa: BLE001
            return outcome_from_exception(e, sent=sent)

    def read_state(self, circuit_id: str) -> dict:
        """Explicit side-effect-free read (driver must support a safe read)."""
        res, target = self._target(circuit_id, None, "read", None)
        driver = self.registry.relay_driver(res.controller)
        r = driver.read_output(target)
        return {"on": r.reported_on, "verification": r.verification, "driver_mode": driver.mode, **r.detail}
