"""Live / playback session lifecycle with a fake MediaMTX gateway and a stubbed FFmpeg launcher."""
import time
from datetime import datetime, timedelta, timezone

import pytest

from edge_control.errors import EdgeError
from edge_control.util import to_iso
from tests.conftest import H, build_env, cid, future

PUB = {"user": "edge-agent", "password": "internal-secret-xyz"}


class StubProcs:
    """Replaces ProcessManager.start: records the argv and plays the role of a publisher that connected."""

    def __init__(self, env, fail_with=None):
        self.env, self.started, self.fail_with = env, [], fail_with
        env.ctx.procs.start = self.start  # type: ignore[method-assign]

    def start(self, job_id, args, *, secrets=None, max_seconds=None, on_exit=None):
        if self.fail_with:
            raise self.fail_with
        self.started.append((job_id, args, secrets))
        self.env.ctx.gateway.ready.add(job_id.removeprefix("pub:"))
        return None


def wait(env, url, who, want=("ready", "failed"), timeout=5):
    end = time.time() + timeout
    while time.time() < end:
        j = env.client.get(url, headers=H[who]).json()
        if j["status"] in want:
            return j
        time.sleep(0.05)
    raise AssertionError(f"timeout waiting for {want}: {j}")


def live(env, who="viewer", cam="camera-04", profile="sub", key=None, **extra):
    h = {**H[who], **({"Idempotency-Key": key} if key else {})}
    return env.client.post(f"/v1/cameras/{cam}/live-sessions", headers=h, json={"stream_profile": profile, **extra})


def auth(env, token, path, action="read"):
    r = env.client.post("/internal/media/auth", json={"action": action, "path": path, "token": token, "ip": "1.2.3.4", "protocol": "webrtc"})
    return r.status_code == 200


@pytest.fixture()
def menv(env):
    env.stub = StubProcs(env)
    return env


def test_six_cameras_in_fixed_order(env):
    j = env.client.get("/v1/cameras", headers=H["viewer"]).json()
    assert [c["camera_id"] for c in j["cameras"]] == [f"camera-0{i}" for i in range(1, 7)]
    assert j["cameras"][3]["name"] == "球場 A 攝影機" and j["cameras"][5]["scope"] == "監看球場 B"
    assert all(c["driver_mode"] == "mock" for c in j["cameras"])
    assert env.client.get("/v1/cameras", headers=H["cam4"]).json()["count"] == 6 and \
        [c["camera_id"] for c in env.client.get("/v1/cameras", headers=H["cam4"]).json()["cameras"]] == ["camera-04"]


def test_live_session_async_flow_and_no_fake_url_while_preparing(menv):
    r = live(menv)
    assert r.status_code == 202
    j = r.json()
    assert j["kind"] == "live" and j["status"] == "preparing" and "playback" not in j and j["status_url"] == f"/v1/live-sessions/{j['session_id']}"
    done = wait(menv, j["status_url"], "viewer")
    assert done["status"] == "ready"
    pb = done["playback"]
    assert pb["protocol"] == "whep" and pb["url"].endswith("/live/camera-04_sub/whep") and len(pb["token"]) > 20
    assert pb["ice_servers"][0]["urls"] and "credential" not in str(pb["ice_servers"])   # no permanent TURN secret
    dumped = str(done)
    assert "internal-secret-xyz" not in dumped and "rtsp://" not in dumped


def test_unbound_camera_refuses_stream(real_env):
    r = live(real_env)
    assert r.status_code == 409 and r.json()["code"] == "camera_unbound"
    assert real_env.client.get("/v1/cameras/camera-04/recordings", headers=H["viewer"]).json()["code"] == "camera_unbound"
    assert real_env.ctx.sessions.active_count("live") == 0


def test_validation_and_delivery_targets(menv):
    assert live(menv, ttl_seconds=5).json()["code"] == "ttl_out_of_range"
    assert live(menv, ttl_seconds=99999).json()["code"] == "ttl_out_of_range"
    assert menv.client.post("/v1/cameras/camera-04/live-sessions", headers=H["viewer"], json={"stream_profile": "ultra"}).status_code == 422
    r = live(menv, delivery_target="cloud_media")
    assert r.status_code == 503 and r.json()["code"] == "delivery_target_not_configured"
    assert live(menv, cam="camera-99").json()["code"] == "camera_not_found"
    assert live(menv, who="cam4", cam="camera-01").json()["code"] == "camera_not_permitted"


