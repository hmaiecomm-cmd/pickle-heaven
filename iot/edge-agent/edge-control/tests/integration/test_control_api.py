import threading
import time
from datetime import datetime, timedelta, timezone

import pytest

from edge_control.config.settings import Settings
from edge_control.errors import NotConfigured
from tests.conftest import H, build_env, cid, future


def relay(env, who, circuit, state, command_id=None, expires=None):
    return env.client.put(f"/v1/relay/circuits/{circuit}/state", headers=H[who],
                          json={"command_id": command_id or cid(), "expires_at": expires or future(), "state": state})


# ---------------------------------------------------------------- auth / permissions
def test_unauthorized_requests_rejected(env):
    for method, url in [("get", "/v1/relay/circuits"), ("get", "/v1/cameras"), ("get", "/v1/system/status"),
                        ("get", "/v1/commands/x"), ("get", "/v1/mapping")]:
        r = getattr(env.client, method)(url)
        assert r.status_code == 401, url
        assert set(r.json()) == {"code", "message", "request_id", "details"}
    assert env.client.get("/v1/relay/circuits", headers={"Authorization": "Bearer nope-nope-nope"}).status_code == 401


def test_service_refuses_to_start_without_credentials(tmp_path):
    with pytest.raises(NotConfigured):
        build_env(tmp_path, tokens=[])


def test_viewer_cannot_control_operator_can_admin_only_for_mapping(env):
    assert env.client.get("/v1/relay/circuits", headers=H["viewer"]).status_code == 200
    r = relay(env, "viewer", "circuit-01", "on")
    assert r.status_code == 403 and r.json()["code"] == "insufficient_role"
    assert env.client.patch("/v1/hvac/hvac-1/settings", headers=H["viewer"],
                            json={"command_id": cid(), "expires_at": future(), "power": True}).status_code == 403
    assert env.client.post("/v1/access/door-1/unlock", headers=H["viewer"],
                           json={"command_id": cid(), "expires_at": future()}).status_code == 403
    assert relay(env, "operator", "circuit-01", "on").status_code == 202
    assert env.client.get("/v1/mapping", headers=H["operator"]).status_code == 403
    assert env.client.get("/v1/mapping", headers=H["admin"]).status_code == 200


def test_site_and_edge_identity_not_trusted_from_client(env):
    r = env.client.put("/v1/relay/circuits/circuit-01/state", headers=H["operator"],
                       json={"command_id": cid(), "expires_at": future(), "state": "on", "site_id": "other-site"})
    assert r.status_code == 403 and r.json()["code"] == "site_mismatch"
    r = env.client.get("/v1/relay/circuits", headers={**H["viewer"], "X-Edge-Id": "someone-else"})
    assert r.status_code == 403


def test_cookie_session_flow_requires_csrf_header_and_hides_token(env):
    r = env.client.post("/v1/auth/login", json={"token": "operator-token-123"})
    assert r.status_code == 200 and "operator-token-123" not in r.text
    assert "httponly" in r.headers["set-cookie"].lower() and "samesite=strict" in r.headers["set-cookie"].lower()
    body = {"command_id": cid(), "expires_at": future(), "state": "on"}
    c = env.client  # cookie jar retains the session
    c.headers.pop("Authorization", None)
    assert c.put("/v1/relay/circuits/circuit-01/state", json=body).status_code == 403  # no CSRF header
    assert c.put("/v1/relay/circuits/circuit-01/state", json=body, headers={"X-Requested-With": "edge-web"}).status_code == 202
    assert c.get("/v1/auth/me").json()["role"] == "operator"
    assert env.client.post("/v1/auth/login", json={"token": "wrong-token-1"}).status_code == 401


# ---------------------------------------------------------------- relay: 18 circuits, mock switching, policy
def test_18_circuits_listed_with_policy_and_operability(env):
    j = env.client.get("/v1/relay/circuits", headers=H["viewer"]).json()
    cs = j["circuits"]
    assert j["count"] == 18 and [c["circuit_id"] for c in cs] == [f"circuit-{i:02d}" for i in range(1, 19)]
    by = {c["circuit_id"]: c for c in cs}
    assert all(by[f"circuit-{i:02d}"]["operable"] for i in range(1, 12))
    for i in range(12, 17):
        c = by[f"circuit-{i}"]
        assert not c["operable"] and c["inoperable_code"] == "circuit_always_on_protected"
        assert c["supply"]["confirmed"] is False and c["supply"]["display"] == "未確認"
    for i in (17, 18):
        assert by[f"circuit-{i}"]["inoperable_code"] == "circuit_reserved"
    assert by["circuit-09"]["issue"]
    assert j["simulation_mapping"] is True


