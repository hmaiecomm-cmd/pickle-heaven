"""Live RTSP -> MediaMTX -> WebRTC (WHEP) session service."""
from __future__ import annotations

import logging
import threading

from edge_control.config.loader import AppConfig
from edge_control.drivers.base.nvr_driver import NvrDriver
from edge_control.errors import EdgeError, NotConfigured, Unprocessable, Unsupported
from edge_control.media.live.source_resolver import CameraResolver
from edge_control.media.pipelines.process_manager import ProcessManager, ResourceLimit
from edge_control.media.pipelines.rtsp_bridge import publish_url, rtsp_to_publish, synthetic_to_publish
from edge_control.media.session_manager import SessionManager
from edge_control.security.permissions import Principal, require_camera
from edge_control.util import redact_text

log = logging.getLogger("edge.media.live")
PROFILES = ("main", "sub")


def check_delivery_target(target: str, cfg: AppConfig) -> None:
    if target == "browser":
        return
    if target == "cloud_media":
        cm = cfg.media.cloud_media
        if not (cm.get("protocol") and cm.get("url")):
            raise NotConfigured("no cloud media receiver is configured; nothing is pushed to the cloud",
                                code="delivery_target_not_configured")
        raise Unsupported("cloud_media adapter is not implemented yet for the configured protocol",
                          code="delivery_target_unsupported")
    raise Unprocessable("delivery_target must be 'browser' or 'cloud_media'", code="invalid_delivery_target")


class LiveService:
    def __init__(self, *, cfg: AppConfig, sessions: SessionManager, resolver: CameraResolver, nvr: NvrDriver,
                 procs: ProcessManager, ffmpeg: str, rtsp_publish_base: str, internal_user: str, internal_secret: str):
        self.cfg, self.sessions, self.resolver, self.nvr, self.procs = cfg, sessions, resolver, nvr, procs
        self.ffmpeg, self.pub_base, self.iu, self.isec = ffmpeg, rtsp_publish_base, internal_user, internal_secret
        self._path_lock = threading.Lock()

    @staticmethod
    def path_for(camera_id: str, profile: str) -> str:
        return f"live/{camera_id}_{profile}"

    def create(self, p: Principal, camera_id: str, *, stream_profile: str, delivery_target: str, ttl_seconds: int | None,
               idempotency_key: str | None) -> tuple[dict, bool]:
        require_camera(p, camera_id)
        m = self.cfg.media
        ttl = ttl_seconds or m.live_ttl_default_seconds
        if not m.live_ttl_min_seconds <= ttl <= m.live_ttl_max_seconds:
            raise Unprocessable(f"ttl_seconds must be {m.live_ttl_min_seconds}..{m.live_ttl_max_seconds}", code="ttl_out_of_range")
        if stream_profile not in PROFILES:
            raise Unprocessable("stream_profile must be 'main' or 'sub'", code="invalid_stream_profile")
        check_delivery_target(delivery_target, self.cfg)
        req_hash = self.sessions.request_hash({"cam": camera_id, "p": stream_profile, "d": delivery_target, "ttl": ttl})
        existing = self.sessions.find_idempotent(p.actor, "live", idempotency_key, req_hash)
        if existing:
            return existing, False
        rev, _cam, binding = self.resolver.require(camera_id, "live")
        if self.sessions.active_count("live", p.actor) >= m.max_live_sessions_per_actor:
            raise ResourceLimit("too many live sessions for this user", code="session_limit_per_actor")
        if self.sessions.active_count("live") >= m.max_live_sessions:
            raise ResourceLimit("live session limit reached", code="resource_limit")
        path = self.path_for(camera_id, stream_profile)
        row = self.sessions.insert(kind="live", camera_id=camera_id, actor=p.actor, profile=stream_profile,
                                   delivery_target=delivery_target, path_name=path, params={}, ttl=ttl,
                                   idem_key=idempotency_key, req_hash=req_hash, mapping_revision=rev)
        sid = row["session_id"]
        self.sessions.submit_prepare(lambda: self._prepare(sid, camera_id, stream_profile, path))
        return row, True

    def _prepare(self, sid: str, camera_id: str, profile: str, path: str) -> None:
        try:
            _rev, binding = self.resolver.lookup(camera_id)
            src = self.nvr.resolve_live_source(binding, profile)  # type: ignore[arg-type]
            with self._path_lock:
                shared = self.sessions.active_on_path(path, exclude=sid) > 0 and self.sessions.gateway.path_ready(path)
                if not shared:
                    if src.kind == "synthetic":
                        self.sessions.gateway.add_publisher_path(path)
                        dst = publish_url(self.pub_base, self.iu, self.isec, path)
                        self.procs.start(f"pub:{path}", synthetic_to_publish(self.ffmpeg, dst, label=int(camera_id[-2:])),
                                         secrets=[self.isec, src.url])
                    else:
                        self.sessions.gateway.add_pull_path(path, src.url, src.transport)
            if self.sessions.wait_ready(sid, path):
                self.sessions.mark_ready(sid)
            else:
                row = self.sessions.get_row(sid)
                if row["status"] == "preparing":
                    job = self.procs.get(f"pub:{path}")
                    detail = job.tail() if job else ""
                    self.sessions.mark_failed(sid, "source_unavailable", f"source did not become ready in time. {detail}")
        except EdgeError as e:
            self.sessions.mark_failed(sid, e.code, e.message)
        except Exception as e:  # noqa: BLE001
            log.exception("live prepare failed")
            self.sessions.mark_failed(sid, "internal_error", redact_text(type(e).__name__))