def test_idempotency_key(menv):
    a = live(menv, key="k-1").json()
    b = live(menv, key="k-1").json()
    assert a["session_id"] == b["session_id"]
    c = live(menv, key="k-1", profile="main")
    assert c.status_code == 409 and c.json()["code"] == "idempotency_key_conflict"
    d = live(menv, key="k-2").json()
    assert d["session_id"] != a["session_id"]


def test_gateway_authorisation_per_session_expiry_and_stop(menv):
    a = wait(menv, live(menv, "viewer").json()["status_url"], "viewer")
    ta, path = a["playback"]["token"], "live/camera-04_sub"
    assert auth(menv, ta, path)
    assert auth(menv, ta, f"{path}x") is False and auth(menv, ta, "live/camera-01_sub") is False
    assert auth(menv, "bogus-token", path) is False and auth(menv, "", path) is False
    assert auth(menv, ta, path, action="api") is False and auth(menv, ta, path, action="publish") is False
    # publishing needs the agent's internal credential
    ok = menv.client.post("/internal/media/auth", json={"action": "publish", "path": path, **PUB}).status_code
    bad = menv.client.post("/internal/media/auth", json={"action": "publish", "path": path, "user": "edge-agent", "password": "x"}).status_code
    assert (ok, bad) == (200, 401)
    api_ok = menv.client.post("/internal/media/auth", json={"action": "api", "path": "", **PUB}).status_code
    api_anon = menv.client.post("/internal/media/auth", json={"action": "api", "path": ""}).status_code
    api_viewer = menv.client.post("/internal/media/auth", json={"action": "api", "path": "", "token": ta}).status_code
    assert (api_ok, api_anon, api_viewer) == (200, 401, 401)         # a viewer token can never reach the MediaMTX API
    # another user cannot see or stop my session
    assert menv.client.get(f"/v1/live-sessions/{a['session_id']}", headers=H["viewer2"]).status_code == 403
    assert menv.client.delete(f"/v1/live-sessions/{a['session_id']}", headers=H["viewer2"]).status_code == 403
    assert auth(menv, ta, path)
    # stop => media authorisation revoked immediately
    assert menv.client.delete(f"/v1/live-sessions/{a['session_id']}", headers=H["viewer"]).json()["status"] == "stopped"
    assert auth(menv, ta, path) is False
    assert path not in menv.ctx.gateway.paths                                # last viewer left => path removed
    # expiry
    b = wait(menv, live(menv).json()["status_url"], "viewer")
    tb = b["playback"]["token"]
    menv.ctx.db.execute("UPDATE media_sessions SET expires_at=:e WHERE session_id=:i", e=to_iso(datetime.now(timezone.utc) - timedelta(seconds=1)), i=b["session_id"])
    assert auth(menv, tb, path) is False                                      # expired even before the janitor runs
    assert menv.ctx.sessions.expire_due() == 1
    assert menv.client.get(b["status_url"], headers=H["viewer"]).json()["status"] == "expired"
    assert path not in menv.ctx.gateway.paths and "playback" not in menv.client.get(b["status_url"], headers=H["viewer"]).json()


def test_shared_source_refcount_with_separate_viewer_authorisation(menv):
    a = wait(menv, live(menv, "viewer").json()["status_url"], "viewer")
    b = wait(menv, live(menv, "viewer2").json()["status_url"], "viewer2")
    assert a["playback"]["token"] != b["playback"]["token"]
    assert len(menv.stub.started) == 1                                         # one pull/publisher shared by both viewers
    path = "live/camera-04_sub"
    menv.client.delete(f"/v1/live-sessions/{a['session_id']}", headers=H["viewer"])
    assert path in menv.ctx.gateway.paths                                      # viewer2 still watching
    assert auth(menv, b["playback"]["token"], path) and not auth(menv, a["playback"]["token"], path)
    menv.client.delete(f"/v1/live-sessions/{b['session_id']}", headers=H["viewer2"])
    assert path not in menv.ctx.gateway.paths


def test_session_limits(menv):
    menv.ctx.cfg.media.max_live_sessions_per_actor = 2
    assert live(menv).status_code == 202 and live(menv).status_code == 202
    r = live(menv)
    assert r.status_code == 503 and r.json()["code"] == "session_limit_per_actor"
    menv.ctx.cfg.media.max_live_sessions = 2
    r = live(menv, who="viewer2")
    assert r.status_code == 503 and r.json()["code"] == "resource_limit"


