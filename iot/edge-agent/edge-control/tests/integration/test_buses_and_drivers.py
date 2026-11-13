"""Bus serialisation through the real command pipeline, real-driver adapters against fake transports, secret hygiene."""
import json
import threading
import time

import pytest

from edge_control.config.schema import BusDef, CircuitBinding, ControllerDef, DeviceConfig, ModbusBinding
from edge_control.drivers.access import soyal_frame as sf
from edge_control.drivers.access.vendor_driver import SoyalAccessDriver
from edge_control.drivers.base.relay_driver import OutputTarget
from edge_control.drivers.relay.modbus_driver import ModbusM7000RelayDriver
from edge_control.errors import DeviceError, DeviceTimeout, NotConfigured, Unsupported
from tests.conftest import H, cid, future


def test_commands_on_one_bus_never_overlap_while_two_buses_overlap(env):
    hv = env.ctx.registry.hvac("hvac-1")[1]            # bus mock-bus-hvac
    _, ac = env.ctx.registry.access_for_door("door-1")  # bus mock-bus-access
    hv.faults.set(None, 0.12)
    ac.faults.set(None, 0.12)
    for i in range(3):
        env.client.patch("/v1/hvac/hvac-1/settings", headers=H["operator"],
                         json={"command_id": cid(), "expires_at": future(), "setpoint_c": 20 + i})
        env.client.post("/v1/access/door-1/unlock", headers=H["operator"], json={"command_id": cid(), "expires_at": future()})
    t0 = time.time()
    env.ctx.worker.run_pending(timeout=20)
    elapsed = time.time() - t0
    assert env.ctx.buses.peak["mock-bus-hvac"] == 1 and env.ctx.buses.peak["mock-bus-access"] == 1
    # 6 commands x 0.12s = 0.72s if everything were serial; two independent buses run side by side
    assert elapsed < 0.72 - 0.05, elapsed
    assert {c["status"] for c in env.ctx.commands.list_recent(20)} == {"succeeded"}


# ---------------------------------------------------------------- modbus_m7000 adapter against a fake transport
class FakeModbus:
    def __init__(self):
        self.writes, self.reads, self.fail = [], [], None

    def write_coil(self, unit, offset, value):
        if self.fail == "timeout":
            raise DeviceTimeout("no reply", sent=True)
        self.writes.append((unit, offset, value))

    def read_coils(self, unit, offset, count):
        self.reads.append((unit, offset, count))
        return [True] * count


def tgt(**over):
    ctrl = ControllerDef(controller_id="c1", protocol="modbus_m7000", bus_id="b", node_id=7, do_count=4, model_confirmed=True,
                         modbus_functions=[1, 5], firmware="210")
    bus = BusDef(bus_id="b", serial_path="/dev/serial/by-id/x", baudrate=9600, parity="N", data_bits=8, stop_bits=1, protocol_profile="modbus_rtu")
    b = CircuitBinding(circuit_id="circuit-01", wiring_mode="relay_switched", controller_id="c1", physical_output_channel=2,
                       active_polarity="high", mapping_status="active",
                       modbus=ModbusBinding(table_type="coil", reference_address="00002", base=1, read_function=1, write_function=5))
    ctrl = ctrl.model_copy(update=over.pop("ctrl", {}))
    b = b.model_copy(update=over.pop("binding", {}))
    return OutputTarget("circuit-01", ctrl, b, bus)


def test_m7000_write_uses_base1_offset_and_polarity():
    ft = FakeModbus()
    d = ModbusM7000RelayDriver(lambda bus: ft)
    r = d.write_output(tgt(), True)
    assert ft.writes == [(7, 1, True)] and r.verification == "unverified"      # 00002 -> coil offset 1
    d.write_output(tgt(binding={"active_polarity": "low"}), True)
    assert ft.writes[-1] == (7, 1, False)


@pytest.mark.parametrize("over,exc,code", [
    ({"ctrl": {"model_confirmed": False}}, NotConfigured, "model_unconfirmed"),
    ({"ctrl": {"protocol": "soyal_721_727"}}, Unsupported, "protocol_mismatch"),
    ({"ctrl": {"modbus_functions": []}}, NotConfigured, "function_unconfirmed"),
    ({"ctrl": {"node_id": None}}, NotConfigured, "node_not_configured"),
    ({"binding": {"modbus": ModbusBinding(table_type="coil", reference_address="00129", write_function=5)}}, Unsupported, "address_forbidden"),
    ({"binding": {"modbus": ModbusBinding(table_type="coil", reference_address="00257", write_function=5)}}, Unsupported, "address_forbidden"),
    ({"binding": {"modbus": None}}, NotConfigured, "address_not_configured"),
])
def test_m7000_refuses_unsafe_or_unconfirmed(over, exc, code):
    ft = FakeModbus()
    with pytest.raises(exc) as e:
        ModbusM7000RelayDriver(lambda bus: ft).write_output(tgt(**over), True)
    assert e.value.code == code and ft.writes == []                               # nothing is ever sent


