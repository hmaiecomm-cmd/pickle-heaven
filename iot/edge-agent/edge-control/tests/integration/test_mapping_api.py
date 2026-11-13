"""Deployment-mapping: draft -> validate -> diff -> apply -> versions -> rollback, optimistic revisions, no hardware I/O."""
import copy

from tests.conftest import H, cid, future

A = H["admin"]


def get_draft(env):
    return env.client.get("/v1/mapping/draft", headers=A).json()


def put_draft(env, dep, expected=None):
    d = get_draft(env)
    return env.client.put("/v1/mapping/draft", headers=A, json={"expected_revision": d["draft_revision"] if expected is None else expected,
                                                                 "deployment": dep})


def real_dep(env):
    return env.client.get("/v1/mapping", headers=A).json()["deployment"]   # always start from the ACTIVE mapping


def good_modbus_dep(env):
    dep = real_dep(env)
    dep["buses"] = [{"bus_id": "bus-r", "serial_path": "/dev/serial/by-id/usb-TEST-if00", "baudrate": 9600, "parity": "N",
                     "data_bits": 8, "stop_bits": 1, "timeout_s": 1.0, "protocol_profile": "modbus_rtu"}]
    dep["controllers"] = [{"controller_id": "ctrl-1", "kind": "relay_controller", "protocol": "modbus_m7000", "bus_id": "bus-r",
                           "node_id": 3, "do_count": 4, "model_confirmed": True, "modbus_functions": [1, 5], "firmware": "210",
                           "vendor": "TEST", "model": "TEST-DIO"}]
    c1 = next(c for c in dep["circuits"] if c["circuit_id"] == "circuit-01")
    c1.update(wiring_mode="relay_switched", controller_id="ctrl-1", physical_output_channel=1, active_polarity="high",
              mapping_status="draft", modbus={"table_type": "coil", "reference_address": "00001", "base": 1,
                                              "read_function": 1, "write_function": 5})
    return dep


def codes(rep, level="errors"):
    return {i["code"] for i in rep[level]}


def test_all_18_start_unbound_in_real_mode(real_env):
    d = real_env.client.get("/v1/mapping", headers=A).json()["deployment"]
    assert len(d["circuits"]) == 18 and d["simulation_only"] is False
    for c in d["circuits"]:
        assert c["controller_id"] is None and c["physical_output_channel"] is None and c["modbus"] is None and c["soyal"] is None
        assert c["mapping_status"] == "unbound" and c["hardware_verified_at"] is None and c["verified_by"] is None
    assert len(d["cameras"]) == 6 and all(c["nvr_channel"] is None and c["mapping_status"] == "unbound" for c in d["cameras"])


def test_mock_mapping_is_flagged_simulation_only(env):
    d = env.client.get("/v1/mapping", headers=A).json()["deployment"]
    assert d["simulation_only"] is True and all(c["simulation_only"] for c in d["controllers"])
    bound = [c for c in d["circuits"] if c["controller_id"]]
    assert len(bound) == 11 and all("SIMULATION" in c["note"] for c in bound)


def test_full_flow_and_revision_conflicts(real_env):
    e = real_env
    dep = good_modbus_dep(e)
    r = put_draft(e, dep)
    assert r.status_code == 200
    v = e.client.post("/v1/mapping/draft/validate", headers=A).json()
    assert v["ok"], v["errors"]
    assert next(c for c in v["normalized"]["circuits"] if c["circuit_id"] == "circuit-01")["mapping_status"] == "validated"
    assert "hardware_untested" in codes(v, "pending")
    diff = e.client.get("/v1/mapping/draft/diff", headers=A).json()
    assert {(c["section"], c["id"]) for c in diff["changes"]} >= {("buses", "bus-r"), ("controllers", "ctrl-1"), ("circuits", "circuit-01")}
    # stale draft revision => 409
    stale = put_draft(e, dep, expected=0)
    assert stale.status_code == 409 and stale.json()["code"] == "revision_conflict"
    # wrong active revision => 409
    assert e.client.post("/v1/mapping/apply", headers=A, json={"expected_revision": 99}).json()["code"] == "revision_conflict"
    before = len(e.ctx.commands.list_recent())
    ap = e.client.post("/v1/mapping/apply", headers=A, json={"expected_revision": 1, "comment": "first"})
    assert ap.status_code == 200 and ap.json()["revision"] == 2 and ap.json()["hardware_commands_sent"] == 0
    assert len(e.ctx.commands.list_recent()) == before   # applying emits no control command
    row = next(c for c in e.client.get("/v1/relay/circuits", headers=H["viewer"]).json()["circuits"] if c["circuit_id"] == "circuit-01")
    assert row["binding"]["mapping_status"] == "active" and row["binding"]["modbus"]["pdu_offset"] == 0
    assert row["binding"]["hardware_verified_at"] is None
    # versions + rollback (rollback only changes configuration)
    vs = e.client.get("/v1/mapping/versions", headers=A).json()
    assert vs["active_revision"] == 2 and [x["revision"] for x in vs["versions"]] == [2, 1]
    rb = e.client.post("/v1/mapping/rollback", headers=A, json={"revision": 1, "expected_revision": 2})
    assert rb.status_code == 200 and rb.json()["revision"] == 3 and rb.json()["hardware_commands_sent"] == 0
    assert e.client.get("/v1/mapping", headers=A).json()["deployment"]["circuits"][0]["controller_id"] is None
    assert len(e.ctx.commands.list_recent()) == before
    # audit trail
    actions = [a["action"] for a in e.client.get("/v1/audit?limit=50", headers=A).json()["items"]]
    assert {"mapping.draft.save", "mapping.validate", "mapping.apply", "mapping.rollback"} <= set(actions)


