"""Deployment-mapping validation.  "validated" means the configuration is internally consistent -
it never means the hardware has been tested."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from edge_control.config.loader import AppConfig
from edge_control.config.schema import CircuitBinding, Deployment
from edge_control.drivers.relay.modbus_address import (
    M7000_READONLY_OR_CONFIG_RANGES, AddressError, check_functions, is_m7000_do_value, parse_reference,
)


@dataclass
class Issue:
    level: str  # error | warning | pending
    section: str
    entity: str
    code: str
    message: str

    def as_dict(self) -> dict[str, str]:
        return self.__dict__.copy()


@dataclass
class ValidationReport:
    issues: list[Issue] = field(default_factory=list)
    normalized: Deployment | None = None

    @property
    def errors(self) -> list[Issue]:
        return [i for i in self.issues if i.level == "error"]

    @property
    def ok(self) -> bool:
        return not self.errors

    def as_dict(self) -> dict[str, Any]:
        return {"ok": self.ok, "errors": [i.as_dict() for i in self.issues if i.level == "error"],
                "warnings": [i.as_dict() for i in self.issues if i.level == "warning"],
                "pending": [i.as_dict() for i in self.issues if i.level == "pending"]}


def _rank(status: str) -> int:
    return {"unbound": 0, "draft": 1, "validated": 2, "active": 3}[status]


def validate_deployment(dep: Deployment, cfg: AppConfig, *, runtime_mode: str) -> ValidationReport:
    rep = ValidationReport()
    add = lambda lvl, sec, ent, code, msg: rep.issues.append(Issue(lvl, sec, ent, code, msg))  # noqa: E731
    dep = dep.model_copy(deep=True)

    buses = {b.bus_id: b for b in dep.buses}
    ctrls = {c.controller_id: c for c in dep.controllers}
    if len(buses) != len(dep.buses):
        add("error", "buses", "*", "duplicate_bus_id", "bus_id must be unique")
    if len(ctrls) != len(dep.controllers):
        add("error", "controllers", "*", "duplicate_controller_id", "controller_id must be unique")

    # ---- buses: one physical port = one configuration
    by_path: dict[str, list[str]] = {}
    for b in dep.buses:
        if b.serial_path:
            by_path.setdefault(b.serial_path, []).append(b.bus_id)
        if b.stop_bits is not None and b.stop_bits not in (1, 1.5, 2):
            add("error", "buses", b.bus_id, "bad_stop_bits", "stop_bits must be 1, 1.5 or 2")
        if b.data_bits is not None and b.data_bits not in (5, 6, 7, 8):
            add("error", "buses", b.bus_id, "bad_data_bits", "data_bits must be 5-8")
    for path, ids in by_path.items():
        if len(ids) > 1:
            add("error", "buses", ",".join(ids), "serial_path_shared",
                f"{path} is bound by several buses; one physical port may have only one bus configuration/owner")

    # ---- controllers
    bus_protocols: dict[str, set[str]] = {}
    seen_nodes: dict[tuple[str, int], str] = {}
    for c in dep.controllers:
        if c.simulation_only and runtime_mode != "mock":
            add("error", "controllers", c.controller_id, "simulation_in_real_mode",
                "simulation-only controller cannot be used outside mock mode")
        if c.bus_id:
            if c.bus_id not in buses:
                add("error", "controllers", c.controller_id, "unknown_bus", f"bus {c.bus_id} not defined")
            else:
                bus_protocols.setdefault(c.bus_id, set()).add(c.protocol)
                if c.node_id is not None:
                    key = (c.bus_id, c.node_id)
                    if key in seen_nodes:
                        add("error", "controllers", c.controller_id, "duplicate_node",
                            f"node/slave {c.node_id} already used on {c.bus_id} by {seen_nodes[key]}")
                    seen_nodes[key] = c.controller_id
        if c.simulation_only:
            continue
        bus = buses.get(c.bus_id or "")
        if c.protocol == "modbus_m7000":
            if bus and bus.protocol_profile != "modbus_rtu":
                add("error", "controllers", c.controller_id, "profile_mixed",
                    "modbus_m7000 controller must sit on a modbus_rtu bus")
            if c.node_id is not None and not 1 <= c.node_id <= 247:
                add("error", "controllers", c.controller_id, "bad_slave_id", "Modbus slave id must be 1..247")
        elif c.protocol == "soyal_721_727":
            if bus and bus.protocol_profile != "soyal_binary":
                add("error", "controllers", c.controller_id, "profile_mixed",
                    "soyal_721_727 controller must sit on a soyal_binary bus")
            if c.node_id in (0, 255):
                add("error", "controllers", c.controller_id, "bad_node", "SOYAL node 0 (master) / 255 (broadcast) not allowed")
        if not c.model_confirmed:
            add("pending", "controllers", c.controller_id, "model_unconfirmed",
                "vendor/model/firmware not confirmed on site; the M-7000 / SOYAL profile may not apply")
        if c.protocol == "modbus_m7000" and not c.firmware:
            add("pending", "controllers", c.controller_id, "firmware_unknown",
                "firmware version required (*1 registers need >=200, *2 only <=199)")
    for bus_id, protos in bus_protocols.items():
        real = {p for p in protos if p != "unspecified"}
        if len(real) > 1:
            add("error", "buses", bus_id, "bus_protocol_mixed",
                f"bus {bus_id} mixes protocols {sorted(real)}; SOYAL and Modbus must not share a bus")

    # ---- circuits
    cat = {c.circuit_id: c for c in cfg.circuits}
    ids = [b.circuit_id for b in dep.circuits]
    if sorted(ids) != sorted(cat) or len(set(ids)) != len(ids):
        add("error", "circuits", "*", "circuit_set_mismatch", "exactly the 18 catalog circuits must be present, once each")
    out_seen: dict[tuple, str] = {}
    mb_seen: dict[tuple, str] = {}
    for b in dep.circuits:
        c = cat.get(b.circuit_id)
        if c is None:
            continue
        cid = b.circuit_id
        bound = b.controller_id is not None or b.physical_output_channel is not None or b.modbus or b.soyal
        if c.control_mode == "reserved" or c.wiring_mode == "reserved":
            if bound or b.wiring_mode not in ("reserved", "unconfirmed"):
                add("error", "circuits", cid, "reserved_bound", "reserved circuit must stay disabled with no output binding")
            b.mapping_status = "unbound"
            continue
        if c.control_mode == "always_on_bypass":
            if b.wiring_mode != "hardware_bypass":
                add("error", "circuits", cid, "bypass_wiring_mode", "always-on circuits must use wiring_mode hardware_bypass")
            if bound:
                add("error", "circuits", cid, "bypass_output_bound",
                    "bypass circuits are never switched by software: remove controller/channel/address")
            add("pending", "circuits", cid, "supply_unconfirmed",
                "bypass is a wiring decision; actual supply needs an independent read-back (none configured => 未確認)")
            b.mapping_status = "unbound"
            continue
        if b.mapping_status == "unbound" and not bound:
            continue
        if b.wiring_mode != "relay_switched":
            add("error", "circuits", cid, "wiring_mode", "a bound circuit must use wiring_mode relay_switched")
        errs_before = len(rep.errors)
        ctrl = ctrls.get(b.controller_id or "")
        if ctrl is None:
            add("error", "circuits", cid, "controller_missing", "controller_id missing/unknown")
        if b.physical_output_channel is None or b.physical_output_channel < 1:
            add("error", "circuits", cid, "channel_missing", "physical_output_channel (1-based) required")
        if ctrl is not None and b.physical_output_channel is not None:
            if ctrl.do_count is None:
                add("error", "circuits", cid, "missing_channel", "controller DO count unknown: cannot verify channel exists")
            elif b.physical_output_channel > ctrl.do_count:
                add("error", "circuits", cid, "missing_channel",
                    f"channel {b.physical_output_channel} > DO count {ctrl.do_count}: physical output not available")
            key = (b.controller_id, b.physical_output_channel)
            if key in out_seen:
                add("error", "circuits", cid, "duplicate_output", f"same physical output already bound to {out_seen[key]}")
            out_seen[key] = cid
        if ctrl is not None and not ctrl.simulation_only:
            if ctrl.protocol == "modbus_m7000":
                if b.soyal is not None:
                    add("error", "circuits", cid, "profile_mixed", "SOYAL fields on a Modbus controller")
                m = b.modbus
                if m is None or not m.table_type or not m.reference_address:
                    add("error", "circuits", cid, "address_missing", "table_type and reference_address required")
                else:
                    try:
                        addr = parse_reference(m.reference_address, m.table_type, m.base)
                        for e in check_functions(m.table_type, m.read_function, m.write_function):
                            add("error", "circuits", cid, "bad_function", e)
                        if m.write_function is None:
                            add("error", "circuits", cid, "bad_function", "write function required")
                        for fn in (m.read_function, m.write_function):
                            if fn is not None and fn not in ctrl.modbus_functions:
                                add("error", "circuits", cid, "function_unconfirmed",
                                    f"function {fn} is not in the controller's operator-confirmed function list")
                        if m.table_type == "coil" and not is_m7000_do_value(addr):
                            why = next((d for lo, hi, d in M7000_READONLY_OR_CONFIG_RANGES if lo <= addr.number <= hi), "outside 00001-00016")
                            add("error", "circuits", cid, "address_forbidden", f"{m.reference_address}: {why}")
                        elif m.table_type != "coil":
                            add("error", "circuits", cid, "address_forbidden", "only DO value coils may be written")
                        elif b.physical_output_channel is not None and addr.number != b.physical_output_channel:
                            add("error", "circuits", cid, "channel_address_mismatch",
                                f"DO channel {b.physical_output_channel} must use coil {b.physical_output_channel:05d}")
                        mkey = (b.controller_id, addr.table_type, addr.offset)
                        if mkey in mb_seen:
                            add("error", "circuits", cid, "duplicate_output", f"same register already bound to {mb_seen[mkey]}")
                        mb_seen[mkey] = cid
                    except AddressError as e:
                        add("error", "circuits", cid, "bad_address", str(e))
            elif ctrl.protocol == "soyal_721_727":
                if b.modbus is not None:
                    add("error", "circuits", cid, "profile_mixed", "Modbus fields on a SOYAL controller")
                s = b.soyal
                if s is None or not s.command or not s.selector:
                    add("error", "circuits", cid, "selector_missing", "SOYAL command and selector required")
                else:
                    add("warning", "circuits", cid, "soyal_not_power_do",
                        "SOYAL door/alarm relay is an access-controller output, not a power-distribution DO")
            else:
                add("error", "circuits", cid, "protocol_unspecified", "controller protocol is unspecified")
            if not ctrl.model_confirmed:
                add("error", "circuits", cid, "model_unconfirmed",
                    "controller model/firmware not confirmed: binding cannot be validated")
        if b.active_polarity is None:
            add("error", "circuits", cid, "polarity_missing", "active_polarity required")
        if b.feedback_type == "none":
            add("pending", "circuits", cid, "no_feedback", "no read-back/feedback: state can only be 'unverified'")
        if c.critical_power:
            pass
        add("pending", "circuits", cid, "load_driver_unconfirmed",
            "contactor / load driver and wiring on site not recorded here; DO is a control output only")
        new_errs = len(rep.errors) - errs_before
        if new_errs:
            b.mapping_status = "draft" if _rank(b.mapping_status) > 1 else b.mapping_status
        elif b.mapping_status in ("draft", "validated", "active"):
            b.mapping_status = "active" if b.mapping_status == "active" else "validated"
        elif b.mapping_status == "unbound" and bound:
            b.mapping_status = "draft"
        if b.hardware_verified_at is None and b.mapping_status in ("validated", "active"):
            add("pending", "circuits", cid, "hardware_untested", "mapping validated by configuration only; hardware not tested")

    # ---- cameras
    nvrs = {n.nvr_id for n in dep.nvrs}
    cam_cat = {c.camera_id for c in cfg.cameras}
    cids = [c.camera_id for c in dep.cameras]
    if cids != [c.camera_id for c in cfg.cameras]:
        add("error", "cameras", "*", "camera_set_mismatch", "camera-01..camera-06 must be present in the fixed order")
    chan_seen: dict[tuple, str] = {}
    for cam in dep.cameras:
        if cam.camera_id not in cam_cat:
            continue
        cid = cam.camera_id
        has_any = any([cam.nvr_channel, cam.isapi_track_id, cam.sdk_channel_id,
                       *(cam.rtsp_stream_ids or {}).values()])
        if cam.mapping_status == "unbound" and not has_any:
            continue
        errs_before = len(rep.errors)
        if cam.nvr_id not in nvrs:
            add("error", "cameras", cid, "nvr_missing", "nvr_id missing/unknown")
        if not cam.nvr_channel:
            add("error", "cameras", cid, "channel_missing", "nvr_channel required")
        if not any((cam.rtsp_stream_ids or {}).values()):
            add("error", "cameras", cid, "stream_id_missing", "at least one RTSP stream identifier required (main or sub)")
        if cam.search_capable and not (cam.isapi_track_id or cam.sdk_channel_id):
            add("error", "cameras", cid, "search_id_missing", "history search needs an ISAPI track id or SDK channel id")
        if cam.nvr_id and cam.nvr_channel:
            key = (cam.nvr_id, cam.nvr_channel)
            if key in chan_seen and not (cam.duplicate_intent_confirmed):
                add("error", "cameras", cid, "duplicate_channel",
                    f"channel already bound to {chan_seen[key]}; set duplicate_intent_confirmed to bind deliberately")
            chan_seen.setdefault(key, cid)
        if cam.live_verified_at is None:
            add("pending", "cameras", cid, "live_unverified", "live view not verified on a real NVR")
        if cam.history_verified_at is None:
            add("pending", "cameras", cid, "history_unverified", "history search/playback not verified (separate from live)")
        if len(rep.errors) > errs_before:
            cam.mapping_status = "draft"
        elif cam.mapping_status in ("draft", "unbound"):
            cam.mapping_status = "validated"
    rep.normalized = dep
    return rep