def test_m7000_timeout_after_send_propagates_as_timeout():
    ft = FakeModbus(); ft.fail = "timeout"
    with pytest.raises(DeviceTimeout) as e:
        ModbusM7000RelayDriver(lambda bus: ft).write_output(tgt(), True)
    assert e.value.sent is True


# ---------------------------------------------------------------- SOYAL adapter against a fake link
class FakeLink:
    def __init__(self, reply):
        self.reply, self.sent = reply, []

    def transact(self, frame, expect_min, timeout_s):
        self.sent.append(frame)
        if isinstance(self.reply, Exception):
            raise self.reply
        return self.reply

    def close(self): ...


def soyal(link, node=1, profile="soyal_binary"):
    dev = DeviceConfig(device_id="a", kind="access", driver="real", driver_profile="soyal_721_727", node_id=node, doors=["door-1"])
    bus = BusDef(bus_id="s", serial_path="/dev/serial/by-id/s", baudrate=9600, parity="N", data_bits=8, stop_bits=1, protocol_profile=profile)
    return SoyalAccessDriver(dev, bus, lambda b: link)


def test_soyal_unlock_sends_one_timed_relay_frame_and_never_claims_door_opened():
    link = FakeLink(sf.build_frame(0x00, sf.ECHO_ACK))
    r = soyal(link).unlock("door-1")
    assert link.sent == [bytes.fromhex("7E050121 84".replace(" ", "")) + bytes([sf.xor_byte(bytes([1, 0x21, 0x84])), sf.sum_byte(bytes([1, 0x21, 0x84, sf.xor_byte(bytes([1, 0x21, 0x84]))]))])]
    assert r.accepted and r.door_contact == "unknown" and r.verification == "unverified"


def test_soyal_errors_nack_timeout_wrong_profile_and_no_broadcast():
    with pytest.raises(DeviceError) as e:
        soyal(FakeLink(sf.build_frame(0x00, sf.ECHO_NACK))).unlock("door-1")
    assert e.value.code == "device_nack"
    with pytest.raises(DeviceTimeout):
        soyal(FakeLink(DeviceTimeout("none", sent=True))).unlock("door-1")
    with pytest.raises(NotConfigured):
        soyal(FakeLink(b""), profile="modbus_rtu").unlock("door-1")
    for node in (255, 0, None):
        link = FakeLink(b"")
        with pytest.raises(NotConfigured):
            soyal(link, node=node).unlock("door-1")
        assert link.sent == []


# ---------------------------------------------------------------- secrets never leak through the API
def test_config_and_status_endpoints_never_expose_secrets(tmp_path, monkeypatch):
    from tests.conftest import build_env
    monkeypatch.setenv("HIKVISION_PASSWORD", "NVR-PASS-123!")
    monkeypatch.setenv("HIKVISION_USERNAME", "nvr-admin-user")
    monkeypatch.setenv("HIKVISION_HOST", "192.0.2.77")
    monkeypatch.setenv("EDGE_TURN_SHARED_SECRET", "turn-secret-zzz")
    from edge_control.config.settings import HikvisionEnv
    e = build_env(tmp_path)
    e.ctx.hik_env = HikvisionEnv(_env_file=None)
    blob = ""
    for url in ("/v1/system/config", "/v1/system/status", "/v1/mapping", "/v1/cameras", "/v1/relay/circuits"):
        r = e.client.get(url, headers=H["admin"])
        assert r.status_code == 200, url
        blob += r.text
    for leak in ("NVR-PASS-123", "nvr-admin-user", "192.0.2.77", "turn-secret-zzz", "operator-token-123", "admin-token-12345", "internal-secret-xyz"):
        assert leak not in blob, leak
    cfg = e.client.get("/v1/system/config", headers=H["operator"]).json()
    assert cfg["hikvision"]["env"]["HIKVISION_PASSWORD"] == "set"       # only presence is reported
    e.client.__exit__(None, None, None)


def test_error_responses_and_audit_do_not_echo_credentials(env):
    r = env.client.get("/v1/commands/x", headers={"Authorization": "Bearer super-secret-token-value"})
    assert r.status_code == 401 and "super-secret-token-value" not in r.text
    env.client.post("/v1/auth/login", json={"token": "wrong-token-value"})
    assert "wrong-token-value" not in json.dumps(env.ctx.audit.recent(50))