def test_apply_refused_while_bus_has_inflight_commands(real_env):
    e = real_env
    # first activate a mapping
    put_draft(e, good_modbus_dep(e)); e.client.post("/v1/mapping/apply", headers=A, json={"expected_revision": 1})
    # new draft changes that circuit's channel; meanwhile a command is queued on the same bus
    dep = real_dep(e)
    next(c for c in dep["circuits"] if c["circuit_id"] == "circuit-01")["note"] = "changed"
    put_draft(e, dep)
    e.ctx.commands.create(command_id="inflight-0001", type_="relay.set_state", target_id="circuit-01", bus_id="bus-r",
                          payload={"on": True}, expires_at=future(), actor="op1")
    r = e.client.post("/v1/mapping/apply", headers=A, json={"expected_revision": 2})
    assert r.status_code == 409 and r.json()["code"] == "mapping_busy_bus"
    e.ctx.commands.finish("inflight-0001", "failed", error_code="x")
    assert e.client.post("/v1/mapping/apply", headers=A, json={"expected_revision": 2}).status_code == 200


def test_validation_rules(real_env):
    e = real_env

    def check(mutate):
        dep = good_modbus_dep(e)
        mutate(dep)
        put_draft(e, dep)
        return e.client.post("/v1/mapping/draft/validate", headers=A).json()

    c = lambda dep, n=1: next(x for x in dep["circuits"] if x["circuit_id"] == f"circuit-{n:02d}")  # noqa: E731
    # table / base / forbidden addresses
    assert "address_forbidden" in codes(check(lambda d: c(d)["modbus"].update(reference_address="00129")))     # safe value
    assert "address_forbidden" in codes(check(lambda d: c(d)["modbus"].update(reference_address="00257")))     # firmware-specific bit
    assert "bad_address" in codes(check(lambda d: c(d)["modbus"].update(reference_address="40485")))           # holding != coil
    assert "bad_function" in codes(check(lambda d: c(d)["modbus"].update(write_function=6)))
    assert "function_unconfirmed" in codes(check(lambda d: c(d)["modbus"].update(write_function=15)))
    assert "channel_address_mismatch" in codes(check(lambda d: c(d).update(physical_output_channel=2)))
    assert "missing_channel" in codes(check(lambda d: (c(d).update(physical_output_channel=5), c(d)["modbus"].update(reference_address="00005"))))
    # model not confirmed / profile mixing
    assert "model_unconfirmed" in codes(check(lambda d: d["controllers"][0].update(model_confirmed=False)))
    assert "profile_mixed" in codes(check(lambda d: d["buses"][0].update(protocol_profile="soyal_binary")))
    # duplicate output
    def dup(d):
        c2 = c(d, 2)
        c2.update(wiring_mode="relay_switched", controller_id="ctrl-1", physical_output_channel=1, active_polarity="high",
                  mapping_status="draft", modbus=copy.deepcopy(c(d)["modbus"]))
    assert "duplicate_output" in codes(check(dup))
    # bypass / reserved can never be bound
    def bind_bypass(d):
        c(d, 12).update(controller_id="ctrl-1", physical_output_channel=2, mapping_status="draft")
    assert "bypass_output_bound" in codes(check(bind_bypass))
    def bind_reserved(d):
        c(d, 17).update(controller_id="ctrl-1", physical_output_channel=3, mapping_status="draft")
    assert "reserved_bound" in codes(check(bind_reserved))
    # SOYAL and Modbus on the same bus / same serial path
    def mix(d):
        d["controllers"].append({"controller_id": "door-c", "kind": "access", "protocol": "soyal_721_727", "bus_id": "bus-r", "node_id": 4, "model_confirmed": True})
    assert "bus_protocol_mixed" in codes(check(mix))
    def shared_port(d):
        d["buses"].append({**d["buses"][0], "bus_id": "bus-r2", "baudrate": 19200})
    assert "serial_path_shared" in codes(check(shared_port))
    def dup_node(d):
        d["controllers"].append({**d["controllers"][0], "controller_id": "ctrl-2"})
    assert "duplicate_node" in codes(check(dup_node))
    # unmodified good draft validates
    assert check(lambda d: None)["ok"]