def test_mock_switch_all_switchable_circuits_and_state_is_unverified(env):
    ids = []
    for i in range(1, 12):
        r = relay(env, "operator", f"circuit-{i:02d}", "on")
        assert r.status_code == 202, r.text
        ids.append(r.json()["command_id"])
    env.drain()
    for c in ids:
        cmd = env.client.get(f"/v1/commands/{c}", headers=H["viewer"]).json()
        assert cmd["status"] == "succeeded"
        assert cmd["verification"] == "unverified" and cmd["simulated"] is True and cmd["driver_mode"] == "mock"
    st = env.client.get("/v1/relay/circuits", headers=H["viewer"]).json()["circuits"][0]["state"]
    assert st["requested"] == {"on": True} and st["verification"] == "unverified"


@pytest.mark.parametrize("circuit,code", [("circuit-12", "circuit_always_on_protected"), ("circuit-14", "circuit_always_on_protected"),
                                          ("circuit-16", "circuit_always_on_protected"), ("circuit-17", "circuit_reserved"),
                                          ("circuit-18", "circuit_reserved")])
def test_protected_and_reserved_circuits_reject_writes(env, circuit, code):
    for state in ("on", "off"):
        r = relay(env, "operator", circuit, state)
        assert r.status_code == 409 and r.json()["code"] == code
    assert env.ctx.commands.list_recent() == []  # nothing queued


def test_unknown_circuit_404(env):
    assert relay(env, "operator", "circuit-99", "on").status_code == 404


def test_batch_all_off_skips_bypass_and_reserved(env):
    r = env.client.post("/v1/relay/batch", headers=H["operator"],
                        json={"command_id": cid("batch"), "expires_at": future(), "circuit_ids": "all", "state": "off"})
    assert r.status_code == 202
    j = r.json()
    assert {s["circuit_id"] for s in j["submitted"]} == {f"circuit-{i:02d}" for i in range(1, 12)}
    skipped = {s["circuit_id"]: s["code"] for s in j["skipped"]}
    assert set(skipped) == {f"circuit-{i}" for i in range(12, 19)}


def test_unbound_real_mapping_rejects_everything(real_env):
    for i in (1, 5, 9, 11):
        r = relay(real_env, "operator", f"circuit-{i:02d}", "on")
        assert r.status_code == 409 and r.json()["code"] == "circuit_unbound"
    cs = real_env.client.get("/v1/relay/circuits", headers=H["viewer"]).json()
    assert cs["simulation_mapping"] is False
    assert all(c["binding"]["controller_id"] is None and c["binding"]["physical_output_channel"] is None
               and c["binding"]["mapping_status"] == "unbound" for c in cs["circuits"])
    assert all(c["binding"]["modbus"] is None and c["binding"]["hardware_verified_at"] is None for c in cs["circuits"])


# ---------------------------------------------------------------- commands: dedupe, expiry, errors
def test_same_command_id_same_content_not_executed_twice(env):
    body = {"command_id": "door-open-0001", "expires_at": future(), }
    a = env.client.post("/v1/access/door-1/unlock", headers=H["operator"], json=body)
    b = env.client.post("/v1/access/door-1/unlock", headers=H["operator"], json=body)
    assert a.status_code == b.status_code == 202 and b.json()["replay"] is True
    env.drain()
    c = env.client.post("/v1/access/door-1/unlock", headers=H["operator"], json=body)
    assert c.json()["status"] == "succeeded"
    _, drv = env.ctx.registry.access_for_door("door-1")
    assert drv.unlock_count == 1
    got = env.client.get("/v1/commands/door-open-0001", headers=H["viewer"]).json()
    assert got["status"] == "succeeded" and got["verification"] == "unverified" and got["reported_state"]["door_contact"] == "unknown"


def test_same_command_id_different_payload_is_409(env):
    exp = future()
    assert relay(env, "operator", "circuit-01", "on", "cmd-conflict-1", exp).status_code == 202
    r = relay(env, "operator", "circuit-01", "off", "cmd-conflict-1", exp)
    assert r.status_code == 409 and r.json()["code"] == "command_id_conflict"
    r = relay(env, "operator", "circuit-02", "on", "cmd-conflict-1", exp)
    assert r.status_code == 409


