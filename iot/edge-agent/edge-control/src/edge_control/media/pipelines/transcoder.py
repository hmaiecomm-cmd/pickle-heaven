"""Codec decision and FFmpeg argument builders.  Copy when the codec is browser-WebRTC friendly,
transcode only when needed.  Audio is dropped in v1 (AAC is not a WebRTC codec)."""
from __future__ import annotations

import json
import subprocess

WEBRTC_VIDEO_COPY_OK = {"h264", "vp8", "vp9", "av1"}


def needs_transcode(codec: str | None) -> bool:
    """Unknown codec => transcode (safe for browsers, costs CPU). H.265 is NOT assumed playable."""
    return (codec or "").lower() not in WEBRTC_VIDEO_COPY_OK


def probe_codec(ffprobe: str, url: str, rtsp_transport: str = "tcp", timeout: float = 8.0) -> str | None:
    args = [ffprobe, "-v", "error", "-rtsp_transport", rtsp_transport, "-select_streams", "v:0",
            "-show_entries", "stream=codec_name", "-of", "json", url] if url.startswith("rtsp") else \
           [ffprobe, "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name", "-of", "json", url]
    try:
        out = subprocess.run(args, capture_output=True, text=True, timeout=timeout, shell=False)
        return json.loads(out.stdout)["streams"][0]["codec_name"]
    except Exception:  # noqa: BLE001 - never include args (credentials) in logs
        return None


def video_args(codec: str | None) -> list[str]:
    if needs_transcode(codec):
        return ["-an", "-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency", "-pix_fmt", "yuv420p",
                "-profile:v", "baseline", "-g", "50", "-bf", "0"]
    return ["-an", "-c:v", "copy"]
