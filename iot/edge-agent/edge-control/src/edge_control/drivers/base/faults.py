"""Fault injection shared by mock drivers (tests and demos).  Real drivers never import this."""
from __future__ import annotations

import threading
import time

from edge_control.errors import DeviceError, DeviceTimeout


class MockFaults:
    """mode: None | "offline" (nothing sent) | "timeout" (sent, no reply) | "error" (device error)"""

    def __init__(self) -> None:
        self.mode: str | None = None
        self.delay_s: float = 0.0
        self._lock = threading.Lock()
        self.calls: list[tuple[str, float]] = []

    def set(self, mode: str | None, delay_s: float = 0.0) -> None:
        self.mode, self.delay_s = mode, delay_s

    def hit(self, label: str) -> None:
        with self._lock:
            self.calls.append((label, time.monotonic()))
        if self.delay_s:
            time.sleep(self.delay_s)
        if self.mode == "offline":
            raise DeviceError("mock device offline", code="device_offline")
        if self.mode == "timeout":
            raise DeviceTimeout("mock timeout after send", sent=True)
        if self.mode == "error":
            raise DeviceError("mock device execution failure", code="device_execution_failed")
