"""soyal_721_727 adapter: door relay of an AR-721H/727H class access controller (NOT a power-distribution DO)."""
from __future__ import annotations

from typing import Callable

from edge_control.config.schema import BusDef, DeviceConfig
from edge_control.drivers.access.soyal_frame import (
    ECHO_ACK, ECHO_NACK, RELAY_DOOR_TIMED, FrameError, parse_frame, relay_control_frame,
)
from edge_control.drivers.base.access_driver import AccessDriver, AccessState, UnlockResult
from edge_control.drivers.transports.serial_link import ByteLink, SerialByteLink
from edge_control.errors import DeviceError, DeviceTimeout, NotConfigured


class SoyalAccessDriver(AccessDriver):
    mode = "real"

    def __init__(self, device: DeviceConfig, bus: BusDef | None,
                 link_factory: Callable[[BusDef], ByteLink] | None = None):
        self.device, self.bus = device, bus
        self._factory = link_factory or SerialByteLink
        self._link: ByteLink | None = None

    def unlock(self, door_id: str) -> UnlockResult:
        if self.bus is None or self.bus.protocol_profile != "soyal_binary":
            raise NotConfigured("access bus not configured for soyal_binary", code="bus_not_configured")
        try:
            frame = relay_control_frame(self.device.node_id, RELAY_DOOR_TIMED)  # pulse length is set on the controller
        except FrameError as e:
            raise NotConfigured(str(e), code="node_not_configured") from e
        if self._link is None:
            self._link = self._factory(self.bus)
        raw = self._link.transact(frame, expect_min=6, timeout_s=self.bus.timeout_s or 1.0)  # no retry, ever
        try:
            reply = parse_frame(raw)
        except FrameError as e:
            raise DeviceTimeout(f"unparseable reply: {e}", sent=True) from e
        if reply.cmd == ECHO_ACK:
            return UnlockResult(accepted=True, door_contact="unknown", verification="unverified",
                                detail={"note": "controller ACK only; door contact not read"})
        if reply.cmd == ECHO_NACK:
            raise DeviceError("controller NACK", code="device_nack")
        raise DeviceError(f"unexpected echo code 0x{reply.cmd:02X}", code="device_error")

    def read_state(self, door_id: str) -> AccessState:
        # 0x18 polling has side effects on networking/stand-alone mode: deliberately not used for state reads.
        return AccessState(lock_output="unknown", door_contact="unknown",
                           detail={"note": "state read not enabled for soyal_721_727 (polling has side effects)"})
