"""Hikvision NVR driver: strategy-based (rtsp | isapi | sdk | auto).  `auto` only follows capabilities that
the operator has marked as confirmed in hikvision.yaml.  Without confirmation the answer is not_configured."""
from __future__ import annotations

from datetime import datetime

from edge_control.config.schema import CameraBinding, HikvisionConfig
from edge_control.config.settings import HikvisionEnv
from edge_control.drivers.base.nvr_driver import LiveSource, NvrDriver, PlaybackSource, RecordingPage
from edge_control.drivers.nvr.hikvision import rtsp_source
from edge_control.drivers.nvr.hikvision.client import SdkWorkerClient
from edge_control.drivers.nvr.isapi_driver import IsapiClient
from edge_control.errors import NotConfigured, Unsupported
from edge_control.security.secret_provider import hikvision_credentials


class HikvisionNvrDriver(NvrDriver):
    mode = "real"

    def __init__(self, env: HikvisionEnv, cfg: HikvisionConfig, sdk: SdkWorkerClient | None = None):
        self.env, self.cfg, self.sdk = env, cfg, sdk
        self.isapi = IsapiClient(env, *hikvision_credentials(env), timeout=cfg.http_timeout_seconds)

    def _cap(self, name: str) -> bool:
        return bool(self.cfg.capabilities_confirmed and self.cfg.capabilities.get(name))

    def capabilities(self) -> dict:
        return {"live": self._cap("live_rtsp"), "search": self._cap("isapi_search") or self._cap("sdk_search"),
                "playback": self._cap("isapi_playback") or self._cap("sdk_playback"),
                "download": self._cap("sdk_download"), "pause": self._cap("pause"), "speed": self._cap("speed"),
                "seek": self._cap("seek"), "confirmed": self.cfg.capabilities_confirmed, "simulated": False,
                "strategy": self.cfg.strategy}

    def resolve_live_source(self, binding: CameraBinding, profile: str) -> LiveSource:
        user, pw = hikvision_credentials(self.env)
        return rtsp_source.build_live_source(self.env, user, pw, self.cfg, binding, profile)

    def _history_route(self) -> str:
        s = self.cfg.strategy
        if s == "auto":
            if self._cap("sdk_search") and self.sdk:
                return "sdk"
            if self._cap("isapi_search"):
                return "isapi"
            raise NotConfigured("no history capability is confirmed in hikvision.yaml", code="history_not_configured")
        if s in ("isapi", "sdk"):
            return s
        raise Unsupported("strategy 'rtsp' covers live view only; history needs isapi/sdk/auto", code="history_unsupported")

    def search_recordings(self, binding: CameraBinding, start: datetime, end: datetime, cursor: str | None, limit: int) -> RecordingPage:
        route = self._history_route()
        if route == "isapi":
            return self.isapi.search()
        if not self.sdk:
            raise NotConfigured("SDK worker not configured", code="sdk_unavailable")
        if not binding.sdk_channel_id:
            raise NotConfigured(f"camera {binding.camera_id} has no SDK channel id", code="sdk_channel_not_configured")
        raise Unsupported("SDK search result mapping requires the verified official binding "
                          "(see docs/hikvision-sdk-installation.md)", code="sdk_binding_required")

    def prepare_playback(self, binding: CameraBinding, start: datetime, end: datetime, recording_id: str | None) -> PlaybackSource:
        route = self._history_route() if self.cfg.strategy != "rtsp" else "rtsp"
        if route == "rtsp" or (route == "isapi" and self._cap("isapi_playback")):
            user, pw = hikvision_credentials(self.env)
            url = rtsp_source.build_playback_url(self.env, user, pw, self.cfg, binding, start, end)
            return PlaybackSource(kind="rtsp", url=url, codec=binding.codec, secret_values=[pw, user])
        raise Unsupported("playback path not confirmed for this NVR", code="playback_unsupported")
