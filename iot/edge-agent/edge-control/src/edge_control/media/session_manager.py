"""Media session persistence, limits, token handling, readiness waiting and cleanup (shared by live + playback)."""
from __future__ import annotations

import json
import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from typing import Any, Callable

from edge_control.config.loader import AppConfig
from edge_control.config.schema import CameraBinding
from edge_control.errors import Conflict, EdgeError, Forbidden, NotFound, Unprocessable
from edge_control.media.gateway_client import GatewayClient
from edge_control.media.pipelines.process_manager import ProcessManager
from edge_control.media.security.session_authorization import hash_token, ice_servers, new_viewer_token
from edge_control.security.permissions import Principal
from edge_control.storage.database import Database
from edge_control.util import new_id, parse_iso, payload_hash, redact_text, to_iso, utcnow

log = logging.getLogger("edge.media")
ACTIVE = ("preparing", "ready")


class SessionManager:
    def __init__(self, *, db: Database, cfg: AppConfig, gateway: GatewayClient, procs: ProcessManager,
                 public_whep_base: str, binding_lookup: Callable[[str], tuple[int, CameraBinding | None]]):
        self.db, self.cfg, self.gateway, self.procs = db, cfg, gateway, procs
        self.whep_base = (public_whep_base or "/media").rstrip("/")
        self.binding_lookup = binding_lookup
        self._tokens: dict[str, str] = {}  # session_id -> plaintext token (memory only; lost on restart => sessions end)
        self._pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="media-prep")
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._janitor: threading.Thread | None = None
        self.on_release: list[Callable[[dict], None]] = []

    # ------------------------------------------------------------ queries
    def get_row(self, session_id: str, kind: str | None = None) -> dict:
        row = self.db.fetchone("SELECT * FROM media_sessions WHERE session_id=:i", i=session_id)
        if not row or (kind and row["kind"] != kind):
            raise NotFound("session not found", code="session_not_found")
        return row

    def authorize_access(self, row: dict, p: Principal) -> None:
        """Sessions are private to their creator; admins may inspect/stop any."""
        if row["actor"] != p.actor and not p.has_role("admin"):
            raise Forbidden("session belongs to another user", code="session_not_permitted")
        if not p.can_camera(row["camera_id"]):
            raise Forbidden("camera not permitted", code="camera_not_permitted")

    def active_count(self, kind: str, actor: str | None = None, camera_id: str | None = None) -> int:
        sql = "SELECT COUNT(*) AS n FROM media_sessions WHERE kind=:k AND status IN ('preparing','ready')"
        params: dict[str, Any] = {"k": kind}
        if actor:
            sql += " AND actor=:a"
            params["a"] = actor
        if camera_id:
            sql += " AND camera_id=:c"
            params["c"] = camera_id
        return int(self.db.fetchone(sql, **params)["n"])

    def active_on_path(self, path: str, exclude: str | None = None) -> int:
        r = self.db.fetchone("SELECT COUNT(*) AS n FROM media_sessions WHERE path_name=:p AND status IN ('preparing','ready') "
                             "AND session_id != :x", p=path, x=exclude or "")
        return int(r["n"])

    def cameras_with_active_sessions(self, camera_ids: set[str]) -> list[str]:
        if not camera_ids:
            return []
        rows = self.db.fetchall("SELECT DISTINCT camera_id FROM media_sessions WHERE status IN ('preparing','ready')")
        return sorted({r["camera_id"] for r in rows} & camera_ids)

    # ------------------------------------------------------------ creation
    def find_idempotent(self, actor: str, kind: str, key: str | None, req_hash: str) -> dict | None:
        if not key:
            return None
        row = self.db.fetchone("SELECT * FROM media_sessions WHERE actor=:a AND kind=:k AND idempotency_key=:i", a=actor, k=kind, i=key)
        if row is None:
            return None
        if row["request_hash"] != req_hash:
            raise Conflict("Idempotency-Key reused with a different request", code="idempotency_key_conflict")
        return row

    def insert(self, *, kind: str, camera_id: str, actor: str, profile: str | None, delivery_target: str, path_name: str,
               params: dict, ttl: int, idem_key: str | None, req_hash: str, mapping_revision: int,
               session_id: str | None = None) -> dict:
        sid = session_id or new_id("ses")
        now = utcnow()
        self.db.execute("""INSERT INTO media_sessions(session_id,kind,camera_id,actor,status,stream_profile,delivery_target,
            path_name,params,token_hash,idempotency_key,request_hash,mapping_revision,created_at,expires_at,updated_at)
            VALUES (:i,:k,:c,:a,'preparing',:pr,:d,:p,:pa,:th,:ik,:rh,:mr,:n,:e,:n)""",
                        i=sid, k=kind, c=camera_id, a=actor, pr=profile, d=delivery_target, p=path_name,
                        pa=json.dumps(params), th=None, ik=idem_key, rh=req_hash, mr=mapping_revision,
                        n=to_iso(now), e=to_iso(now + timedelta(seconds=ttl)))
        return self.get_row(sid)

    def submit_prepare(self, fn: Callable[[], None]) -> None:
        self._pool.submit(self._guard, fn)

    @staticmethod
    def _guard(fn: Callable[[], None]) -> None:
        try:
            fn()
        except Exception:  # noqa: BLE001
            log.exception("media prepare crashed")

    # ------------------------------------------------------------ state transitions
    def mark_ready(self, session_id: str) -> None:
        token = new_viewer_token()
        with self._lock:
            self._tokens[session_id] = token
        n = self.db.execute("UPDATE media_sessions SET status='ready', token_hash=:h, updated_at=:n "
                            "WHERE session_id=:i AND status='preparing'", h=hash_token(token), n=to_iso(utcnow()), i=session_id)
        if n == 0:  # stopped/expired while preparing: do not leave resources around
            self._tokens.pop(session_id, None)
            self.release_resources(self.get_row(session_id))

    def mark_failed(self, session_id: str, code: str, message: str) -> None:
        self.db.execute("UPDATE media_sessions SET status='failed', error_code=:c, error_message=:m, updated_at=:n "
                        "WHERE session_id=:i AND status='preparing'", c=code, m=redact_text(message)[:300],
                        n=to_iso(utcnow()), i=session_id)
        self.release_resources(self.get_row(session_id))

    def wait_ready(self, session_id: str, path: str) -> bool:
        deadline = time.monotonic() + self.cfg.media.prepare_timeout_seconds
        while time.monotonic() < deadline:
            row = self.get_row(session_id)
            if row["status"] != "preparing":
                return False
            try:
                if self.gateway.path_ready(path):
                    return True
            except EdgeError:
                pass
            job = self.procs.get(f"pub:{path}") or self.procs.get(f"pub:{session_id}")
            if job and job.exit_code is not None and job.exit_code != 0:
                return False
            time.sleep(0.25)
        return False

    def stop(self, session_id: str, status: str = "stopped") -> dict:
        row = self.get_row(session_id)
        if row["status"] in ACTIVE:
            self.db.execute("UPDATE media_sessions SET status=:s, updated_at=:n WHERE session_id=:i",
                            s=status, n=to_iso(utcnow()), i=session_id)
            self._tokens.pop(session_id, None)
            self.release_resources(row)
        return self.get_row(session_id)

    def release_resources(self, row: dict) -> None:
        """Refcounted: the shared live source/path is torn down only when the last viewer leaves."""
        path = row["path_name"]
        if path and self.active_on_path(path, exclude=row["session_id"]) == 0:
            self.procs.stop(f"pub:{path}")
            try:
                self.gateway.delete_path(path)
            except EdgeError:
                log.warning("gateway path cleanup failed for %s", path)
        self.procs.stop(f"pub:{row['session_id']}")
        for cb in self.on_release:
            try:
                cb(row)
            except Exception:  # noqa: BLE001
                log.exception("release hook failed")

    def expire_due(self) -> int:
        rows = self.db.fetchall("SELECT * FROM media_sessions WHERE status IN ('preparing','ready') AND expires_at<=:n", n=to_iso(utcnow()))
        for r in rows:
            self.stop(r["session_id"], "expired")
        return len(rows)

    def stop_all(self, status: str = "stopped") -> None:
        for r in self.db.fetchall("SELECT session_id FROM media_sessions WHERE status IN ('preparing','ready')"):
            self.stop(r["session_id"], status)

    # ------------------------------------------------------------ presentation
    def view(self, row: dict, base_url: str) -> dict:
        v: dict[str, Any] = {
            "session_id": row["session_id"], "camera_id": row["camera_id"], "kind": row["kind"], "status": row["status"],
            "stream_profile": row["stream_profile"], "delivery_target": row["delivery_target"],
            "created_at": row["created_at"], "expires_at": row["expires_at"],
            "status_url": f"{base_url}/{row['session_id']}"}
        if row.get("params"):
            v["params"] = json.loads(row["params"])
        if row["status"] == "ready" and row["delivery_target"] == "browser":
            tok = self._tokens.get(row["session_id"])
            if tok:  # only available to the authorised caller of this process lifetime
                v["playback"] = {"protocol": "whep", "url": f"{self.whep_base}/{row['path_name']}/whep",
                                 "token": tok, "token_expires_at": row["expires_at"],
                                 "ice_servers": ice_servers(self.cfg.media, row["session_id"], parse_iso(row["expires_at"]))}
        if row["status"] == "failed":
            v["error"] = {"code": row["error_code"], "message": row["error_message"]}
        return v

    # ------------------------------------------------------------ lifecycle
    def start_janitor(self, interval: float = 2.0) -> None:
        def loop() -> None:
            while not self._stop.wait(interval):
                try:
                    self.expire_due()
                except Exception:  # noqa: BLE001
                    log.exception("janitor failed")
        self._janitor = threading.Thread(target=loop, name="media-janitor", daemon=True)
        self._janitor.start()

    def recover_after_restart(self) -> int:
        """Viewer tokens and ffmpeg children do not survive a restart, so all open sessions end."""
        n = self.db.execute("UPDATE media_sessions SET status='stopped', error_code='agent_restarted', updated_at=:n "
                            "WHERE status IN ('preparing','ready')", n=to_iso(utcnow()))
        return n

    def shutdown(self) -> None:
        self._stop.set()
        self.stop_all()
        self.procs.shutdown()
        self._pool.shutdown(wait=False, cancel_futures=True)

    @staticmethod
    def request_hash(obj: Any) -> str:
        return payload_hash(obj)
