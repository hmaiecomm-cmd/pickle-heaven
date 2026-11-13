"""Downloaded-file playback path (only when an NVR offers file download but no playback stream).

A file is first validated (exists, non-empty, readable by ffprobe) into the controlled cache dir; only then
is the session allowed to become ready.  The cache is size-capped and cleaned on stop/expiry.
"""
from __future__ import annotations

import logging
import os
import shutil
import subprocess
from pathlib import Path

log = logging.getLogger("edge.media")


def validate_media_file(ffprobe: str, path: Path, min_bytes: int = 1024) -> tuple[bool, str]:
    if not path.is_file() or path.stat().st_size < min_bytes:
        return False, "file missing or too small (incomplete download)"
    try:
        r = subprocess.run([ffprobe, "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
                           capture_output=True, text=True, timeout=10, shell=False)
        if r.returncode != 0 or not r.stdout.strip():
            return False, "ffprobe cannot read the file"
        return True, "ok"
    except FileNotFoundError:
        return False, "ffprobe not installed"
    except subprocess.TimeoutExpired:
        return False, "ffprobe timeout"


def cache_usage_mb(root: Path) -> float:
    return sum(f.stat().st_size for f in root.rglob("*") if f.is_file()) / (1024 * 1024) if root.exists() else 0.0


def ensure_capacity(root: Path, limit_mb: int, incoming_mb: float = 0) -> bool:
    return cache_usage_mb(root) + incoming_mb <= limit_mb


def remove_session_dir(root: Path, session_id: str) -> None:
    d = root / session_id
    if d.exists() and root in d.resolve().parents:
        shutil.rmtree(d, ignore_errors=True)


def cleanup_orphans(root: Path, keep_ids: set[str]) -> int:
    n = 0
    if not root.exists():
        return 0
    for d in root.iterdir():
        if d.is_dir() and d.name not in keep_ids:
            shutil.rmtree(d, ignore_errors=True)
            n += 1
    return n