def test_prepare_failure_is_reported_not_faked(env):
    StubProcs(env, fail_with=EdgeError("ffmpeg executable not found", code="media_tool_missing", status_code=503))
    r = live(env).json()
    done = wait(env, r["status_url"], "viewer")
    assert done["status"] == "failed" and done["error"]["code"] == "media_tool_missing" and "playback" not in done
    assert env.ctx.gateway.paths == {} or "live/camera-04_sub" not in env.ctx.gateway.paths


def test_real_nvr_without_config_fails_with_not_configured(tmp_path):
    e = build_env(tmp_path, mode="real")
    A = H["admin"]
    dep = e.client.get("/v1/mapping", headers=A).json()["deployment"]
    dep["nvrs"] = [{"nvr_id": "nvr-1", "vendor": "hikvision", "driver": "real", "timezone": "Asia/Taipei"}]
    cam = dep["cameras"][3]
    cam.update(nvr_id="nvr-1", nvr_channel="CH-A", rtsp_stream_ids={"main": "m", "sub": "s"}, live_capable=True, mapping_status="draft")
    d = e.client.get("/v1/mapping/draft", headers=A).json()
    assert e.client.put("/v1/mapping/draft", headers=A, json={"expected_revision": d["draft_revision"], "deployment": dep}).status_code == 200
    assert e.client.post("/v1/mapping/apply", headers=A, json={"expected_revision": 1}).status_code == 200
    j = live(e).json()
    done = wait(e, j["status_url"], "viewer")
    assert done["status"] == "failed" and done["error"]["code"] == "nvr_not_configured"
    assert "HIKVISION_HOST" in done["error"]["message"]                         # tells the operator what is missing
    # cameras must be stopped before their mapping can change
    e.client.__exit__(None, None, None)


# ---------------------------------------------------------------- history
def win(env, cam="camera-06", idx=0, minutes=10):
    """A window that lies inside the idx-th recording the (mock) NVR actually reports - never a guess."""
    now = datetime.now(timezone.utc)
    items = env.client.get(f"/v1/cameras/{cam}/recordings", headers=H["viewer"],
                           params={"from": to_iso(now - timedelta(days=14)), "to": to_iso(now), "limit": 50}).json()["items"]
    seg = items[idx]
    s = datetime.fromisoformat(seg["start_time"].replace("Z", "+00:00")) + timedelta(minutes=1)
    return s, s + timedelta(minutes=minutes)


def rng(env):
    return win(env)


def test_recording_search_pagination_and_empty_results(menv):
    now = datetime.now(timezone.utc)
    q = lambda cam, **kw: menv.client.get(f"/v1/cameras/{cam}/recordings", headers=H["viewer"], params=kw)  # noqa: E731
    j = q("camera-06", **{"from": to_iso(now - timedelta(days=14)), "to": to_iso(now)}).json()
    assert j["items"] and {"recording_id", "camera_id", "start_time", "end_time", "available"} <= set(j["items"][0])
    assert all("rtsp" not in str(i) for i in j["items"])                      # recording_id is opaque, no URI
    first = q("camera-06", **{"from": to_iso(now - timedelta(days=14)), "to": to_iso(now), "limit": 3}).json()
    assert len(first["items"]) == 3 and first["next_cursor"]
    second = q("camera-06", **{"from": to_iso(now - timedelta(days=14)), "to": to_iso(now), "limit": 3, "cursor": first["next_cursor"]}).json()
    assert second["items"][0]["recording_id"] != first["items"][0]["recording_id"]
    # a channel with no recordings returns nothing (no invented clips); so does a gap day
    assert q("camera-05", **{"from": to_iso(now - timedelta(days=14)), "to": to_iso(now)}).json()["items"] == []
    assert q("camera-05").json()["items"] == []                                # default range = last 14 days
    gap = (now.astimezone(timezone(timedelta(hours=8))) - timedelta(days=3)).replace(hour=0, minute=0, second=0, microsecond=0)
    assert q("camera-06", **{"from": to_iso(gap + timedelta(hours=1)), "to": to_iso(gap + timedelta(hours=7))}).json()["items"] == []
    assert q("camera-06", **{"from": to_iso(now), "to": to_iso(now - timedelta(hours=1))}).json()["code"] == "invalid_range"
    assert q("camera-06", **{"from": "2026-01-01T00:00:00"}).json()["code"] == "invalid_time"


def pb(env, who="viewer", cam="camera-06", start=None, end=None, key=None, **kw):
    s, e = win(env, cam) if start is None else (start, end)
    h = {**H[who], **({"Idempotency-Key": key} if key else {})}
    return env.client.post(f"/v1/cameras/{cam}/playback-sessions", headers=h,
                           json={"start_time": to_iso(s), "end_time": to_iso(e), **kw})


