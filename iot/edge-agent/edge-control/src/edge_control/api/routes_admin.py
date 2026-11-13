"""Auth, health, system diagnostics, read-only config view and the Admin deployment-mapping API."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request, Response
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse, PlainTextResponse

from edge_control.api.deps import COOKIE, admin, ctx_of, match_token, operator, principal, viewer
from edge_control.api.schemas import (
    AddressPreview, ApplyBody, DraftPut, ImportBody, LoginBody, RollbackBody, TestWriteBody,
)
from edge_control.api.routes_control import accepted
from edge_control.config.schema import Deployment
from edge_control.drivers.relay.modbus_address import FUNCTION_MENU, READ_FUNCTIONS, WRITE_FUNCTIONS, AddressError, parse_reference
from edge_control.errors import Conflict, PolicyError, Unauthorized, Unprocessable
from edge_control.security.permissions import Principal
from edge_control.system.health_check import liveness, system_status
from edge_control.util import redact_obj

router = APIRouter(prefix="/v1")


# ------------------------------------------------------------------ health / auth
@router.get("/health")
def health(request: Request):
    return liveness(ctx_of(request))


@router.post("/auth/login")
def login(body: LoginBody, request: Request, response: Response):
    """Exchange a token for an HttpOnly session cookie, so the web UI never stores the long-lived token."""
    ctx = ctx_of(request)
    p = match_token(ctx, body.token)
    if p is None:
        ctx.audit.write(actor="unknown", role=None, action="auth.login", result="denied")
        raise Unauthorized("invalid token", code="invalid_token")
    sid = request.app.state.web_sessions.create(p)
    response.set_cookie(COOKIE, sid, httponly=True, samesite="strict", secure=ctx.settings.cookie_secure,
                        max_age=ctx.settings.session_ttl_seconds, path="/")
    ctx.audit.write(actor=p.actor, role=p.role, action="auth.login", result="ok")
    return {"actor": p.actor, "role": p.role}


@router.post("/auth/logout")
def logout(request: Request, response: Response):
    sid = request.cookies.get(COOKIE)
    if sid:
        request.app.state.web_sessions.drop(sid)
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


@router.get("/auth/me")
def me(request: Request, p: Principal = Depends(principal)):
    ctx = ctx_of(request)
    return {"actor": p.actor, "role": p.role, "site_id": ctx.cfg.site.site_id, "edge_id": ctx.cfg.site.edge_id,
            "mode": ctx.settings.mode, "timezone_default": "Asia/Taipei"}


# ------------------------------------------------------------------ system
@router.get("/system/status")
def sys_status(request: Request, _p: Principal = Depends(viewer)):
    ctx = ctx_of(request)
    st = system_status(ctx)
    st["recent_commands"] = [{k: c[k] for k in ("command_id", "type", "target_id", "status", "verification", "error_code", "created_at", "driver_mode")}
                             for c in ctx.commands.list_recent(15)]
    return st


@router.get("/system/config")
def sys_config(request: Request, _p: Principal = Depends(operator)):
    """Read-only, secrets masked. Environment values are reported only as set/unset."""
    ctx = ctx_of(request)
    env = ctx.hik_env
    return redact_obj({
        "site": ctx.cfg.site.model_dump(), "mode": ctx.settings.mode,
        "devices": [d.model_dump() for d in ctx.cfg.devices.values()],
        "policies": ctx.cfg.policies.model_dump(), "media": ctx.cfg.media.model_dump(),
        "hikvision": {**ctx.cfg.hikvision.model_dump(), "env": {
            "HIKVISION_HOST": "set" if env.host else "unset", "HIKVISION_USERNAME": "set" if env.username else "unset",
            "HIKVISION_PASSWORD": "set" if env.password else "unset", "HIKVISION_RTSP_PORT": env.rtsp_port,
            "HIKVISION_HTTP_PORT": env.http_port, "HIKVISION_HTTP_SCHEME": env.http_scheme,
            "HIKVISION_SDK_PORT": env.sdk_port, "HIKVISION_SDK_DIR": "set" if env.sdk_dir else "unset",
            "HIKVISION_DEVICE_TIMEZONE": env.device_timezone}},
        "cloud": {"url_configured": bool(ctx.settings.cloud_url)},
    })


@router.get("/audit")
def audit(request: Request, limit: int = 100, _p: Principal = Depends(admin)):
    return {"items": ctx_of(request).audit.recent(min(limit, 500))}


# ------------------------------------------------------------------ deployment mapping (Admin only)
@router.get("/mapping")
def mapping_active(request: Request, _p: Principal = Depends(admin)):
    ctx = ctx_of(request)
    rev, dep = ctx.deployment.active()
    return {"revision": rev, "deployment": dep.model_dump(mode="json"),
            "catalog": {"circuits": [c.model_dump() for c in ctx.cfg.circuits], "cameras": [c.model_dump() for c in ctx.cfg.cameras]}}


@router.get("/mapping/draft")
def draft_get(request: Request, _p: Principal = Depends(admin)):
    return ctx_of(request).deployment.draft()


@router.put("/mapping/draft")
def draft_put(body: DraftPut, request: Request, p: Principal = Depends(admin)):
    ctx = ctx_of(request)
    out = ctx.deployment.put_draft(body.deployment, body.expected_revision, p.actor)
    ctx.audit.write(actor=p.actor, role=p.role, action="mapping.draft.save", detail={"draft_revision": out["draft_revision"]})
    return out


@router.delete("/mapping/draft")
def draft_discard(request: Request, expected_revision: int, p: Principal = Depends(admin)):
    ctx = ctx_of(request)
    ctx.deployment.discard_draft(expected_revision)
    ctx.audit.write(actor=p.actor, role=p.role, action="mapping.draft.discard")
    return ctx.deployment.draft()


@router.post("/mapping/draft/validate")
def draft_validate(request: Request, p: Principal = Depends(admin)):
    ctx = ctx_of(request)
    rep = ctx.deployment.validate()
    ctx.audit.write(actor=p.actor, role=p.role, action="mapping.validate", result="ok" if rep.ok else "errors",
                    detail={"errors": len(rep.errors)})
    return {**rep.as_dict(), "normalized": rep.normalized.model_dump(mode="json") if rep.normalized else None,
            "note": "validated = configuration consistent; hardware has NOT been tested"}


@router.get("/mapping/draft/diff")
def draft_diff(request: Request, _p: Principal = Depends(admin)):
    return ctx_of(request).deployment.draft_diff()


@router.post("/mapping/apply")
def mapping_apply(body: ApplyBody, request: Request, p: Principal = Depends(admin)):
    ctx = ctx_of(request)
    try:
        out = ctx.deployment.apply(body.expected_revision, p.actor, body.comment)
    except Exception as e:
        ctx.audit.write(actor=p.actor, role=p.role, action="mapping.apply", result="refused", detail={"code": getattr(e, "code", "error")})
        raise
    ctx.audit.write(actor=p.actor, role=p.role, action="mapping.apply", detail=out)
    return out


@router.get("/mapping/versions")
def mapping_versions(request: Request, _p: Principal = Depends(admin)):
    ctx = ctx_of(request)
    return {"active_revision": ctx.deployment.revision, "versions": ctx.deployment.versions()}


@router.post("/mapping/rollback")
def mapping_rollback(body: RollbackBody, request: Request, p: Principal = Depends(admin)):
    ctx = ctx_of(request)
    out = ctx.deployment.rollback(body.revision, body.expected_revision, p.actor)
    ctx.audit.write(actor=p.actor, role=p.role, action="mapping.rollback", detail=out)
    return out


@router.get("/mapping/export")
def mapping_export(request: Request, format: str = "json", revision: int | None = None, p: Principal = Depends(admin)):
    ctx = ctx_of(request)
    text = ctx.deployment.export("yaml" if format == "yaml" else "json", revision)
    ctx.audit.write(actor=p.actor, role=p.role, action="mapping.export", detail={"format": format})
    return PlainTextResponse(text, media_type="application/yaml" if format == "yaml" else "application/json")


@router.post("/mapping/import")
def mapping_import(body: ImportBody, request: Request, p: Principal = Depends(admin)):
    ctx = ctx_of(request)
    dep = ctx.deployment.parse_import(body.content, body.format)
    out = ctx.deployment.put_draft(dep, body.expected_revision, p.actor)  # import only creates a DRAFT
    ctx.audit.write(actor=p.actor, role=p.role, action="mapping.import", detail={"format": body.format})
    return out


@router.post("/mapping/address-preview")
def address_preview(body: AddressPreview, _p: Principal = Depends(admin)):
    try:
        a = parse_reference(body.reference_address, body.table_type, body.base)
    except AddressError as e:
        raise Unprocessable(str(e), code="bad_address") from e
    return {"table_type": a.table_type, "reference_address": a.reference, "base": a.base, "pdu_offset": a.offset,
            "read_functions": READ_FUNCTIONS[a.table_type], "write_functions": WRITE_FUNCTIONS[a.table_type]}


@router.get("/mapping/function-menu")
def function_menu(_p: Principal = Depends(admin)):
    return {"menu": [{"code": k, "name": v} for k, v in FUNCTION_MENU.items()],
            "note": "Common function codes only. Which ones a physical model supports must be confirmed from its manual."}


@router.post("/mapping/circuits/{circuit_id}/read-state")
async def read_state(circuit_id: str, request: Request, p: Principal = Depends(admin)):
    """Explicit status read: only a driver-supported side-effect-free read is used."""
    ctx = ctx_of(request)
    code, msg = ctx.policy.operability(circuit_id, True)
    if code in ("circuit_reserved", "circuit_always_on_protected", "circuit_unbound", "mapping_not_active", "controller_missing"):
        raise PolicyError(msg or code, code=code)

    def work():
        res = ctx.policy.resolve(circuit_id)
        with ctx.buses.exclusive(res.bus.bus_id if res.bus else res.controller.controller_id):
            return ctx.relay_controller.read_state(circuit_id)
    result = await run_in_threadpool(work)
    ctx.audit.write(actor=p.actor, role=p.role, action="mapping.read_state", target=circuit_id)
    return result


@router.post("/mapping/circuits/{circuit_id}/test-write", status_code=202)
def test_write(circuit_id: str, body: TestWriteBody, request: Request, p: Principal = Depends(admin)):
    """Maintenance-only single-circuit ON/OFF test. Needs maintenance mode + typed confirmation; same policy gate."""
    ctx = ctx_of(request)
    if not ctx.cfg.policies.maintenance_mode:
        raise Conflict("maintenance mode is off (policies.yaml maintenance_mode)", code="maintenance_mode_required")
    if body.confirm_circuit_id != circuit_id:
        raise Unprocessable("confirm_circuit_id must equal the circuit being tested", code="confirmation_mismatch")
    c, created = ctx.command_service.submit_relay(p, circuit_id, command_id=body.command_id, on=body.state == "on",
                                                  expires_at=body.expires_at, source="maintenance_test")
    ctx.audit.write(actor=p.actor, role=p.role, action="mapping.test_write", target=circuit_id, command_id=c["command_id"])
    return accepted(c, created)
