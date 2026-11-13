"""Simulated NVR: deterministic fake recording index + synthetic (test-pattern) sources.
Nothing here proves anything about a real Hikvision device."""
from __future__ import annotations

import base64
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from edge_control.config.schema import CameraBinding
from edge_control.drivers.base.nvr_driver import (
    LiveSource, NvrDriver, PlaybackSource, RecordingPage, RecordingSegment,
)
from edge_control.errors import NotFound

NO_RECORDING_CAMERAS = {"camera-05"}  # simulate a channel that has no recordings at all
GAP_DAY_OFFSET = 3  # simulate a day without recordings


class MockNvrDriver(NvrDriver):
    mode = "mock"

    def __init__(self, tz: str = "Asia/Taipei", retention_days: int = 14, now_fn=None):
        self.tz = ZoneInfo(tz)
        self.retention_days = retention_days
        from edge_control.util import utcnow
        self._now = now_fn or utcnow

    def capabilities(self) -> dict:
        return {"live": True, "search": True, "playback": True, "pause": False, "speed": False, "seek": False,
                "download": False, "simulated": True}

    def resolve_live_source(self, binding: CameraBinding, profile: str) -> LiveSource:
        return LiveSource(url="synthetic://testsrc2", codec="h264", kind="synthetic")

    def _all_segments(self, camera_id: str) -> list[RecordingSegment]:
        if camera_id in NO_RECORDING_CAMERAS:
            return []
        today = self._now().astimezone(self.tz).date()
        out: list[RecordingSegment] = []
        for d in range(self.retention_days, -1, -1):
            if d == GAP_DAY_OFFSET:
                continue
            day = today - timedelta(days=d)
            for h0, m0, h1, m1 in ((8, 0, 12, 30), (14, 0, 23, 30)):
                s = datetime.combine(day, time(h0, m0), self.tz)
                e = datetime.combine(day, time(h1, m1), self.tz)
                if e > self._now():
                    e = self._now().astimezone(self.tz)
                if e <= s:
                    continue
                s_utc, e_utc = s.astimezone(ZoneInfo("UTC")), e.astimezone(ZoneInfo("UTC"))
                rid = f"rec_{camera_id}_{int(s_utc.timestamp())}_{int(e_utc.timestamp())}"
                out.append(RecordingSegment(rid, camera_id, s_utc, e_utc, True))
        return out

    def search_recordings(self, binding: CameraBinding, start: datetime, end: datetime, cursor: str | None, limit: int) -> RecordingPage:
        segs = [s for s in self._all_segments(binding.camera_id) if s.end_time > start and s.start_time < end]
        offset = int(base64.urlsafe_b64decode(cursor.encode()).decode()) if cursor else 0
        page = segs[offset: offset + limit]
        nxt = None
        if offset + limit < len(segs):
            nxt = base64.urlsafe_b64encode(str(offset + limit).encode()).decode()
        return RecordingPage(page, nxt)

    def prepare_playback(self, binding: CameraBinding, start: datetime, end: datetime, recording_id: str | None) -> PlaybackSource:
        covered = [s for s in self._all_segments(binding.camera_id) if s.start_time < end and s.end_time > start]
        if not covered:
            raise NotFound("no recording in the requested range", code="no_recording")
        return PlaybackSource(kind="synthetic", codec="h264", duration_s=(end - start).total_seconds())
