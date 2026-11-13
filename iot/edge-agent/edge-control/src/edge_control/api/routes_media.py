"""Camera / live / playback endpoints and the MediaMTX auth callback."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Header, Query, Request
from fastapi.responses import JSONResponse

from edge_control.api.deps import ctx_of, viewer
from edge_control.api.schemas import LiveSessionBody, PlaybackSessionBody
from edge_control.errors import Unprocessable
from edge_control.security.permissions import Principal, require_camera
from edge_control.util import parse_iso

router = APIRouter(prefix="/v1")
internal = APIRouter()


def _session_response(ctx, row: dict, base: str, status: int = 200) -> JSONResponse:
    v = ctx.sessions.view(row, base)
    return JSONResponse(v, status_code=status, headers={"Location": v["status_url"]})


@router.get("/cameras")
def list_cameras(request: Request, p: Principal = Depends(viewer)):
    ctx = ctx_of(request)
    return {"count": len(ctx.cfg.cameras),
            "cameras": [ctx.resolver.describe(c.camera_id) for c in ctx.cfg.cameras if p.can_camera(c.camera_id)]}


@router.post("/cameras/{camera_id}/live-sessions", status_code=202)
def create_live(camera_id: str, body: LiveSessionBody, request: Request, p: Principal = Depends(viewer),
                idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    ctx = ctx_of(request)
    row, created = ctx.live.create(p, camera_id, stream_profile=body.stream_profile, delivery_target=body.delivery_target,
                                   ttl_seconds=body.ttl_seconds, idempotency_key=idempotency_key)
    ctx.audit.write(actor=p.actor, role=p.role, action="live.create", target=camera_id, result="accepted" if created else "replay",
                    detail={"session_id": row["session_id"]})
    return _session_response(ctx, row, "/v1/live-sessions", 202)


@router.get("/live-sessions/{session_id}")
def get_live(session_id: str, request: Request, p: Principal = Depends(viewer)):
    ctx = ctx_of(request)
    row = ctx.sessions.get_row(session_id, "live")
    ctx.sessions.authorize_access(row, p)
    return ctx.sessions.view(row, "/v1/live-sessions")


@router.delete("/live-sessions/{session_id}")
def stop_live(session_id: str, request: Request, p: Principal = Depends(viewer)):
    ctx = ctx_of(request)
    row = ctx.sessions.get_row(session_id, "live")
    ctx.sessions.authorize_access(row, p)
    out = ctx.sessions.stop(session_id)
    ctx.audit.write(actor=p.actor, role=p.role, action="live.stop", target=row["camera_id"], detail={"session_id": session_id})
    return ctx.sessions.view(out, "/v1/live-sessions")


@router.get("/cameras/{camera_id}/recordings")
def recordings(camera_id: str, request: Request, from_: str | None = Query(default=None, alias="from"),
               to: str | None = None, cursor: str | None = None, limit: int = 100, p: Principal = Depends(viewer)):
    ctx = ctx_of(request)
    try:
        s = parse_iso(from_) if from_ else None
        e = parse_iso(to) if to else None
    except ValueError as err:
        raise Unprocessable(f"from/to must be ISO-8601 with timezone: {err}", code="invalid_time") from err
    return ctx.recordings.search(p, camera_id, s, e, cursor, limit)


@router.post("/cameras/{camera_id}/playback-sessions", status_code=202)
def create_playback(camera_id: str, body: PlaybackSessionBody, request: Request, p: Principal = Depends(viewer),
                    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    ctx = ctx_of(request)
    row, created = ctx.playback.create(p, camera_id, start=body.start_time.astimezone(), end=body.end_time.astimezone(),
                                       delivery_target=body.delivery_target, ttl_seconds=body.ttl_seconds,
                                       idempotency_key=idempotency_key, recording_id=body.recording_id)
    ctx.audit.write(actor=p.actor, role=p.role, action="playback.create", target=camera_id, result="accepted" if created else "replay",
                    detail={"session_id": row["session_id"]})
    return _session_response(ctx, row, "/v1/playback-sessions", 202)


@router.get("/playback-sessions/{session_id}")
def get_playback(session_id: str, request: Request, p: Principal = Depends(viewer)):
    ctx = ctx_of(request)
    row = ctx.sessions.get_row(session_id, "playback")
    ctx.sessions.authorize_access(row, p)
    return ctx.sessions.view(row, "/v1/playback-sessions")


@router.delete("/playback-sessions/{session_id}")
def stop_playback(session_id: str, request: Request, p: Principal = Depends(viewer)):
    ctx = ctx_of(request)
    row = ctx.sessions.get_row(session_id, "playback")
    ctx.sessions.authorize_access(row, p)
    out = ctx.sessions.stop(session_id)
    ctx.audit.write(actor=p.actor, role=p.role, action="playback.stop", target=row["camera_id"], detail={"session_id": session_id})
    return ctx.sessions.view(out, "/v1/playback-sessions")


@internal.post("/internal/media/auth", include_in_schema=False)
async def media_auth(request: Request):
    """MediaMTX `authMethod: http` callback. Reachable only on the internal network (the reverse proxy blocks /internal/)."""
    ctx = ctx_of(request)
    body = await request.json()
    ok, why = ctx.media_auth.authorize(body)
    return JSONResponse({"ok": ok}, status_code=200 if ok else 401)
