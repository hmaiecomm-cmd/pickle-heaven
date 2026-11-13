"""Process supervision and FFmpeg pipeline pieces that can run without MediaMTX or a camera."""
import shutil
import subprocess
import sys
import time

import pytest

from edge_control.errors import EdgeError
from edge_control.media.pipelines.process_manager import ProcessManager, ResourceLimit
from edge_control.media.pipelines.rtsp_bridge import publish_url, rtsp_to_publish, synthetic_to_publish
from edge_control.media.pipelines.transcoder import needs_transcode, video_args

FFMPEG = shutil.which("ffmpeg")
SLEEP = [sys.executable, "-c", "import time; time.sleep(30)"]


def test_process_limits_stop_timeout_and_cleanup():
    pm = ProcessManager(max_jobs=2)
    pm.start("a", SLEEP)
    pm.start("b", SLEEP)
    with pytest.raises(ResourceLimit):
        pm.start("c", SLEEP)
    assert pm.count() == 2
    pm.stop("a")
    assert pm.count() == 1 and not pm.has("a")
    pm.start("c", SLEEP)                                    # slot freed
    pm.shutdown()
    assert pm.count() == 0


def test_job_time_budget_kills_runaway_process():
    pm = ProcessManager(max_jobs=2)
    job = pm.start("slow", SLEEP, max_seconds=0.5)
    time.sleep(2.0)
    assert job.proc.poll() is not None and not pm.has("slow")
    pm.shutdown()


def test_stderr_is_redacted_and_no_shell():
    pm = ProcessManager()
    secret = "S3cr3t!pw"
    job = pm.start("e", [sys.executable, "-c", f"import sys; sys.stderr.write('open rtsp://admin:{secret}@10.0.0.1/x failed\\n')"],
                   secrets=[secret])
    time.sleep(1)
    assert secret not in job.tail() and "***" in job.tail()
    with pytest.raises(EdgeError) as e:
        pm.start("nf", ["definitely-not-ffmpeg-binary"])
    assert e.value.code == "media_tool_missing"
    with pytest.raises(AssertionError):
        pm.start("shellstr", "ffmpeg -i x")                 # strings (shell-style) are refused: argv arrays only


def test_codec_decision_copy_vs_transcode():
    assert not needs_transcode("h264") and not needs_transcode("H264")
    assert needs_transcode("hevc") and needs_transcode("h265") and needs_transcode(None)
    assert "copy" in video_args("h264") and "libx264" in video_args("hevc")
    assert "-an" in video_args("h264")


def test_ffmpeg_arg_builders_use_argv_and_encode_credentials():
    dst = publish_url("rtsp://mediamtx:8554", "edge-agent", "p@ss/word", "live/camera-04_sub")
    assert dst == "rtsp://edge-agent:p%40ss%2Fword@mediamtx:8554/live/camera-04_sub"
    args = rtsp_to_publish("ffmpeg", "rtsp://u:p@nvr/x", dst, "hevc")
    assert isinstance(args, list) and args[0] == "ffmpeg" and args[args.index("-i") + 1] == "rtsp://u:p@nvr/x"
    assert "libx264" in args and args[-1] == dst
    syn = synthetic_to_publish("ffmpeg", dst, seconds=5)
    assert "testsrc2=size=640x360:rate=15" in syn and "-t" in syn


@pytest.mark.skipif(FFMPEG is None, reason="ffmpeg not installed")
def test_synthetic_source_encodes_to_webrtc_friendly_h264(tmp_path):
    """Runs the real encoder settings used for the demo source (to a local file instead of MediaMTX)."""
    out = tmp_path / "t.mp4"
    args = synthetic_to_publish(FFMPEG, "rtsp://x/y", seconds=1)
    args = args[:args.index("-f", args.index("-bf"))] + ["-t", "1", "-y", str(out)]
    r = subprocess.run(args, capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, r.stderr[-400:]
    probe = shutil.which("ffprobe")
    if probe:
        codec = subprocess.run([probe, "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,profile",
                                "-of", "csv=p=0", str(out)], capture_output=True, text=True).stdout.strip()
        assert codec.startswith("h264")
