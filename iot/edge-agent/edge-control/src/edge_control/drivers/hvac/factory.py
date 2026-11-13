from __future__ import annotations

from edge_control.config.schema import DeviceConfig
from edge_control.drivers.base.hvac_driver import HvacDriver
from edge_control.drivers.hvac.mock_driver import MockHvacDriver
from edge_control.drivers.hvac.modbus_driver import ModbusHvacDriver
from edge_control.drivers.hvac.vendor_driver import NotConfiguredHvacDriver


def create_hvac_driver(dev: DeviceConfig) -> HvacDriver:
    if dev.driver == "mock":
        return MockHvacDriver(dev.mock)
    if dev.driver_profile == "modbus":
        return ModbusHvacDriver()
    return NotConfiguredHvacDriver(f"no real HVAC driver implemented for profile {dev.driver_profile!r} "
                                   "(see docs/integration-gaps.md)")
