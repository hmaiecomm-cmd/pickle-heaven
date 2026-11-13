from __future__ import annotations

import shutil
import subprocess


def tool_status(ffmpeg: str = "ffmpeg") -> dict:
    path = shutil.which(ffmpeg)
    ver = None
    if path:
        try:
            out = subprocess.run([path, "-version"], capture_output=True, text=True, timeout=5, shell=False).stdout
            ver = out.splitlines()[0][:80] if out else None
        except Exception:  # noqa: BLE001
            ver = None
    return {"ffmpeg": {"available": bool(path), "version": ver}, "ffprobe": {"available": bool(shutil.which("ffprobe"))}}
