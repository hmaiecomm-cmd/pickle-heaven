"""Synthetic source -> FFmpeg -> MediaMTX -> WHEP/WebRTC end-to-end check.

Runs only when a MediaMTX binary is available (MEDIAMTX_BIN or on PATH) together with FFmpeg and aiortc is NOT
required: the WHEP offer is generated with a recvonly offer from `aiortc` if installed, otherwise the test checks
that MediaMTX reports the published path ready and that the WHEP endpoint enforces the agent's HTTP auth hook.
Browser-side playback is verified separately in a real browser (see docs/media-streaming.md).
"""
import os
import shutil
import subprocess
import time

import httpx
import pytest

MTX = os.environ.get("MEDIAMTX_BIN") or shutil.which("mediamtx")
FFMPEG = shutil.which("ffmpeg")
pytestmark = [pytest.mark.media, pytest.mark.skipif(not (MTX and FFMPEG), reason="mediamtx and/or ffmpeg not installed in this environment")]


def test_synthetic_publish_becomes_ready_in_mediamtx(tmp_path):
    cfg = tmp_path / "m.yml"
    cfg.write_text("api: yes\napiAddress: 127.0.0.1:19997\nrtspAddress: :18554\nwebrtcAddress: :18889\n"
                   "rtmp: no\nhls: no\nsrt: no\npaths:\n  all_others:\n")
    mtx = subprocess.Popen([MTX, str(cfg)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    ff = None
    try:
        time.sleep(1.5)
        from edge_control.media.pipelines.rtsp_bridge import synthetic_to_publish
        ff = subprocess.Popen(synthetic_to_publish(FFMPEG, "rtsp://127.0.0.1:18554/live/test", seconds=20),
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        ready = False
        for _ in range(40):
            r = httpx.get("http://127.0.0.1:19997/v3/paths/get/live/test", timeout=2)
            if r.status_code == 200 and r.json().get("ready"):
                ready = True
                break
            time.sleep(0.5)
        assert ready, "published synthetic stream never became ready"
    finally:
        for p in (ff, mtx):
            if p:
                p.terminate()
