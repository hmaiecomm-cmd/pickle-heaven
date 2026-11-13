"""FastAPI application factory."""
from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from edge_control.api import routes_admin, routes_control, routes_media
from edge_control.api.deps import WebSessions
from edge_control.config.settings import Settings
from edge_control.context import AppContext
from edge_control.errors import EdgeError
from edge_control.logging_setup import setup_logging
from edge_control.util import redact_obj

log = logging.getLogger("edge.api")


def create_app(settings: Settings | None = None, ctx: AppContext | None = None) -> FastAPI:
    settings = settings or Settings()
    setup_logging()
    ctx = ctx or AppContext(settings)  # raises NotConfigured when no credentials exist: no unauthenticated start

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        ctx.start()
        log.info("edge-control started mode=%s site=%s", settings.mode, ctx.cfg.site.site_id)
        yield
        ctx.stop()

    app = FastAPI(title="顧好 Edge Control API", version="0.1.0", lifespan=lifespan,
                  description="Edge agent REST API: RS-485 device control (Mock by default) and RTSP→WebRTC media sessions.")
    app.state.ctx = ctx
    app.state.web_sessions = WebSessions(settings.session_ttl_seconds)

    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True,
                       allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
                       allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "X-Requested-With", "X-Site-Id", "X-Edge-Id"])

    @app.middleware("http")
    async def request_id(request: Request, call_next):
        rid = request.headers.get("x-request-id") or uuid.uuid4().hex[:16]
        request.state.request_id = rid
        resp = await call_next(request)
        resp.headers["X-Request-Id"] = rid
        resp.headers["Cache-Control"] = "no-store"
        return resp

    def err(request: Request, status: int, code: str, message: str, details=None) -> JSONResponse:
        return JSONResponse({"code": code, "message": message, "request_id": getattr(request.state, "request_id", None),
                             "details": redact_obj(details or {})}, status_code=status)

    @app.exception_handler(EdgeError)
    async def _edge(request: Request, e: EdgeError):
        return err(request, e.status_code, e.code, e.message, e.details)

    @app.exception_handler(RequestValidationError)
    async def _val(request: Request, e: RequestValidationError):
        items = [{"loc": [str(x) for x in i["loc"]], "msg": i["msg"], "type": i["type"]} for i in e.errors()]
        return err(request, 422, "invalid_request", "request validation failed", {"errors": items})

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, e: StarletteHTTPException):
        return err(request, e.status_code, {404: "not_found", 405: "method_not_allowed"}.get(e.status_code, "http_error"), str(e.detail))

    @app.exception_handler(Exception)
    async def _any(request: Request, e: Exception):
        log.exception("unhandled error")
        return err(request, 500, "internal_error", "internal error")

    app.include_router(routes_admin.router)
    app.include_router(routes_control.router)
    app.include_router(routes_media.router)
    app.include_router(routes_media.internal)

    web_dist = Path(__file__).resolve().parents[3] / "web" / "dist"
    if web_dist.is_dir():  # optional: serve the built UI directly (Caddy normally does this)
        app.mount("/", StaticFiles(directory=web_dist, html=True), name="web")
    return app