def test_apply_blocked_when_validation_fails(real_env):
    e = real_env
    dep = good_modbus_dep(e)
    next(x for x in dep["circuits"] if x["circuit_id"] == "circuit-01")["modbus"]["reference_address"] = "00129"
    put_draft(e, dep)
    r = e.client.post("/v1/mapping/apply", headers=A, json={"expected_revision": 1})
    assert r.status_code == 422 and r.json()["code"] == "validation_failed"
    assert e.client.get("/v1/mapping", headers=A).json()["revision"] == 1


def test_camera_mapping_rules(real_env):
    e = real_env
    dep = real_dep(e)
    dep["nvrs"] = [{"nvr_id": "nvr-1", "vendor": "hikvision", "timezone": "Asia/Taipei", "driver": "real"}]
    cams = {c["camera_id"]: c for c in dep["cameras"]}
    for cid_ in ("camera-04", "camera-06"):
        cams[cid_].update(nvr_id="nvr-1", nvr_channel="X", rtsp_stream_ids={"main": "m", "sub": "s"}, live_capable=True, mapping_status="draft")
    put_draft(e, dep)
    v = e.client.post("/v1/mapping/draft/validate", headers=A).json()
    assert "duplicate_channel" in codes(v)           # same channel bound to two cameras without explicit intent
    cams["camera-06"]["duplicate_intent_confirmed"] = True
    put_draft(e, dep)
    v = e.client.post("/v1/mapping/draft/validate", headers=A).json()
    assert v["ok"] and {"live_unverified", "history_unverified"} <= codes(v, "pending")
    # search capability needs a track id / sdk id; live-only does not imply history
    cams["camera-04"].update(search_capable=True)
    put_draft(e, dep)
    assert "search_id_missing" in codes(e.client.post("/v1/mapping/draft/validate", headers=A).json())


def test_export_import_creates_draft_only(real_env):
    e = real_env
    txt = e.client.get("/v1/mapping/export?format=yaml", headers=A).text
    assert "circuits:" in txt and "simulation_only: false" in txt
    d = get_draft(e)
    r = e.client.post("/v1/mapping/import", headers=A, json={"format": "yaml", "content": txt, "expected_revision": d["draft_revision"]})
    assert r.status_code == 200 and r.json()["exists"] is True
    assert e.client.post("/v1/mapping/import", headers=A, json={"format": "json", "content": "{bad", "expected_revision": 5}).status_code == 422
    assert e.client.get("/v1/mapping", headers=A).json()["revision"] == 1


def test_address_preview_and_test_write_guards(env):
    p = env.client.post("/v1/mapping/address-preview", headers=A, json={"table_type": "holding_register", "reference_address": "40485"}).json()
    assert p["pdu_offset"] == 484 and p["write_functions"] == [6, 16]
    p = env.client.post("/v1/mapping/address-preview", headers=A, json={"table_type": "coil", "reference_address": "00016"}).json()
    assert p["pdu_offset"] == 15
    assert env.client.post("/v1/mapping/address-preview", headers=A, json={"table_type": "coil", "reference_address": "40485"}).status_code == 422
    body = {"command_id": cid(), "state": "on", "confirm_circuit_id": "circuit-01", "expires_at": future()}
    r = env.client.post("/v1/mapping/circuits/circuit-01/test-write", headers=A, json=body)
    assert r.status_code == 409 and r.json()["code"] == "maintenance_mode_required"       # off by default
    env.ctx.cfg.policies.maintenance_mode = True
    bad = env.client.post("/v1/mapping/circuits/circuit-01/test-write", headers=A, json={**body, "confirm_circuit_id": "circuit-02"})
    assert bad.status_code == 422
    for cid_ in ("circuit-12", "circuit-17"):    # bypass / reserved can never be test-written
        rr = env.client.post(f"/v1/mapping/circuits/{cid_}/test-write", headers=A, json={**body, "confirm_circuit_id": cid_, "command_id": cid()})
        assert rr.status_code == 409
    assert env.client.post("/v1/mapping/circuits/circuit-01/read-state", headers=A).status_code == 200
    # operator cannot use the maintenance endpoints
    assert env.client.post("/v1/mapping/circuits/circuit-01/test-write", headers=H["operator"], json=body).status_code == 403
