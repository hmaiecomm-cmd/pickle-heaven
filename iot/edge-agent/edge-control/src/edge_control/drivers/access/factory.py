from __future__ import annotations

from edge_control.config.schema import BusDef, DeviceConfig
from edge_control.drivers.access.mock_driver import MockAccessDriver
from edge_control.drivers.access.vendor_driver import SoyalAccessDriver
from edge_control.drivers.base.access_driver import AccessDriver, AccessState, UnlockResult
from edge_control.errors import NotConfigured


class NotConfiguredAccessDriver(AccessDriver):
    mode = "real"

    def __init__(self, reason: str):
        self.reason = reason

    def unlock(self, door_id: str) -> UnlockResult:
        raise NotConfigured(self.reason, code="driver_not_configured")

    def read_state(self, door_id: str) -> AccessState:
        raise NotConfigured(self.reason, code="driver_not_configured")


def create_access_driver(dev: DeviceConfig, bus: BusDef | None) -> AccessDriver:
    if dev.driver == "mock":
        return MockAccessDriver(door_contact_supported=bool(dev.mock.get("door_contact", True)))
    if dev.driver_profile == "soyal_721_727":
        return SoyalAccessDriver(dev, bus)
    return NotConfiguredAccessDriver("door-lock controller model/protocol not provided (see docs/integration-gaps.md)")
