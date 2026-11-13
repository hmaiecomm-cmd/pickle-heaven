"""FFmpeg argument builders: RTSP -> MediaMTX publish, synthetic test sources, file streaming."""
from __future__ import annotations

from edge_control.media.pipelines.transcoder import video_args


def publish_url(base: str, user: str, secret: str, path: str) -> str:
    from urllib.parse import quote, urlsplit
    p = urlsplit(base)
    host = p.hostname or "127.0.0.1"
    netloc = f"{quote(user, safe='')}:{quote(secret, safe='')}@{host}" + (f":{p.port}" if p.port else "")
    return f"rtsp://{netloc}/{path}"


def rtsp_to_publish(ffmpeg: str, src_url: str, dst_url: str, codec: str | None, transport: str = "tcp") -> list[str]:
    """NVR RTSP (live or playback uri) -> MediaMTX publish."""
    return [ffmpeg, "-hide_banner", "-loglevel", "warning", "-rtsp_transport", transport, "-i", src_url,
            *video_args(codec), "-f", "rtsp", "-rtsp_transport", "tcp", dst_url]


def synthetic_to_publish(ffmpeg: str, dst_url: str, *, seconds: float | None = None, label: int = 1,
                         size: str = "640x360", rate: int = 15) -> list[str]:
    """Test pattern (lavfi testsrc2) so the full WebRTC path can be demonstrated without any camera."""
    args = [ffmpeg, "-hide_banner", "-loglevel", "warning", "-re", "-f", "lavfi",
            "-i", f"testsrc2=size={size}:rate={rate}"]
    if seconds:
        args += ["-t", f"{seconds:.0f}"]
    args += ["-an", "-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency", "-pix_fmt", "yuv420p",
             "-profile:v", "baseline", "-g", str(rate * 2), "-bf", "0", "-f", "rtsp", "-rtsp_transport", "tcp", dst_url]
    return args


def file_to_publish(ffmpeg: str, path: str, dst_url: str, codec: str | None, start_offset: float = 0.0) -> list[str]:
    a = [ffmpeg, "-hide_banner", "-loglevel", "warning", "-re"]
    if start_offset:
        a += ["-ss", f"{start_offset:.2f}"]
    return a + ["-i", path, *video_args(codec), "-f", "rtsp", "-rtsp_transport", "tcp", dst_url]
