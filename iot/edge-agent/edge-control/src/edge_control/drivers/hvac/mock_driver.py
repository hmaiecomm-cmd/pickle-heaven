"""Simulated air conditioner."""
from __future__ import annotations

import threading
from typing import Any

from edge_control.drivers.base.faults import MockFaults
from edge_control.drivers.base.hvac_driver import HvacDriver, HvacState
from edge_control.errors import Unsupported


class MockHvacDriver(HvacDriver):
    mode = "mock"

    def __init__(self, options: dict[str, Any] | None = None, faults: MockFaults | None = None):
        opts = options or {}
        self.faults = faults or MockFaults()
        self._caps = {
            "power": True,
            "setpoint": {"min": opts.get("min_c", 16), "max": opts.get("max_c", 30), "step": opts.get("step", 1)},
            "modes": opts.get("modes", ["cool", "heat", "fan", "dry"]),
            "fan": opts.get("fan", []),  # empty => fan speed unsupported
        }
        self._state = HvacState(power=False, setpoint_c=26, mode="cool", fan=None, room_temp_c=27.5)
        self._lock = threading.Lock()

    def capabilities(self) -> dict[str, Any]:
        return self._caps

    def read_state(self) -> HvacState:
        self.faults.hit("hvac.read")
        with self._lock:
            return HvacState(**{**self._state.__dict__})

    def apply_settings(self, *, power, setpoint_c, mode, fan) -> HvacState:
        if fan is not None and not self._caps["fan"]:
            raise Unsupported("fan speed is not supported by this air conditioner", code="unsupported_feature")
        if mode is not None and mode not in self._caps["modes"]:
            raise Unsupported(f"mode {mode!r} not supported", code="unsupported_feature")
        self.faults.hit("hvac.apply")
        with self._lock:
            if power is not None:
                self._state.power = power
            if setpoint_c is not None:
                self._state.setpoint_c = setpoint_c
            if mode is not None:
                self._state.mode = mode
            return HvacState(**{**self._state.__dict__})