def test_playback_without_recording_creates_no_session(menv):
    n = datetime.now(timezone.utc) - timedelta(days=1)
    r = pb(menv, cam="camera-05", start=n, end=n + timedelta(minutes=10))
    assert r.status_code == 404 and r.json()["code"] == "no_recording"
    gap_day = datetime.now(timezone.utc) - timedelta(days=3)
    s = gap_day.astimezone(timezone(timedelta(hours=8))).replace(hour=1, minute=0, second=0, microsecond=0)
    assert pb(menv, start=s, end=s + timedelta(hours=2)).json()["code"] == "no_recording"
    assert menv.ctx.sessions.active_count("playback") == 0 and menv.stub.started == []


def test_playback_sessions_are_isolated_per_user_and_cleaned_up(menv):
    (sa, ea), (sb, eb), (sc, ec) = win(menv, idx=0), win(menv, idx=1), win(menv, idx=2)
    a = pb(menv, "viewer", start=sa, end=ea)
    assert a.status_code == 202, a.text
    a = a.json()
    b = pb(menv, "viewer2", start=sb, end=eb).json()
    assert a["session_id"] != b["session_id"]
    ra, rb = wait(menv, a["status_url"], "viewer"), wait(menv, b["status_url"], "viewer2")
    assert ra["status"] == rb["status"] == "ready" and ra["kind"] == "playback"
    pa, pbk = ra["playback"], rb["playback"]
    assert pa["url"] != pbk["url"] and pa["url"].split("/")[-2] == a["session_id"]
    assert not auth(menv, pa["token"], f"playback/{b['session_id']}")          # A's token cannot read B's playback
    assert menv.client.get(b["status_url"], headers=H["viewer"]).status_code == 403
    assert menv.client.delete(b["status_url"], headers=H["viewer"]).status_code == 403
    assert ra["params"]["start_time"] and ra["params"]["coverage"] > 0
    # "seek" = stop and create another session at a new start time; the old path disappears
    menv.client.delete(a["status_url"], headers=H["viewer"])
    assert f"playback/{a['session_id']}" not in menv.ctx.gateway.paths and not auth(menv, pa["token"], f"playback/{a['session_id']}")
    a2 = pb(menv, "viewer", start=sc, end=ec).json()
    assert a2["session_id"] != a["session_id"]
    jobs = [j for j, _, _ in menv.stub.started]
    assert len(set(jobs)) == len(jobs) == 3                                     # one pipeline per session, never shared


def test_playback_limits_and_validation(menv):
    s, e = win(menv)
    assert pb(menv, start=e, end=s).json()["code"] == "invalid_range"
    assert pb(menv, start=s, end=s + timedelta(hours=9)).json()["code"] == "range_too_large"
    assert pb(menv, delivery_target="cloud_media").json()["code"] == "delivery_target_not_configured"
    assert pb(menv, ttl_seconds=1).json()["code"] == "ttl_out_of_range"
    menv.ctx.cfg.media.max_playback_sessions_per_actor = 1
    assert pb(menv).status_code == 202
    assert pb(menv).json()["code"] == "session_limit_per_actor"
    assert menv.client.post("/v1/cameras/camera-06/playback-sessions", headers=H["viewer"],
                            json={"start_time": "2026-11-12T10:00:00", "end_time": "2026-11-12T10:10:00"}).status_code == 422


def test_camera_mapping_change_blocked_while_sessions_active(menv):
    wait(menv, live(menv, cam="camera-04").json()["status_url"], "viewer")
    A = H["admin"]
    dep = menv.client.get("/v1/mapping", headers=A).json()["deployment"]
    next(c for c in dep["cameras"] if c["camera_id"] == "camera-04")["note"] = "changed"
    d = menv.client.get("/v1/mapping/draft", headers=A).json()
    menv.client.put("/v1/mapping/draft", headers=A, json={"expected_revision": d["draft_revision"], "deployment": dep})
    r = menv.client.post("/v1/mapping/apply", headers=A, json={"expected_revision": 1})
    assert r.status_code == 409 and r.json()["code"] == "mapping_active_sessions" and r.json()["details"]["cameras"] == ["camera-04"]


def test_restart_ends_open_sessions(tmp_path):
    e = build_env(tmp_path)
    StubProcs(e)
    s = wait(e, live(e).json()["status_url"], "viewer")
    assert s["status"] == "ready"
    assert e.ctx.sessions.recover_after_restart() == 1
    assert e.client.get(s["status_url"], headers=H["viewer"]).json()["status"] == "stopped"
    e.client.__exit__(None, None, None)
