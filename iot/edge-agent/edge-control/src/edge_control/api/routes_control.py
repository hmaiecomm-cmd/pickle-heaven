"""Device-control REST endpoints: validate -> create a durable command -> 202.  No serial I/O happens here."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from edge_control.api.deps import check_body_identity, ctx_of, operator, viewer
from edge_control.api.schemas import (
    BatchBody, BookingEvents, CommandAccepted, HvacSettingsBody, OverrideBody, RelayStateBody, UnlockBody,
)
from edge_control.context import AppContext
from edge_control.drivers.relay.modbus_address import AddressError, parse_reference
from edge_control.errors import NotFound, PolicyError
from edge_control.security.permissions import Principal, require_role

router = APIRouter(prefix="/v1")


def command_view(c: dict) -> dict[str, Any]:
    return {
        "command_id": c["command_id"], "type": c["type"], "target_id": c["target_id"], "status": c["status"],
        "requested_state": c["requested_state"], "reported_state": c["reported_state"], "verification": c["verification"],
        "error": {"code": c["error_code"], "message": c["error_message"]} if c["error_code"] else None,
        "expires_at": c["expires_at"], "created_at": c["created_at"], "started_at": c["started_at"],
        "finished_at": c["finished_at"], "actor": c["actor"], "source": c["source"],
        "mapping_revision": c["mapping_revision"], "driver_mode": c["driver_mode"],
        "simulated": c["driver_mode"] == "mock",
        "status_url": f"/v1/commands/{c['command_id']}",
    }


def accepted(c: dict, created: bool) -> JSONResponse:
    body = CommandAccepted(command_id=c["command_id"], status=c["status"], status_url=f"/v1/commands/{c['command_id']}",
                           replay=not created).model_dump()
    return JSONResponse(body, status_code=202, headers={"Location": body["status_url"]})


@router.get("/commands/{command_id}")
def get_command(command_id: str, request: Request, _p: Principal = Depends(viewer)):
    return command_view(ctx_of(request).command_service.get(command_id))


# ------------------------------------------------------------------ HVAC
@router.patch("/hvac/{device_id}/settings", status_code=202)
def patch_hvac(device_id: str, body: HvacSettingsBody, request: Request, p: Principal = Depends(operator)):
    ctx = ctx_of(request)
    check_body_identity(ctx, body.site_id, body.edge_id)
    settings = body.model_dump(include={"power", "setpoint_c", "mode", "fan"})
    c, created = ctx.command_service.submit_hvac(p, device_id, command_id=body.command_id, settings=settings,
                                                 expires_at=body.expires_at)
    return accepted(c, created)


@router.get("/hvac/{device_id}/state")
def get_hvac(device_id: str, request: Request, refresh: bool = False, _p: Principal = Depends(viewer)):
    ctx = ctx_of(request)
    dev, drv = ctx.registry.hvac(device_id)
    out: dict[str, Any] = {"device_id": device_id, "name": dev.name, "driver_mode": drv.mode, "simulated": drv.mode == "mock",
                           "capabilities": drv.capabilities(), "state": ctx.states.get(device_id), "live_read": None}
    if refresh:
        def read():
            lock = ctx.buses.exclusive(dev.bus_id) if dev.bus_id else None
            if lock:
                with lock:
                    return drv.read_state()
            return drv.read_state()
        try:
            out["live_read"] = read().as_dict()
        except Exception as e:  # noqa: BLE001
            out["live_read"] = {"error": getattr(e, "code", type(e).__name__)}
    return out


# ------------------------------------------------------------------ Access
@router.post("/access/{door_id}/unlock", status_code=202)
def unlock(door_id: str, body: UnlockBody, request: Request, p: Principal = Depends(operator)):
    ctx = ctx_of(request)
    check_body_identity(ctx, body.site_id, body.edge_id)
    c, created = ctx.command_service.submit_unlock(p, door_id, command_id=body.command_id, expires_at=body.expires_at)
    return accepted(c, created)


@router.get("/access/{door_id}/state")
def get_door(door_id: str, request: Request, _p: Principal = Depends(viewer)):
    ctx = ctx_of(request)
    dev, drv = ctx.registry.access_for_door(door_id)
    st = ctx.states.get(door_id)
    return {"door_id": door_id, "device_id": dev.device_id, "driver_mode": drv.mode, "simulated": drv.mode == "mock",
            "door_contact": "not_supported" if dev.mock.get("door_contact") is False else "unknown",
            "last_unlock": st,
            "note": "An accepted unlock does not prove the door opened; door contact is reported only if the controller provides it."}


# ------------------------------------------------------------------ Relay
def circuit_views(ctx: AppContext) -> list[dict[str, Any]]:
    rev, dep = ctx.deployment.active()
    sched = ctx.reconciler.last_run
    out = []
    for c in ctx.cfg.circuits:
        b = next((x for x in dep.circuits if x.circuit_id == c.circuit_id), None)
        bd = b.model_dump(mode="json") if b else None
        if bd and bd.get("modbus") and bd["modbus"].get("reference_address") and bd["modbus"].get("table_type"):
            try:
                bd["modbus"]["pdu_offset"] = parse_reference(bd["modbus"]["reference_address"], bd["modbus"]["table_type"], bd["modbus"]["base"]).offset
            except AddressError:
                bd["modbus"]["pdu_offset"] = None
        st = ctx.states.get(c.circuit_id)
        d = sched.get(c.circuit_id)
        bypass = c.control_mode == "always_on_bypass"
        out.append({
            "circuit_id": c.circuit_id, "number": c.number, "name": c.name, "zone": c.zone, "voltage": c.voltage,
            "load_w": c.load_w, "load_note": c.load_note, "power_confirmed": c.power_confirmed,
            "wiring_mode": (b.wiring_mode if b else c.wiring_mode), "enabled": c.enabled,
            "source_note": c.source_note, "issue": c.issue,
            **ctx.policy.describe(c.circuit_id),
            "schedule": c.schedule.model_dump() if c.schedule else None,
            "desired_state": d.state if d else None, "desired_reason": d.reason if d else None,
            "binding": bd,
            "state": {"requested": (st or {}).get("requested_state"), "reported": (st or {}).get("reported_state"),
                      "verification": (st or {}).get("verification", "unknown"), "driver_mode": (st or {}).get("driver_mode"),
                      "updated_at": (st or {}).get("updated_at")},
            "supply": {"policy": "always_on_by_design" if bypass else None,
                       "confirmed": False if bypass else None,
                       "display": "未確認" if bypass else None},
        })
    return out


@router.get("/relay/circuits")
def list_circuits(request: Request, _p: Principal = Depends(viewer)):
    ctx = ctx_of(request)
    return {"count": len(ctx.cfg.circuits), "mapping_revision": ctx.deployment.revision,
            "simulation_mapping": ctx.deployment.active()[1].simulation_only, "circuits": circuit_views(ctx)}


@router.put("/relay/circuits/{circuit_id}/state", status_code=202)
def put_circuit(circuit_id: str, body: RelayStateBody, request: Request, p: Principal = Depends(operator)):
    ctx = ctx_of(request)
    check_body_identity(ctx, body.site_id, body.edge_id)
    c, created = ctx.command_service.submit_relay(p, circuit_id, command_id=body.command_id, on=body.state == "on",
                                                  expires_at=body.expires_at)
    return accepted(c, created)


@router.post("/relay/batch", status_code=202)
def batch(body: BatchBody, request: Request, p: Principal = Depends(operator)):
    """Batch / all-off goes through the SAME policy engine: protected circuits are reported as skipped."""
    ctx = ctx_of(request)
    check_body_identity(ctx, body.site_id, body.edge_id)
    ids = [c.circuit_id for c in ctx.cfg.circuits] if body.circuit_ids == "all" else list(body.circuit_ids)
    on = body.state == "on"
    submitted, skipped = [], []
    for cid in ids:
        code, _msg = ctx.policy.operability(cid, on)
        if code:
            skipped.append({"circuit_id": cid, "code": code})
            continue
        c, created = ctx.command_service.submit_relay(p, cid, command_id=f"{body.command_id}:{cid}", on=on, expires_at=body.expires_at)
        submitted.append({"circuit_id": cid, "command_id": c["command_id"], "status": c["status"]})
    return JSONResponse({"batch_id": body.command_id, "submitted": submitted, "skipped": skipped}, status_code=202)


@router.put("/relay/circuits/{circuit_id}/override")
def set_override(circuit_id: str, body: OverrideBody, request: Request, p: Principal = Depends(operator)):
    ctx = ctx_of(request)
    code, msg = ctx.policy.operability(circuit_id, body.state == "on")
    if code:
        raise PolicyError(msg or code, code=code)
    exp = ctx.overrides.set(circuit_id, body.state, body.minutes, p.actor)
    ctx.audit.write(actor=p.actor, role=p.role, action="override.set", target=circuit_id, detail={"state": body.state, "minutes": body.minutes})
    return {"circuit_id": circuit_id, "state": body.state, "expires_at": exp.isoformat().replace("+00:00", "Z")}


@router.delete("/relay/circuits/{circuit_id}/override")
def clear_override(circuit_id: str, request: Request, p: Principal = Depends(operator)):
    ctx_of(request).overrides.clear(circuit_id)
    return {"circuit_id": circuit_id, "override": None}


@router.post("/cloud/bookings")
def ingest_bookings(body: BookingEvents, request: Request, p: Principal = Depends(operator)):
    """Booking events from the cloud (proposed contract). Idempotent per booking_id+revision."""
    ctx = ctx_of(request)
    changed = 0
    for e in body.events:
        if ctx.bookings.upsert_event(booking_id=e.booking_id, court=e.court, start=e.start.isoformat(), end=e.end.isoformat(),
                                     status=e.status, revision=e.revision):
            changed += 1
    ctx.bookings.mark_synced()
    ctx.audit.write(actor=p.actor, role=p.role, action="bookings.ingest", result="ok", detail={"events": len(body.events), "changed": changed})
    return {"received": len(body.events), "applied": changed, "ignored_stale": len(body.events) - changed}
