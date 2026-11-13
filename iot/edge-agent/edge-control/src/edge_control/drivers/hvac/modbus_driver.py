"""Generic Modbus HVAC adapter slot.  No register map exists yet, so this refuses to guess one."""
from __future__ import annotations

from edge_control.drivers.hvac.vendor_driver import NotConfiguredHvacDriver


class ModbusHvacDriver(NotConfiguredHvacDriver):
    def __init__(self) -> None:
        super().__init__("Modbus HVAC register map not provided; no addresses are assumed "
                         "(see docs/integration-gaps.md)")
