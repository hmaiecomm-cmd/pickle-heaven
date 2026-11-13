"""Policy engine: the single gate every circuit write passes (API, scheduler, restart recovery, batch).

Nothing may bypass it: bypass/always-on circuits, reserved circuits, critical power and unbound mappings
all produce stable error codes here, never a fake success.
"""
from __future__ import annotations

from dataclasses import dataclass

from edge_control.config.loader import AppConfig
from edge_control.config.schema import BusDef, CircuitBinding, CircuitConfig, ControllerDef
from edge_control.errors import NotFound, PolicyError
from edge_control.mapping.service import DeploymentService


@dataclass
class Resolved:
    circuit: CircuitConfig
    binding: CircuitBinding
    controller: ControllerDef
    bus: BusDef | None
    revision: int


class PolicyEngine:
    def __init__(self, cfg: AppConfig, deployment: DeploymentService, runtime_mode: str):
        self.cfg, self.deployment, self.runtime_mode = cfg, deployment, runtime_mode

    def operability(self, circuit_id: str, desired_on: bool | None = None) -> tuple[str | None, str | None]:
        """(code, message) of the first reason a write is refused, or (None, None) if writable."""
        c = self.cfg.circuit(circuit_id)
        if c is None:
            return "circuit_not_found", "unknown circuit"
        rev, dep = self.deployment.active()
        b = next((x for x in dep.circuits if x.circuit_id == circuit_id), None)
        if c.control_mode == "reserved" or not c.enabled or c.wiring_mode == "reserved" or (b and b.wiring_mode == "reserved"):
            return "circuit_reserved", "reserved circuit: disabled with no output binding"
        if c.control_mode == "always_on_bypass" or c.wiring_mode == "hardware_bypass" or (b and b.wiring_mode == "hardware_bypass"):
            return "circuit_always_on_protected", "24h supply / bypass circuit: software never switches it"
        if desired_on is False and (c.critical_power or (b and getattr(b, "critical_power", False))):
            return "critical_power_protected", "critical power circuit cannot be switched off"
        if b is None or b.controller_id is None or b.physical_output_channel is None or b.mapping_status == "unbound":
            return "circuit_unbound", "no controller/channel bound for this circuit"
        if b.mapping_status != "active":
            return "mapping_not_active", f"mapping status is {b.mapping_status}; apply a validated mapping first"
        ctrl = next((x for x in dep.controllers if x.controller_id == b.controller_id), None)
        if ctrl is None:
            return "controller_missing", "bound controller not defined"
        if ctrl.simulation_only and self.runtime_mode != "mock":
            return "simulation_mapping_in_real_mode", "simulation-only mapping cannot drive real outputs"
        return None, None

    def resolve_for_write(self, circuit_id: str, desired_on: bool, source: str = "api") -> Resolved:
        if self.cfg.circuit(circuit_id) is None:
            raise NotFound("circuit not found", code="circuit_not_found")
        code, msg = self.operability(circuit_id, desired_on)
        if code:
            raise PolicyError(msg, code=code, details={"circuit_id": circuit_id, "source": source})
        return self.resolve(circuit_id)

    def resolve(self, circuit_id: str) -> Resolved:
        rev, dep = self.deployment.active()
        c = self.cfg.circuit(circuit_id)
        b = next(x for x in dep.circuits if x.circuit_id == circuit_id)
        ctrl = next(x for x in dep.controllers if x.controller_id == b.controller_id)
        bus = next((x for x in dep.buses if x.bus_id == ctrl.bus_id), None)
        return Resolved(c, b, ctrl, bus, rev)  # type: ignore[arg-type]

    def describe(self, circuit_id: str) -> dict:
        c = self.cfg.circuit(circuit_id)
        code, msg = self.operability(circuit_id, desired_on=True)
        return {"operable": code is None, "inoperable_code": code, "inoperable_reason": msg,
                "control_policy": {"mode": c.control_mode, "follows": c.follows, "critical_power": c.critical_power,
                                   "policy_note": c.policy_note}}
