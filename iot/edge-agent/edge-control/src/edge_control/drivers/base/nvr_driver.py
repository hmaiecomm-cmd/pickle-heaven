"""NVR driver interface (live source resolution, recording search, playback source)."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from edge_control.config.schema import CameraBinding


@dataclass
class LiveSource:
    """Where MediaMTX should pull from. `url` may contain credentials: NEVER log or return it."""
    url: str
    transport: str = "tcp"
    codec: str | None = None
    kind: str = "rtsp"  # rtsp | synthetic


@dataclass
class RecordingSegment:
    recording_id: str
    camera_id: str
    start_time: datetime
    end_time: datetime
    available: bool = True


@dataclass
class RecordingPage:
    segments: list[RecordingSegment]
    next_cursor: str | None = None


@dataclass
class PlaybackSource:
    """kind=rtsp: url is an NVR playback RTSP uri pulled by FFmpeg; kind=file: local path; kind=synthetic."""
    kind: str
    url: str | None = None
    path: str | None = None
    codec: str | None = None
    duration_s: float | None = None
    secret_values: list[str] = field(default_factory=list)  # strings to mask in logs


class NvrDriver(ABC):
    mode = "unknown"

    @abstractmethod
    def capabilities(self) -> dict[str, Any]: ...

    @abstractmethod
    def resolve_live_source(self, binding: CameraBinding, profile: str) -> LiveSource: ...

    @abstractmethod
    def search_recordings(self, binding: CameraBinding, start: datetime, end: datetime,
                          cursor: str | None, limit: int) -> RecordingPage: ...

    @abstractmethod
    def prepare_playback(self, binding: CameraBinding, start: datetime, end: datetime,
                         recording_id: str | None) -> PlaybackSource: ...
