"""In-process SDK lifecycle (runs inside the isolated worker process)."""
from __future__ import annotations

import threading

from edge_control.drivers.nvr.hikvision.binding import SdkBinding


class SdkRuntime:
    """Reference-counted init/cleanup: the native library is initialised once per process."""

    def __init__(self, binding: SdkBinding):
        self.binding = binding
        self._refs = 0
        self._lock = threading.Lock()

    def acquire(self) -> None:
        with self._lock:
            if self._refs == 0:
                self.binding.init()
            self._refs += 1

    def release(self) -> None:
        with self._lock:
            if self._refs == 0:
                return
            self._refs -= 1
            if self._refs == 0:
                self.binding.cleanup()

    @property
    def active(self) -> bool:
        return self._refs > 0