def test_dedupe_is_enforced_by_database_under_concurrency(env):
    body = {"command_id": "race-cmd-0001", "expires_at": future(), "state": "on"}
    res = []

    def go():
        res.append(env.client.put("/v1/relay/circuits/circuit-01/state", headers=H["operator"], json=body).status_code)
    ts = [threading.Thread(target=go) for _ in range(8)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    assert set(res) == {202}
    assert len(env.ctx.commands.list_recent()) == 1


def test_expired_command_is_not_executed(env):
    exp = (datetime.now(timezone.utc) + timedelta(milliseconds=300)).isoformat()
    r = relay(env, "operator", "circuit-01", "on", expires=exp)
    assert r.status_code == 202
    time.sleep(0.5)
    env.drain()
    cmd = env.client.get(f"/v1/commands/{r.json()['command_id']}", headers=H["viewer"]).json()
    assert cmd["status"] == "expired" and cmd["error"]["code"] == "command_expired"
    assert env.ctx.registry.relay_driver(env.ctx.policy.resolve("circuit-01").controller).writes == []


def test_expiry_too_far_rejected_and_validation_errors_use_standard_format(env):
    far = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    assert relay(env, "operator", "circuit-01", "on", expires=far).json()["code"] == "expires_too_far"
    r = env.client.put("/v1/relay/circuits/circuit-01/state", headers=H["operator"], json={"state": "on"})
    assert r.status_code == 422 and r.json()["code"] == "invalid_request"
    r = env.client.put("/v1/relay/circuits/circuit-01/state", headers=H["operator"],
                       json={"command_id": cid(), "expires_at": "2026-01-01T00:00:00", "state": "on"})
    assert r.status_code == 422  # naive timestamps are rejected: timezone is mandatory


# ---------------------------------------------------------------- hardware faults: unknown vs failed
def _relay_driver(env):
    return env.ctx.registry.relay_driver(env.ctx.policy.resolve("circuit-01").controller)


def test_timeout_after_send_is_unknown_and_never_confirmed(env):
    _relay_driver(env).faults.set("timeout")
    r = relay(env, "operator", "circuit-01", "on")
    env.drain()
    cmd = env.client.get(f"/v1/commands/{r.json()['command_id']}", headers=H["viewer"]).json()
    assert cmd["status"] == "unknown" and cmd["verification"] == "unknown" and cmd["error"]["code"] == "device_timeout"
    st = env.ctx.states.get("circuit-01")
    assert st["verification"] == "unknown" and st["reported_state"] is None


def test_offline_and_execution_error_are_failed(env):
    drv = _relay_driver(env)
    for mode, code in (("offline", "device_offline"), ("error", "device_execution_failed")):
        drv.faults.set(mode)
        r = relay(env, "operator", "circuit-01", "on")
        env.drain()
        cmd = env.client.get(f"/v1/commands/{r.json()['command_id']}", headers=H["viewer"]).json()
        assert cmd["status"] == "failed" and cmd["error"]["code"] == code


def test_unlock_timeout_is_unknown_and_not_retried(env):
    _, drv = env.ctx.registry.access_for_door("door-1")
    drv.faults.set("timeout")
    r = env.client.post("/v1/access/door-1/unlock", headers=H["operator"], json={"command_id": cid(), "expires_at": future()})
    env.drain()
    assert env.client.get(f"/v1/commands/{r.json()['command_id']}", headers=H["viewer"]).json()["status"] == "unknown"
    assert len([c for c, _ in drv.faults.calls if c.startswith("unlock")]) == 1


# ---------------------------------------------------------------- restart recovery
def test_restart_does_not_replay_non_idempotent_commands(tmp_path):
    e1 = build_env(tmp_path)
    repo = e1.ctx.commands
    repo.create(command_id="unlock-running-1", type_="access.unlock", target_id="door-1", bus_id=None, payload={"unlock": True},
                expires_at=future(), actor="op1", idempotent=False, requested_state={"unlock": True})
    repo.create(command_id="relay-sent-1", type_="relay.set_state", target_id="circuit-01", bus_id=None, payload={"on": True},
                expires_at=future(), actor="op1", requested_state={"on": True})
    repo.create(command_id="relay-unsent-1", type_="relay.set_state", target_id="circuit-02", bus_id=None, payload={"on": True},
                expires_at=future(), actor="op1", requested_state={"on": True})
    repo.claim_next(); repo.claim_next(); repo.claim_next()   # all three are 'running' when the "crash" happens
    repo.mark_sent("relay-sent-1")
    e1.client.__exit__(None, None, None)
    e2 = build_env.__wrapped__(tmp_path) if hasattr(build_env, "__wrapped__") else None
    # second boot on the same data dir (config dir already copied -> reuse settings manually)
    from edge_control.api.app import create_app
    from edge_control.context import AppContext
    from edge_control.media.gateway_client import FakeGateway
    s = Settings(config_dir=tmp_path / "config", data_dir=tmp_path / "data", cache_dir=tmp_path / "cache",
                 auth_tokens=e1.ctx.settings.auth_tokens, background_workers=False, media_backend="mock",
                 media_internal_secret="x" * 10, _env_file=None)
    ctx2 = AppContext(s, gateway=FakeGateway())
    out = ctx2.recover()
    assert out["commands"] == {"requeued": 1, "unknown": 2}
    assert ctx2.commands.get("unlock-running-1")["status"] == "unknown"
    assert ctx2.commands.get("unlock-running-1")["error_code"] == "interrupted_by_restart"
    assert ctx2.commands.get("relay-sent-1")["status"] == "unknown"
    assert ctx2.commands.get("relay-unsent-1")["status"] == "accepted"  # never reached the device: safe to queue again
    _, drv = ctx2.registry.access_for_door("door-1")
    ctx2.worker.run_pending()
    assert drv.unlock_count == 0
    ctx2.db.dispose()


# ---------------------------------------------------------------- HVAC
def test_hvac_validation_and_mock_state_update(env):
    base = {"expires_at": future()}
    ok = env.client.patch("/v1/hvac/hvac-1/settings", headers=H["operator"],
                          json={**base, "command_id": cid(), "power": True, "setpoint_c": 24, "mode": "cool"})
    assert ok.status_code == 202
    env.drain()
    cmd = env.client.get(f"/v1/commands/{ok.json()['command_id']}", headers=H["viewer"]).json()
    assert cmd["status"] == "succeeded" and cmd["reported_state"]["setpoint_c"] == 24 and cmd["reported_state"]["power"] is True
    st = env.client.get("/v1/hvac/hvac-1/state?refresh=true", headers=H["viewer"]).json()
    assert st["simulated"] is True and st["live_read"]["setpoint_c"] == 24
    r = env.client.patch("/v1/hvac/hvac-1/settings", headers=H["operator"], json={**base, "command_id": cid(), "setpoint_c": 99})
    assert r.status_code == 422 and r.json()["code"] == "setpoint_out_of_range"
    r = env.client.patch("/v1/hvac/hvac-1/settings", headers=H["operator"], json={**base, "command_id": cid(), "fan": "high"})
    assert r.status_code == 501 and r.json()["code"] == "unsupported_feature"   # explicit unsupported, not silent
    r = env.client.patch("/v1/hvac/hvac-1/settings", headers=H["operator"], json={**base, "command_id": cid(), "mode": "turbo"})
    assert r.json()["code"] == "unsupported_feature"
    assert env.client.patch("/v1/hvac/nope/settings", headers=H["operator"], json={**base, "command_id": cid(), "power": True}).status_code == 404


def test_real_hvac_driver_without_protocol_reports_not_configured(tmp_path):
    devices = ("devices:\n  - {device_id: hvac-1, kind: hvac, driver: real}\n"
               "  - {device_id: access-1, kind: access, driver: real, doors: [door-1]}\n")
    e = build_env(tmp_path, config_overrides={"devices.yaml": devices})
    r = e.client.patch("/v1/hvac/hvac-1/settings", headers=H["operator"], json={"command_id": cid(), "expires_at": future(), "power": True})
    assert r.status_code == 202
    e.drain()
    cmd = e.client.get(f"/v1/commands/{r.json()['command_id']}", headers=H["viewer"]).json()
    assert cmd["status"] == "failed" and cmd["error"]["code"] == "driver_not_configured" and cmd["simulated"] is False
    r = e.client.post("/v1/access/door-1/unlock", headers=H["operator"], json={"command_id": cid(), "expires_at": future()})
    e.drain()
    assert e.client.get(f"/v1/commands/{r.json()['command_id']}", headers=H["viewer"]).json()["error"]["code"] == "driver_not_configured"
    e.client.__exit__(None, None, None)


# ---------------------------------------------------------------- scheduler reconciliation uses the same gate
def test_reconciler_drives_reservation_circuits_through_commands_and_skips_bypass(env):
    now = datetime.now(timezone.utc)
    env.client.post("/v1/cloud/bookings", headers=H["operator"], json={"events": [
        {"booking_id": "b1", "court": "court_a", "start": (now - timedelta(minutes=5)).isoformat(), "end": (now + timedelta(hours=1)).isoformat(), "revision": 1}]})
    issued = env.ctx.reconciler.run_once()
    env.drain()
    cmds = {c["target_id"]: c for c in env.ctx.commands.list_recent(100)}
    assert cmds["circuit-01"]["requested_state"] == {"on": True} and cmds["circuit-01"]["source"] == "scheduler"
    assert cmds["circuit-02"]["status"] == "succeeded"
    assert not any(t in cmds for t in ("circuit-12", "circuit-13", "circuit-14", "circuit-15", "circuit-16", "circuit-17", "circuit-18"))
    assert "circuit-03" not in cmds or cmds["circuit-03"]["requested_state"] == {"on": False}
    # stale/replayed booking revisions are ignored
    r = env.client.post("/v1/cloud/bookings", headers=H["operator"], json={"events": [
        {"booking_id": "b1", "court": "court_a", "start": now.isoformat(), "end": (now + timedelta(minutes=1)).isoformat(), "revision": 1}]})
    assert r.json()["applied"] == 0
