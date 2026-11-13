"""Minimal ISAPI client.  Only `GET /ISAPI/System/deviceInfo` is used (read-only identity/health probe).

Recording search / playback via ISAPI is intentionally NOT implemented: the request bodies and response
schemas must be verified against the target NVR's official ISAPI document and firmware first.
"""
from __future__ import annotations

import httpx

from edge_control.config.settings import HikvisionEnv
from edge_control.errors import NotConfigured, Unavailable, Unsupported


class IsapiClient:
    def __init__(self, env: HikvisionEnv, user: str, pw: str, timeout: float = 8.0):
        self.env, self.user, self.pw, self.timeout = env, user, pw, timeout

    def _base(self) -> str:
        if not (self.env.host and self.env.http_port):
            raise NotConfigured("HIKVISION_HOST / HIKVISION_HTTP_PORT not set", code="nvr_not_configured")
        return f"{self.env.http_scheme}://{self.env.host}:{self.env.http_port}"

    def device_info(self) -> dict:
        """Single attempt with Digest auth. A 401 is reported, never retried with other schemes."""
        if not (self.user and self.pw):
            raise NotConfigured("NVR credentials not set", code="nvr_not_configured")
        try:
            r = httpx.get(self._base() + "/ISAPI/System/deviceInfo", auth=httpx.DigestAuth(self.user, self.pw),
                          timeout=self.timeout)
        except httpx.HTTPError as e:
            raise Unavailable(f"NVR unreachable ({type(e).__name__})", code="nvr_unreachable") from e
        if r.status_code == 401:
            raise Unavailable("NVR rejected the credentials (not retried)", code="nvr_auth_failed")
        if r.status_code != 200:
            raise Unavailable(f"NVR HTTP {r.status_code}", code="nvr_http_error")
        return {"http_status": 200, "bytes": len(r.content)}

    def search(self, *_a, **_k):
        raise Unsupported("ISAPI recording search not verified for this NVR model/firmware", code="isapi_search_unverified")
