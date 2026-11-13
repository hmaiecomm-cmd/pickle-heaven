"""Per-bus transaction serialisation.

Every RS-485 transaction for one physical bus MUST hold that bus's lock; different buses run in parallel.
`peak` records the highest concurrency seen per bus (used by tests to prove serialisation).
"""
from __future__ import annotations

import threading
from contextlib import contextmanager
from typing import Iterator


class BusManager:
    def __init__(self) -> None:
        self._guard = threading.Lock()
        self._locks: dict[str, threading.Lock] = {}
        self._inside: dict[str, int] = {}
        self.peak: dict[str, int] = {}

    def _lock(self, bus_id: str) -> threading.Lock:
        with self._guard:
            return self._locks.setdefault(bus_id, threading.Lock())

    @contextmanager
    def exclusive(self, bus_id: str, timeout: float | None = None) -> Iterator[None]:
        lock = self._lock(bus_id)
        if not lock.acquire(timeout=-1 if timeout is None else timeout):
            raise TimeoutError(f"bus {bus_id} busy")
        try:
            with self._guard:
                self._inside[bus_id] = self._inside.get(bus_id, 0) + 1
                self.peak[bus_id] = max(self.peak.get(bus_id, 0), self._inside[bus_id])
            yield
        finally:
            with self._guard:
                self._inside[bus_id] -= 1
            lock.release()

    def busy(self, bus_id: str) -> bool:
        return self._lock(bus_id).locked()
