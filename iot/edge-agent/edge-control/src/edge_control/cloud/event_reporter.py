"""Outbox -> cloud delivery with exponential backoff.  Events stay queued until the receiver acknowledges them."""
from __future__ import annotations

import logging
import threading

from edge_control.cloud.client import CloudClient
from edge_control.errors import EdgeError
from edge_control.storage.event_outbox import EventOutbox
from edge_control.util import to_iso, utcnow

log = logging.getLogger("edge.cloud")


class EventReporter:
    def __init__(self, outbox: EventOutbox, client: CloudClient, site_id: str, edge_id: str):
        self.outbox, self.client, self.site_id, self.edge_id = outbox, client, site_id, edge_id
        self.last_success: str | None = None
        self.last_error: str | None = None
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def flush_once(self, batch: int = 50) -> int:
        if not self.client.enabled:
            return 0
        due = self.outbox.due(batch)
        if not due:
            return 0
        events = [{"event_id": e["event_id"], "kind": e["kind"], "created_at": e["created_at"], "payload": e["payload"]} for e in due]
        try:
            acked = set(self.client.send_events(self.site_id, self.edge_id, events))
        except EdgeError as e:
            for ev in due:
                self.outbox.fail(ev["event_id"], e.code)
            self.last_error = e.code
            return 0
        self.outbox.ack([i for i in acked])
        for ev in due:
            if ev["event_id"] not in acked:
                self.outbox.fail(ev["event_id"], "not_acked")
        self.outbox.delete_acked()
        self.last_success, self.last_error = to_iso(utcnow()), None
        return len(acked)

    def start(self, interval: float = 5.0) -> None:
        def loop() -> None:
            while not self._stop.wait(interval):
                try:
                    self.flush_once()
                    self.outbox.purge()
                except Exception:  # noqa: BLE001
                    log.exception("event flush failed")
        self._thread = threading.Thread(target=loop, name="event-reporter", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
