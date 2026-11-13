"""modbus_m7000 relay adapter (M-7000 DIO, mapping-table V1.18 pp.70-71).

Only the DO value coils 00001..00016 are ever written; safe/power-on values, protocol bits, module address,
baud/parity and 00257 are never touched.  Function codes must be operator-confirmed for the physical model.
"""
from __future__ import annotations

from typing import Callable

from edge_control.config.schema import BusDef
from edge_control.drivers.base.relay_driver import OutputResult, OutputTarget, RelayDriver
from edge_control.drivers.relay.modbus_address import is_m7000_do_value, parse_reference
from edge_control.drivers.transports.serial_link import ModbusTransport, PymodbusRtuTransport
from edge_control.errors import NotConfigured, Unsupported


class ModbusM7000RelayDriver(RelayDriver):
    mode = "real"

    def __init__(self, transport_factory: Callable[[BusDef], ModbusTransport] | None = None):
        self._factory = transport_factory or PymodbusRtuTransport
        self._cache: dict[str, ModbusTransport] = {}

    def _prepare(self, t: OutputTarget, write: bool):
        c, b = t.controller, t.binding
        if c.protocol != "modbus_m7000":
            raise Unsupported("controller protocol is not modbus_m7000", code="protocol_mismatch")
        if not c.model_confirmed:
            raise NotConfigured("controller model/firmware not confirmed; M-7000 profile may not apply",
                                code="model_unconfirmed")
        if t.bus is None or t.bus.protocol_profile != "modbus_rtu":
            raise NotConfigured("bus is not configured for modbus_rtu", code="bus_not_configured")
        if c.node_id is None or not 1 <= c.node_id <= 247:
            raise NotConfigured("modbus slave id not configured (1..247)", code="node_not_configured")
        m = b.modbus
        if m is None or m.table_type is None or m.reference_address is None:
            raise NotConfigured("modbus address not configured", code="address_not_configured")
        addr = parse_reference(m.reference_address, m.table_type, m.base)
        if not is_m7000_do_value(addr):
            raise Unsupported(f"{m.reference_address} is not an M-7000 DO value coil (00001-00016)", code="address_forbidden")
        if c.do_count is not None and addr.number > c.do_count:
            raise Unsupported("address beyond confirmed DO count", code="address_forbidden")
        fn = m.write_function if write else m.read_function
        if fn is None or fn not in c.modbus_functions:
            raise NotConfigured(f"function code {fn} not confirmed for this controller", code="function_unconfirmed")
        return addr

    def _t(self, bus: BusDef) -> ModbusTransport:
        if bus.bus_id not in self._cache:
            self._cache[bus.bus_id] = self._factory(bus)
        return self._cache[bus.bus_id]

    def write_output(self, target: OutputTarget, on: bool) -> OutputResult:
        addr = self._prepare(target, write=True)
        level = on if target.binding.active_polarity != "low" else (not on)
        self._t(target.bus).write_coil(target.controller.node_id, addr.offset, level)  # type: ignore[arg-type]
        return OutputResult(reported_on=None, verification="unverified",
                            detail={"note": "write acknowledged; load energisation not confirmed"})

    def read_output(self, target: OutputTarget) -> OutputResult:
        addr = self._prepare(target, write=False)
        bits = self._t(target.bus).read_coils(target.controller.node_id, addr.offset, 1)  # type: ignore[arg-type]
        raw = bool(bits[0])
        val = raw if target.binding.active_polarity != "low" else (not raw)
        return OutputResult(reported_on=val, verification="unverified" if target.binding.feedback_type == "none" else "confirmed",
                            detail={"source": "do_coil_readback"})
