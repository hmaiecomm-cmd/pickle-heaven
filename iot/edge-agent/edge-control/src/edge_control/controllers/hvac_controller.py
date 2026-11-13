"""HVAC settings via the communication bus (never emulated by cutting power)."""
from __future__ import annotations

from edge_control.controllers.outcome import Outcome, outcome_from_exception
from edge_control.devices.registry import DeviceRegistry
from edge_control.errors import Unprocessable, Unsupported
from edge_control.storage.command_repository import CommandRepository


def validate_settings(caps: dict, p: dict) -> None:
    if caps.get("status") == "not_configured":
        return  # driver will report not_configured at execution
    if p.get("power") is not None and not caps.get("power"):
        raise Unsupported("power control not supported", code="unsupported_feature")
    sp = p.get("setpoint_c")
    if sp is not None:
        rng = caps.get("setpoint")
        if not rng:
            raise Unsupported("setpoint not supported", code="unsupported_feature")
        if not rng["min"] <= sp <= rng["max"]:
            raise Unprocessable(f"setpoint must be {rng['min']}..{rng['max']} °C", code="setpoint_out_of_range")
        step = rng.get("step") or 1
        if abs((sp - rng["min"]) / step - round((sp - rng["min"]) / step)) > 1e-6:
            raise Unprocessable(f"setpoint must be a multiple of {step}", code="setpoint_bad_step")
    if p.get("mode") is not None and p["mode"] not in caps.get("modes", []):
        raise Unsupported(f"mode {p['mode']!r} not supported", code="unsupported_feature",
                          details={"supported_modes": caps.get("modes", [])})
    if p.get("fan") is not None and not caps.get("fan"):
        raise Unsupported("fan speed not supported by this unit", code="unsupported_feature")
    if p.get("fan") is not None and p["fan"] not in caps["fan"]:
        raise Unsupported(f"fan {p['fan']!r} not supported", code="unsupported_feature")


class HvacController:
    def __init__(self, registry: DeviceRegistry, commands: CommandRepository):
        self.registry, self.commands = registry, commands

    def apply(self, cmd: dict) -> Outcome:
        p = cmd["payload"]
        sent = False
        try:
            _dev, drv = self.registry.hvac(cmd["target_id"])
            self.commands.mark_sent(cmd["command_id"])
            sent = True
            st = drv.apply_settings(power=p.get("power"), setpoint_c=p.get("setpoint_c"),
                                    mode=p.get("mode"), fan=p.get("fan"))
            return Outcome("succeeded", reported_state=st.as_dict(), verification="unverified",
                           state_update={"mode": drv.mode})
        except Exception as e:  # noqa: BLE001
            return outcome_from_exception(e, sent=sent)
