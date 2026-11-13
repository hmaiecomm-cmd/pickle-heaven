"""Periodic heartbeat to the cloud (proposed contract)."""
from __future__ import annotations

import logging
import threading
from typing import Callable

from edge_control.cloud.client import CloudClient
from edge_control.errors import EdgeError
from edge_control.util import to_iso, utcnow

log = logging.getLogger("edge.cloud")


class Heartbeat:
    def __init__(self, client: CloudClient, site_id: str, edge_id: str, snapshot: Callable[[], dict]):
        self.client, self.site_id, self.edge_id, self.snapshot = client, site_id, edge_id, snapshot
        self.last_success: str | None = None
        self.last_error: str | None = None
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def beat(self) -> bool:
        if not self.client.enabled:
            return False
        try:
            self.client.send_heartbeat(self.site_id, self.edge_id, {"sent_at": to_iso(utcnow()), **self.snapshot()})
            self.last_success, self.last_error = to_iso(utcnow()), None
            return True
        except EdgeError as e:
            self.last_error = e.code
            return False

    def start(self, interval: float = 30.0) -> None:
        def loop() -> None:
            while not self._stop.wait(interval):
                try:
                    self.beat()
                except Exception:  # noqa: BLE001
                    log.exception("heartbeat failed")
        self._thread = threading.Thread(target=loop, name="heartbeat", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
