"""MediaMTX control client (API v3, verified against MediaMTX v1.21.3 openapi) and an in-memory test double.

Verified endpoints: POST /v3/config/paths/add/{name}, DELETE /v3/config/paths/delete/{name},
GET /v3/paths/get/{name} (field `ready`), GET /v3/paths/list.
"""
from __future__ import annotations

import threading
from abc import ABC, abstractmethod
from urllib.parse import quote

import httpx

from edge_control.errors import EdgeError, Unavailable
from edge_control.util import redact_text


class GatewayClient(ABC):
    name = "unknown"

    @abstractmethod
    def health(self) -> dict: ...

    @abstractmethod
    def add_pull_path(self, path: str, source_url: str, transport: str = "tcp") -> None:
        """Configure a path that MediaMTX itself pulls from `source_url` (contains credentials: never logged)."""

    @abstractmethod
    def add_publisher_path(self, path: str) -> None: ...

    @abstractmethod
    def delete_path(self, path: str) -> None: ...

    @abstractmethod
    def path_ready(self, path: str) -> bool: ...

    @abstractmethod
    def list_paths(self) -> list[str]: ...


class MediaMtxClient(GatewayClient):
    name = "mediamtx"

    def __init__(self, api_url: str, timeout: float = 5.0, auth: tuple[str, str] | None = None):
        self.base = api_url.rstrip("/")
        self.http = httpx.Client(timeout=timeout, auth=auth)   # HTTP Basic: validated by the agent's /internal/media/auth hook

    def _req(self, method: str, url: str, **kw):
        try:
            r = self.http.request(method, self.base + url, **kw)
        except httpx.HTTPError as e:
            raise Unavailable("media gateway unreachable", code="media_gateway_unavailable") from e
        return r

    def health(self) -> dict:
        try:
            r = self.http.get(self.base + "/v3/paths/list", timeout=3)
            return {"reachable": r.status_code == 200, "backend": "mediamtx", "status_code": r.status_code}
        except httpx.HTTPError as e:
            return {"reachable": False, "backend": "mediamtx", "error": type(e).__name__}

    def _add(self, path: str, conf: dict) -> None:
        r = self._req("POST", f"/v3/config/paths/add/{quote(path, safe='/')}", json=conf)
        if r.status_code == 400 and "already exists" in r.text.lower():
            self._req("DELETE", f"/v3/config/paths/delete/{quote(path, safe='/')}")
            r = self._req("POST", f"/v3/config/paths/add/{quote(path, safe='/')}", json=conf)
        if r.status_code >= 300:
            raise EdgeError(redact_text(f"gateway rejected path config ({r.status_code}): {r.text[:200]}"),
                            code="media_gateway_error", status_code=502)

    def add_pull_path(self, path: str, source_url: str, transport: str = "tcp") -> None:
        conf = {"source": source_url, "sourceOnDemand": False}
        if transport in ("tcp", "udp"):
            conf["rtspTransport"] = transport if transport != "udp" else "udp"
        self._add(path, conf)

    def add_publisher_path(self, path: str) -> None:
        self._add(path, {"source": "publisher"})

    def delete_path(self, path: str) -> None:
        r = self._req("DELETE", f"/v3/config/paths/delete/{quote(path, safe='/')}")
        if r.status_code not in (200, 404):
            raise EdgeError("gateway delete failed", code="media_gateway_error", status_code=502)

    def path_ready(self, path: str) -> bool:
        r = self._req("GET", f"/v3/paths/get/{quote(path, safe='/')}")
        return r.status_code == 200 and bool(r.json().get("ready"))

    def list_paths(self) -> list[str]:
        r = self._req("GET", "/v3/paths/list")
        return [i["name"] for i in r.json().get("items", [])] if r.status_code == 200 else []


class FakeGateway(GatewayClient):
    """Test double: records config calls; readiness is declared explicitly by the test or by a fake publisher."""
    name = "fake"

    def __init__(self, auto_ready: bool = True):
        self.paths: dict[str, dict] = {}
        self.ready: set[str] = set()
        self.auto_ready = auto_ready
        self.healthy = True
        self._lock = threading.Lock()

    def health(self) -> dict:
        return {"reachable": self.healthy, "backend": "fake"}

    def add_pull_path(self, path: str, source_url: str, transport: str = "tcp") -> None:
        with self._lock:
            self.paths[path] = {"kind": "pull", "has_credentials": "@" in source_url}
            if self.auto_ready:
                self.ready.add(path)

    def add_publisher_path(self, path: str) -> None:
        with self._lock:
            self.paths[path] = {"kind": "publisher"}

    def delete_path(self, path: str) -> None:
        with self._lock:
            self.paths.pop(path, None)
            self.ready.discard(path)

    def path_ready(self, path: str) -> bool:
        return path in self.ready

    def list_paths(self) -> list[str]:
        return list(self.paths)
