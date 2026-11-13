"""SDK isolation: degradation when missing, fake binding lifecycle, bounded callback queue, worker restart."""
import os
import platform
import threading
import time

import pytest

from edge_control.config.schema import HikvisionConfig
from edge_control.config.settings import HikvisionEnv
from edge_control.drivers.nvr.hikvision.binding import FakeSdkBinding, SdkError, SdkLoginFailed, load_official_binding
from edge_control.drivers.nvr.hikvision.client import SdkWorkerClient, SdkWorkerError
from edge_control.drivers.nvr.hikvision.driver import HikvisionNvrDriver
from edge_control.drivers.nvr.hikvision.runtime import SdkRuntime
from edge_control.drivers.nvr.hikvision.sdk_loader import check_sdk
from edge_control.drivers.nvr.hikvision.session import ChunkQueue, SdkSessions
from edge_control.errors import EdgeError, NotConfigured, Unsupported


# ---------------------------------------------------------------- degradation (no SDK present)
def test_sdk_states_unconfigured_missing_noarch(tmp_path):
    assert check_sdk(None)["state"] == "unconfigured"
    assert check_sdk(tmp_path / "nope")["state"] == "missing"
    empty = tmp_path / "sdk"
    empty.mkdir()
    r = check_sdk(empty)
    assert r["state"] in ("arch_mismatch", "no_manifest", "not_loadable") and r["errors"]
    wrong = tmp_path / "sdk2"
    other = "linux-aarch64" if platform.machine().lower() in ("x86_64", "amd64") else "linux-x86_64"
    (wrong / other).mkdir(parents=True)
    (wrong / other / "libfoo.so").write_bytes(b"\x7fELF")
    r = check_sdk(wrong)
    assert r["state"] in ("arch_mismatch", "no_manifest", "not_loadable")
    assert "libfoo" not in str(r.get("manifest"))


def test_manifest_required_and_bad_library_not_loadable(tmp_path):
    d = tmp_path / "sdk"
    arch = {"x86_64": "linux-x86_64", "amd64": "linux-x86_64", "aarch64": "linux-aarch64", "arm64": "linux-aarch64"}.get(platform.machine().lower(), "linux-x86_64")
    (d / arch).mkdir(parents=True)
    (d / arch / "libfake.so").write_bytes(b"not an elf")
    (d / "manifest.json").write_text('{"version":"t","entry_library":"libfake.so"}')
    r = check_sdk(d)
    assert r["state"] == "not_loadable" and r["errors"]       # never raises, never touches a device


def test_official_binding_refuses_without_real_package():
    with pytest.raises(SdkError) as e:
        load_official_binding("/nonexistent")
    assert e.value.error_class == "binding_not_installed"


def test_driver_without_sdk_or_config_degrades_explicitly():
    from edge_control.config.schema import CameraBinding
    env = HikvisionEnv(host="192.0.2.1", rtsp_port=554, username="u", password="p", _env_file=None)
    cam = CameraBinding(camera_id="camera-04", sdk_channel_id="1", isapi_track_id="t")
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    d = HikvisionNvrDriver(env, HikvisionConfig(strategy="rtsp"))
    with pytest.raises(Unsupported):
        d.search_recordings(cam, now, now, None, 10)
    d = HikvisionNvrDriver(env, HikvisionConfig(strategy="auto"))
    with pytest.raises(NotConfigured):      # auto follows only CONFIRMED capabilities
        d.search_recordings(cam, now, now, None, 10)
    d = HikvisionNvrDriver(env, HikvisionConfig(strategy="isapi"))
    with pytest.raises(Unsupported) as e:
        d.search_recordings(cam, now, now, None, 10)
    assert e.value.code == "isapi_search_unverified"
    assert d.capabilities()["search"] is False and d.capabilities()["confirmed"] is False


# ---------------------------------------------------------------- fake binding lifecycle (in-process)
def make_sessions(queue=4, **kw):
    b = FakeSdkBinding(**kw)
    return b, SdkSessions(SdkRuntime(b), queue)


def test_login_logout_and_handle_recycling():
    b, s = make_sessions()
    sid = s.login("h", 8000, "u", "fake-ok")
    assert b.inited and s.counts() == {"logins": 1, "streams": 0}
    import datetime as dt
    key, q = s.start_stream(sid, "1", dt.datetime.now(), dt.datetime.now())
    assert s.counts()["streams"] == 1
    s.logout(sid)                                           # logout stops its streams and releases the runtime
    assert s.counts() == {"logins": 0, "streams": 0} and not b.inited
    assert b.logins == {} and any(c.startswith("stop_stream") for c in b.calls) and b.calls[-1] == "cleanup"
    with pytest.raises(SdkError) as e:
        s.search(sid, "1", None, None)
    assert e.value.error_class == "invalid_session"


