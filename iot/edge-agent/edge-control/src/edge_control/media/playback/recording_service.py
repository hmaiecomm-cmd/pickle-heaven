"""Recording search (what the NVR actually has).  Never invents segments."""
from __future__ import annotations

from datetime import datetime, timedelta

from edge_control.drivers.base.nvr_driver import NvrDriver, RecordingSegment
from edge_control.errors import Unprocessable
from edge_control.media.live.source_resolver import CameraResolver
from edge_control.security.permissions import Principal, require_camera
from edge_control.util import to_iso, utcnow

MAX_RANGE = timedelta(days=15)
DEFAULT_PAGE = 100


class RecordingService:
    def __init__(self, resolver: CameraResolver, nvr: NvrDriver):
        self.resolver, self.nvr = resolver, nvr

    @staticmethod
    def default_range() -> tuple[datetime, datetime]:
        now = utcnow()
        return now - timedelta(days=14), now

    def search(self, p: Principal, camera_id: str, start: datetime | None, end: datetime | None,
               cursor: str | None, limit: int = DEFAULT_PAGE) -> dict:
        require_camera(p, camera_id)
        if start is None or end is None:
            d0, d1 = self.default_range()
            start, end = start or d0, end or d1
        if end <= start:
            raise Unprocessable("'to' must be after 'from'", code="invalid_range")
        if end - start > MAX_RANGE:
            raise Unprocessable("range is limited to 15 days per query", code="range_too_large")
        limit = max(1, min(limit, 500))
        _rev, _cam, binding = self.resolver.require(camera_id, "search")
        page = self.nvr.search_recordings(binding, start, end, cursor, limit)
        return {"camera_id": camera_id, "from": to_iso(start), "to": to_iso(end), "source": self.nvr.mode,
                "items": [seg_view(s) for s in page.segments], "next_cursor": page.next_cursor,
                "retention_note": "Only recordings the NVR actually returned are listed; gaps are real gaps."}

    def segments_in(self, camera_id: str, start: datetime, end: datetime) -> list[RecordingSegment]:
        _rev, _cam, binding = self.resolver.require(camera_id, "search")
        out, cur = [], None
        while True:
            page = self.nvr.search_recordings(binding, start, end, cur, 200)
            out += page.segments
            cur = page.next_cursor
            if not cur:
                return out


def seg_view(s: RecordingSegment) -> dict:
    return {"recording_id": s.recording_id, "camera_id": s.camera_id, "start_time": to_iso(s.start_time),
            "end_time": to_iso(s.end_time), "available": s.available}
