from __future__ import annotations

from edge_control.config.schema import ControllerDef
from edge_control.drivers.base.relay_driver import OutputResult, OutputTarget, RelayDriver
from edge_control.drivers.relay.mock_driver import MockRelayDriver
from edge_control.drivers.relay.modbus_driver import ModbusM7000RelayDriver
from edge_control.errors import NotConfigured, Unsupported


class UnsupportedRelayDriver(RelayDriver):
    mode = "real"

    def __init__(self, reason: str, code: str):
        self.reason, self.code = reason, code

    def write_output(self, target: OutputTarget, on: bool) -> OutputResult:
        raise Unsupported(self.reason, code=self.code)

    def read_output(self, target: OutputTarget) -> OutputResult:
        raise Unsupported(self.reason, code=self.code)


def create_relay_driver(ctrl: ControllerDef, use_mock: bool, shared: dict[str, RelayDriver]) -> RelayDriver:
    """One driver instance per profile (so transports/mock state are reused)."""
    if use_mock or ctrl.simulation_only:
        return shared.setdefault("mock", MockRelayDriver())
    if ctrl.protocol == "modbus_m7000":
        return shared.setdefault("modbus_m7000", ModbusM7000RelayDriver())
    if ctrl.protocol == "soyal_721_727":
        return UnsupportedRelayDriver(
            "SOYAL AR-721/727 relays are access-controller outputs, not an 18-circuit power controller",
            "soyal_not_power_controller")
    return UnsupportedRelayDriver("controller protocol unspecified: model/protocol must be confirmed on site",
                                  "driver_not_configured")
