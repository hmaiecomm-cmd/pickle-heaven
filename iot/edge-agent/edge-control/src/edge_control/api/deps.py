"""Authentication / authorisation dependencies."""
from __future__ import annotations

import hmac
import threading
import time
from typing import Callable

from fastapi import Depends, Request

from edge_control.context import AppContext
from edge_control.errors import Forbidden, Unauthorized
from edge_control.security.permissions import Principal, require_role
from edge_control.util import new_secret

COOKIE = "edge_session"
SAFE = {"GET", "HEAD", "OPTIONS"}


class WebSessions:
    """In-memory cookie sessions: the long-lived token is exchanged once and never stored in the browser."""

    def __init__(self, ttl: int):
        self.ttl = ttl
        self._s: dict[str, tuple[Principal, float]] = {}
        self._lock = threading.Lock()

    def create(self, p: Principal) -> str:
        sid = new_secret(32)
        with self._lock:
            self._s[sid] = (p, time.time() + self.ttl)
        return sid

    def get(self, sid: str) -> Principal | None:
        with self._lock:
            v = self._s.get(sid)
            if not v or v[1] < time.time():
                self._s.pop(sid, None)
                return None
            return v[0]

    def drop(self, sid: str) -> None:
        with self._lock:
            self._s.pop(sid, None)


def ctx_of(request: Request) -> AppContext:
    return request.app.state.ctx


def match_token(ctx: AppContext, token: str) -> Principal | None:
    found = None
    for t, p in ctx.tokens.items():  # compare every token in constant time per comparison
        if hmac.compare_digest(t.encode(), token.encode()):
            found = p
    return found


def check_site(ctx: AppContext, request: Request, p: Principal) -> None:
    """site_id / edge_id are never trusted from clients: if sent they must equal the local identity."""
    for hdr, want in (("x-site-id", ctx.cfg.site.site_id), ("x-edge-id", ctx.cfg.site.edge_id)):
        got = request.headers.get(hdr)
        if got and got != want:
            raise Forbidden(f"{hdr} does not match this edge", code="site_mismatch")
    if p.site_id and p.site_id != ctx.cfg.site.site_id:
        raise Forbidden("token belongs to another site", code="site_mismatch")


def principal(request: Request) -> Principal:
    ctx = ctx_of(request)
    auth = request.headers.get("authorization", "")
    p: Principal | None = None
    if auth.lower().startswith("bearer "):
        p = match_token(ctx, auth[7:].strip())
        if p is None:
            raise Unauthorized("invalid bearer token", code="invalid_token")
    else:
        sid = request.cookies.get(COOKIE)
        if sid:
            sp = request.app.state.web_sessions.get(sid)
            if sp is not None:
                if request.method not in SAFE and request.headers.get("x-requested-with") != "edge-web":
                    raise Forbidden("missing CSRF header", code="csrf_required")
                p = Principal(actor=sp.actor, role=sp.role, devices=sp.devices, cameras=sp.cameras, site_id=sp.site_id, via="session")
    if p is None:
        raise Unauthorized("authentication required", code="unauthorized")
    check_site(ctx, request, p)
    request.state.principal = p
    return p


def role_dep(minimum: str) -> Callable[..., Principal]:
    def dep(p: Principal = Depends(principal)) -> Principal:
        require_role(p, minimum)
        return p
    return dep


viewer = role_dep("viewer")
operator = role_dep("operator")
admin = role_dep("admin")


def check_body_identity(ctx: AppContext, site_id: str | None, edge_id: str | None) -> None:
    if site_id is not None and site_id != ctx.cfg.site.site_id:
        raise Forbidden("site_id does not match this edge", code="site_mismatch")
    if edge_id is not None and edge_id != ctx.cfg.site.edge_id:
        raise Forbidden("edge_id does not match this edge", code="site_mismatch")
