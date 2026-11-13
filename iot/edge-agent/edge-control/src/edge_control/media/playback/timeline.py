"""Timeline helpers for recording segments (all UTC)."""
from __future__ import annotations

from datetime import datetime, timedelta

from edge_control.drivers.base.nvr_driver import RecordingSegment


def clip(seg: RecordingSegment, start: datetime, end: datetime) -> tuple[datetime, datetime] | None:
    s, e = max(seg.start_time, start), min(seg.end_time, end)
    return (s, e) if e > s else None


def coverage(segments: list[RecordingSegment], start: datetime, end: datetime) -> float:
    """Fraction (0..1) of [start,end) covered by available segments (overlaps counted once)."""
    spans = sorted(c for s in segments if s.available and (c := clip(s, start, end)))
    covered = timedelta(0)
    cur_s = cur_e = None
    for s, e in spans:
        if cur_e is None or s > cur_e:
            if cur_e is not None:
                covered += cur_e - cur_s
            cur_s, cur_e = s, e
        else:
            cur_e = max(cur_e, e)
    if cur_e is not None:
        covered += cur_e - cur_s
    total = end - start
    return covered / total if total.total_seconds() > 0 else 0.0


def gaps(segments: list[RecordingSegment], start: datetime, end: datetime) -> list[tuple[datetime, datetime]]:
    out, cursor = [], start
    for s, e in sorted((c for seg in segments if seg.available and (c := clip(seg, start, end)))):
        if s > cursor:
            out.append((cursor, s))
        cursor = max(cursor, e)
    if cursor < end:
        out.append((cursor, end))
    return out