def test_failed_login_releases_runtime_and_hides_password():
    b, s = make_sessions()
    with pytest.raises(SdkLoginFailed) as e:
        s.login("h", 8000, "u", "WRONG-pass")
    assert "WRONG-pass" not in str(e.value) and not b.inited and s.counts()["logins"] == 0


def test_chunk_queue_is_bounded_copies_and_drops_oldest():
    q = ChunkQueue(maxsize=3)
    buf = bytearray(b"abc")
    q.put(buf)
    buf[:] = b"zzz"                                         # SDK reuses its buffer after the callback returns
    assert q.get(0.1) == b"abc"
    for i in range(10):
        q.put(bytes([i]))
    assert len(q) == 3 and q.dropped == 7 and q.total == 11
    assert [q.get(0.1) for _ in range(3)] == [bytes([7]), bytes([8]), bytes([9])]


def test_callback_keeps_strong_reference_and_never_blocks():
    import datetime as dt
    b, s = make_sessions(queue=2, chunks=50, chunk_size=16)
    sid = s.login("h", 8000, "u", "fake-ok")
    key, q = s.start_stream(sid, "1", dt.datetime.now(), dt.datetime.now())
    assert s._streams[key][2] is not None                   # callback referenced for the stream's lifetime
    t0 = time.time()
    while q.total < 50 and time.time() - t0 < 3:
        time.sleep(0.01)
    assert q.total == 50 and len(q) <= 2 and q.dropped >= 48   # producer was never blocked by the slow consumer
    s.logout_all()


# ---------------------------------------------------------------- isolated worker process
def test_worker_process_roundtrip_health_has_no_secrets(tmp_path):
    c = SdkWorkerClient("fake", timeout_s=10)
    try:
        assert c.ping()["pong"]
        sid, gen = c.login("host", 8000, "user", "fake-ok")
        assert gen == 1 and c.search(sid, "1", "2026-01-01T00:00:00Z", "2026-01-01T01:00:00Z")
        sink = tmp_path / "sink.bin"
        key = c.stream_start(sid, "1", "2026-01-01T00:00:00Z", "2026-01-01T01:00:00Z", str(sink))
        for _ in range(100):
            if sink.exists() and sink.stat().st_size >= 5 * 1024:
                break
            time.sleep(0.05)
        assert sink.stat().st_size == 5 * 1024              # bytes were pumped from the bounded queue to the sink
        assert c.stream_stats(key)["total"] == 5
        c.stream_stop(key)
        h = c.health()
        assert h["running"] and h["logins"] == 1
        assert "fake-ok" not in str(h) and "user" not in str(h)
        with pytest.raises(SdkWorkerError) as e:
            c.login("host", 8000, "user", "bad-pass-99")
        assert e.value.error_class == "login_failed" and "bad-pass-99" not in e.value.message
        c.logout(sid)
    finally:
        c.close()


def test_worker_crash_restarts_and_old_sessions_are_invalid():
    c = SdkWorkerClient("fake", timeout_s=5)
    try:
        sid, gen1 = c.login("host", 8000, "user", "fake-ok")
        c._proc.kill(); c._proc.wait()                     # simulate a native crash
        with pytest.raises(EdgeError):                      # old handle can't be used any more
            c.search(sid, "1", "2026-01-01T00:00:00Z", "2026-01-01T01:00:00Z")
        sid2, gen2 = c.login("host", 8000, "user", "fake-ok")
        assert gen2 == gen1 + 1 and c.restarts >= 1
        with pytest.raises(SdkWorkerError) as e:            # handle ids are per process; an unknown one is rejected
            c.search("L999", "1", "2026-01-01T00:00:00Z", "2026-01-01T01:00:00Z")
        assert e.value.error_class == "invalid_session"
        assert c.health()["generation"] == gen2
    finally:
        c.close()


def test_official_binding_worker_reports_unavailable_without_crashing():
    c = SdkWorkerClient("official", sdk_dir="/nonexistent", timeout_s=5)
    try:
        with pytest.raises(SdkWorkerError) as e:
            c.login("h", 8000, "u", "p")
        assert e.value.error_class == "binding_not_installed"
        assert c.ping()["pong"]                             # worker is still healthy: other features unaffected
    finally:
        c.close()
