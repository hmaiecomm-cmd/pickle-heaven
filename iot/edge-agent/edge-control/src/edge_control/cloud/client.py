"""Cloud client abstraction.  The official 顧好雲 API contract has NOT been provided: the HTTP client below
implements the PROPOSED contract (contracts/examples/cloud-proposed.md) and is disabled unless EDGE_CLOUD_URL is set."""
from __future__ import annotations

from abc import ABC, abstractmethod

import httpx

from edge_control.errors import Unavailable


class CloudClient(ABC):
    enabled = False
    name = "disabled"

    @abstractmethod
    def send_events(self, site_id: str, edge_id: str, events: list[dict]) -> list[str]:
        """Returns the event_ids the receiver acknowledged (receiver de-duplicates by event_id)."""

    @abstractmethod
    def send_heartbeat(self, site_id: str, edge_id: str, payload: dict) -> dict:
        """Returns optional server info (e.g. bookings snapshot hint)."""


class DisabledCloudClient(CloudClient):
    name = "disabled"

    def send_events(self, site_id, edge_id, events):
        raise Unavailable("cloud reporting is disabled (EDGE_CLOUD_URL not set)", code="cloud_disabled")

    def send_heartbeat(self, site_id, edge_id, payload):
        raise Unavailable("cloud reporting is disabled (EDGE_CLOUD_URL not set)", code="cloud_disabled")


class HttpCloudClient(CloudClient):
    enabled = True
    name = "http-proposed"

    def __init__(self, base_url: str, token: str, timeout: float = 8.0):
        self.base, self.token = base_url.rstrip("/"), token
        self.http = httpx.Client(timeout=timeout)

    def _h(self) -> dict:
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    def send_events(self, site_id, edge_id, events):
        try:
            r = self.http.post(f"{self.base}/edge/v1/events", headers=self._h(),
                               json={"site_id": site_id, "edge_id": edge_id, "events": events})
        except httpx.HTTPError as e:
            raise Unavailable(f"cloud unreachable ({type(e).__name__})", code="cloud_unreachable") from e
        if r.status_code >= 300:
            raise Unavailable(f"cloud HTTP {r.status_code}", code="cloud_http_error")
        return list(r.json().get("acked", []))

    def send_heartbeat(self, site_id, edge_id, payload):
        try:
            r = self.http.post(f"{self.base}/edge/v1/heartbeat", headers=self._h(),
                               json={"site_id": site_id, "edge_id": edge_id, **payload})
        except httpx.HTTPError as e:
            raise Unavailable(f"cloud unreachable ({type(e).__name__})", code="cloud_unreachable") from e
        if r.status_code >= 300:
            raise Unavailable(f"cloud HTTP {r.status_code}", code="cloud_http_error")
        return r.json() if r.content else {}
