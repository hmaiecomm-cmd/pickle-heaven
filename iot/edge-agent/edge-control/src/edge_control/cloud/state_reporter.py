"""Queues device-state snapshot events (delivered through the same outbox)."""
from __future__ import annotations

from edge_control.storage.event_outbox import EventOutbox
from edge_control.storage.state_repository import StateRepository


class StateReporter:
    def __init__(self, states: StateRepository, outbox: EventOutbox):
        self.states, self.outbox = states, outbox

    def snapshot_event(self) -> str:
        items = [{"entity_id": s["entity_id"], "kind": s["entity_kind"], "requested": s["requested_state"],
                  "reported": s["reported_state"], "verification": s["verification"], "driver_mode": s["driver_mode"],
                  "updated_at": s["updated_at"]} for s in self.states.list()]
        return self.outbox.add("device.state_snapshot", {"states": items})
