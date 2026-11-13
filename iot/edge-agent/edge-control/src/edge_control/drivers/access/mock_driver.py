"""Simulated door-lock controller."""
from __future__ import annotations

import threading

from edge_control.drivers.base.access_driver import AccessDriver, AccessState, UnlockResult
from edge_control.drivers.base.faults import MockFaults


class MockAccessDriver(AccessDriver):
    mode = "mock"

    def __init__(self, faults: MockFaults | None = None, door_contact_supported: bool = True):
        self.faults = faults or MockFaults()
        self.door_contact_supported = door_contact_supported
        self.unlock_count = 0
        self._contact: dict[str, str] = {}
        self._lock = threading.Lock()

    def unlock(self, door_id: str) -> UnlockResult:
        self.faults.hit(f"unlock:{door_id}")
        with self._lock:
            self.unlock_count += 1
            contact = "unknown"
        return UnlockResult(accepted=True, door_contact=contact, verification="unverified",
                            detail={"simulated": True, "note": "mock accept is not a physical unlock"})

    def read_state(self, door_id: str) -> AccessState:
        self.faults.hit(f"read:{door_id}")
        contact = self._contact.get(door_id, "unknown") if self.door_contact_supported else "not_supported"
        return AccessState(lock_output="unknown", door_contact=contact, detail={"simulated": True})
