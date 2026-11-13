"""Blocking transports.  Instances are only ever used while holding the bus lock, from a worker thread
(never from the FastAPI event loop).  Real hardware paths here are NOT exercised by the automated tests."""
from __future__ import annotations

from typing import Protocol

from edge_control.config.schema import BusDef
from edge_control.errors import DeviceError, DeviceTimeout, NotConfigured


def _require_serial(bus: BusDef) -> None:
    missing = [k for k in ("serial_path", "baudrate", "parity", "data_bits", "stop_bits") if getattr(bus, k) in (None, "")]
    if missing:
        raise NotConfigured(f"bus {bus.bus_id} is missing serial settings: {', '.join(missing)}", code="bus_not_configured")


class ByteLink(Protocol):
    def transact(self, frame: bytes, expect_min: int, timeout_s: float) -> bytes: ...
    def close(self) -> None: ...


class SerialByteLink:
    """pyserial link used for the SOYAL binary protocol (write one frame, read the reply)."""

    def __init__(self, bus: BusDef):
        _require_serial(bus)
        self.bus = bus
        self._ser = None

    def _open(self):
        if self._ser is None:
            import serial  # pyserial
            self._ser = serial.Serial(
                port=self.bus.serial_path, baudrate=self.bus.baudrate, bytesize=self.bus.data_bits,
                parity=self.bus.parity, stopbits=self.bus.stop_bits, timeout=self.bus.timeout_s or 1.0)
        return self._ser

    def transact(self, frame: bytes, expect_min: int, timeout_s: float) -> bytes:
        try:
            ser = self._open()
            ser.reset_input_buffer()
            ser.write(frame)
            ser.flush()
        except Exception as e:  # noqa: BLE001
            self.close()
            raise DeviceError(f"serial open/write failed: {type(e).__name__}", code="serial_error") from e
        # bytes have left the host from here on
        ser.timeout = timeout_s
        head = ser.read(2)
        if len(head) < 2:
            raise DeviceTimeout("no response from device", sent=True)
        rest = ser.read(head[1])
        return head + rest

    def close(self) -> None:
        if self._ser is not None:
            try:
                self._ser.close()
            finally:
                self._ser = None


class ModbusTransport(Protocol):
    def write_coil(self, unit: int, offset: int, value: bool) -> None: ...
    def read_coils(self, unit: int, offset: int, count: int) -> list[bool]: ...


class PymodbusRtuTransport:
    """pymodbus 3.16.x sync serial client (API verified: device_id keyword, FramerType.RTU default)."""

    def __init__(self, bus: BusDef):
        _require_serial(bus)
        self.bus = bus
        self._client = None

    def _c(self):
        if self._client is None:
            from pymodbus.client import ModbusSerialClient
            self._client = ModbusSerialClient(
                self.bus.serial_path, baudrate=self.bus.baudrate, bytesize=self.bus.data_bits,
                parity=self.bus.parity, stopbits=int(self.bus.stop_bits), timeout=self.bus.timeout_s or 1.0, retries=0)
            if not self._client.connect():
                self._client = None
                raise DeviceError("cannot open serial port", code="serial_error")
        return self._client

    def _check(self, resp, op: str):
        from pymodbus.exceptions import ModbusException
        if resp is None or isinstance(resp, ModbusException):
            raise DeviceTimeout(f"{op}: no valid response", sent=True)
        if resp.isError():
            # an ExceptionResponse means the device answered with an error; anything else is treated as no reply
            if resp.__class__.__name__ == "ExceptionResponse":
                raise DeviceError(f"{op}: device exception code {getattr(resp, 'exception_code', '?')}", code="device_exception")
            raise DeviceTimeout(f"{op}: invalid/no response", sent=True)
        return resp

    def write_coil(self, unit: int, offset: int, value: bool) -> None:
        try:
            resp = self._c().write_coil(offset, value, device_id=unit)
        except DeviceError:
            raise
        except Exception as e:  # noqa: BLE001
            self.close()
            raise DeviceTimeout(f"write_coil failed: {type(e).__name__}", sent=True) from e
        self._check(resp, "write_coil")

    def read_coils(self, unit: int, offset: int, count: int) -> list[bool]:
        try:
            resp = self._c().read_coils(offset, count=count, device_id=unit)
        except DeviceError:
            raise
        except Exception as e:  # noqa: BLE001
            self.close()
            raise DeviceTimeout(f"read_coils failed: {type(e).__name__}", sent=True) from e
        return list(self._check(resp, "read_coils").bits[:count])

    def close(self) -> None:
        if self._client is not None:
            try:
                self._client.close()
            finally:
                self._client = None
