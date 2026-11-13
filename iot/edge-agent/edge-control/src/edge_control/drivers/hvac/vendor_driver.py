"""Real HVAC driver placeholder: the air-conditioner model and RS-485 protocol are not yet provided."""
from __future__ import annotations

from edge_control.drivers.base.hvac_driver import HvacDriver, HvacState
from edge_control.errors import NotConfigured


class NotConfiguredHvacDriver(HvacDriver):
    mode = "real"

    def __init__(self, reason: str = "HVAC model and RS-485 protocol not provided (see docs/integration-gaps.md)"):
        self.reason = reason

    def capabilities(self):
        return {"power": False, "setpoint": None, "modes": [], "fan": [], "status": "not_configured"}

    def read_state(self) -> HvacState:
        raise NotConfigured(self.reason, code="driver_not_configured")

    def apply_settings(self, **_kwargs):
        raise NotConfigured(self.reason, code="driver_not_configured")
