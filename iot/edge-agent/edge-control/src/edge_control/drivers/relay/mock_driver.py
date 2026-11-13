"""Simulated relay controller.  Results are SIMULATED: verification is never "confirmed"."""
from __future__ import annotations

import threading

from edge_control.drivers.base.faults import MockFaults
from edge_control.drivers.base.relay_driver import OutputResult, OutputTarget, RelayDriver


class MockRelayDriver(RelayDriver):
    mode = "mock"

    def __init__(self, faults: MockFaults | None = None):
        self.faults = faults or MockFaults()
        self._state: dict[tuple[str, int], bool] = {}
        self._lock = threading.Lock()
        self.writes: list[tuple[str, int, bool]] = []

    def _key(self, t: OutputTarget) -> tuple[str, int]:
        return (t.controller.controller_id, int(t.binding.physical_output_channel or 0))

    def write_output(self, target: OutputTarget, on: bool) -> OutputResult:
        self.faults.hit(f"write:{target.circuit_id}")
        with self._lock:
            self._state[self._key(target)] = on
            self.writes.append((*self._key(target), on))
        return OutputResult(reported_on=on, verification="unverified",
                            detail={"simulated": True, "note": "mock readback is not hardware confirmation"})

    def read_output(self, target: OutputTarget) -> OutputResult:
        self.faults.hit(f"read:{target.circuit_id}")
        with self._lock:
            val = self._state.get(self._key(target))
        return OutputResult(reported_on=val, verification="unverified", detail={"simulated": True})
