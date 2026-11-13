"""Historical playback sessions: one isolated pipeline per session (never a shared seekable handle)."""
from __future__ import annotations

import logging
import shutil
from datetime import datetime
from pathlib import Path

from edge_control.config.loader import AppConfig
from edge_control.drivers.base.nvr_driver import NvrDriver
from edge_control.errors import EdgeError, NotFound, Unprocessable
from edge_control.media.live.source_resolver import CameraResolver
from edge_control.media.live.stream_service import check_delivery_target
from edge_control.media.pipelines.file_streamer import ensure_capacity, remove_session_dir, validate_media_file
from edge_control.media.pipelines.process_manager import ProcessManager, ResourceLimit
from edge_control.media.pipelines.rtsp_bridge import file_to_publish, publish_url, rtsp_to_publish, synthetic_to_publish
from edge_control.media.playback.recording_service import RecordingService
from edge_control.media.playback.timeline import coverage
from edge_control.media.session_manager import SessionManager
from edge_control.security.permissions import Principal, require_camera
from edge_control.util import new_id, redact_text, to_iso

log = logging.getLogger("edge.media.playback")


class PlaybackService:
    def __init__(self, *, cfg: AppConfig, sessions: SessionManager, resolver: CameraResolver, nvr: NvrDriver,
                 recordings: RecordingService, procs: ProcessManager, ffmpeg: str, ffprobe: str, cache_dir: Path,
                 rtsp_publish_base: str, internal_user: str, internal_secret: str):
        self.cfg, self.sessions, self.resolver, self.nvr = cfg, sessions, resolver, nvr
        self.recordings, self.procs, self.ffmpeg, self.ffprobe = recordings, procs, ffmpeg, ffprobe
        self.cache = cache_dir / "playback"
        self.pub_base, self.iu, self.isec = rtsp_publish_base, internal_user, internal_secret
        sessions.on_release.append(self._cleanup_files)

    def _cleanup_files(self, row: dict) -> None:
        if row["kind"] == "playback":
            remove_session_dir(self.cache, row["session_id"])

    def create(self, p: Principal, camera_id: str, *, start: datetime, end: datetime, delivery_target: str,
               ttl_seconds: int | None, idempotency_key: str | None, recording_id: str | None = None) -> tuple[dict, bool]:
        require_camera(p, camera_id)
        m = self.cfg.media
        ttl = ttl_seconds or m.playback_ttl_default_seconds
        if not m.playback_ttl_min_seconds <= ttl <= m.playback_ttl_max_seconds:
            raise Unprocessable(f"ttl_seconds must be {m.playback_ttl_min_seconds}..{m.playback_ttl_max_seconds}", code="ttl_out_of_range")
        if end <= start:
            raise Unprocessable("end_time must be after start_time", code="invalid_range")
        if (end - start).total_seconds() > 4 * 3600:
            raise Unprocessable("playback window is limited to 4 hours", code="range_too_large")
        check_delivery_target(delivery_target, self.cfg)
        req_hash = self.sessions.request_hash({"cam": camera_id, "s": to_iso(start), "e": to_iso(end), "d": delivery_target,
                                               "ttl": ttl, "rec": recording_id})
        existing = self.sessions.find_idempotent(p.actor, "playback", idempotency_key, req_hash)
        if existing:
            return existing, False
        rev, _cam, _b = self.resolver.require(camera_id, "playback")
        segs = self.recordings.segments_in(camera_id, start, end)  # availability is checked BEFORE any session exists
        if coverage(segs, start, end) <= 0:
            raise NotFound("no recording exists in the requested range", code="no_recording",
                           details={"camera_id": camera_id})
        if self.sessions.active_count("playback", p.actor) >= m.max_playback_sessions_per_actor:
            raise ResourceLimit("too many playback sessions for this user", code="session_limit_per_actor")
        if self.sessions.active_count("playback") >= m.max_playback_sessions:
            raise ResourceLimit("playback session limit reached", code="resource_limit")
        sid = new_id("ses")
        path = f"playback/{sid}"  # per-session path: other users can never seek or share this stream
        row = self.sessions.insert(kind="playback", camera_id=camera_id, actor=p.actor, profile=None,
                                   delivery_target=delivery_target, path_name=path, session_id=sid,
                                   params={"start_time": to_iso(start), "end_time": to_iso(end), "coverage": round(coverage(segs, start, end), 3)},
                                   ttl=ttl, idem_key=idempotency_key, req_hash=req_hash, mapping_revision=rev)
        self.sessions.submit_prepare(lambda: self._prepare(sid, camera_id, start, end, recording_id, path))
        return row, True

    def _prepare(self, sid: str, camera_id: str, start: datetime, end: datetime, rec_id: str | None, path: str) -> None:
        job_id = f"pub:{path}"
        try:
            _rev, binding = self.resolver.lookup(camera_id)
            src = self.nvr.prepare_playback(binding, start, end, rec_id)  # type: ignore[arg-type]
            self.sessions.gateway.add_publisher_path(path)
            dst = publish_url(self.pub_base, self.iu, self.isec, path)
            secrets = [self.isec, *src.secret_values]
            budget = max(30.0, (end - start).total_seconds() + 30)
            if src.kind == "synthetic":
                args = synthetic_to_publish(self.ffmpeg, dst, seconds=min(budget, 3600))
            elif src.kind == "rtsp":
                args = rtsp_to_publish(self.ffmpeg, src.url, dst, src.codec)  # type: ignore[arg-type]
                secrets.append(src.url or "")
            elif src.kind == "file":
                d = self.cache / sid
                d.mkdir(parents=True, exist_ok=True)
                if not ensure_capacity(self.cache, self.cfg.media.temp_dir_max_mb):
                    raise ResourceLimit("playback cache is full", code="resource_limit")
                ok, why = validate_media_file(self.ffprobe, Path(src.path or ""))
                if not ok:
                    raise EdgeError(f"downloaded file failed validation: {why}", code="playback_file_invalid", status_code=502)
                args = file_to_publish(self.ffmpeg, src.path or "", dst, src.codec)
            else:
                raise EdgeError("unknown playback source kind", code="playback_unsupported", status_code=501)
            self.procs.start(job_id, args, secrets=secrets, max_seconds=budget)
            if self.sessions.wait_ready(sid, path):
                self.sessions.mark_ready(sid)
            else:
                row = self.sessions.get_row(sid)
                if row["status"] == "preparing":
                    job = self.procs.get(job_id)
                    self.sessions.mark_failed(sid, "prepare_timeout", f"playback source did not become ready. {job.tail() if job else ''}")
        except EdgeError as e:
            self.sessions.mark_failed(sid, e.code, e.message)
        except Exception as e:  # noqa: BLE001
            log.exception("playback prepare failed")
            self.sessions.mark_failed(sid, "internal_error", redact_text(type(e).__name__))
