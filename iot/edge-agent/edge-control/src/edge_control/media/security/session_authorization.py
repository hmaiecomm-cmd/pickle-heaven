"""Per-session media authorisation: short-lived viewer tokens, TURN REST credentials, and the decision made for
every MediaMTX HTTP-auth callback (verified payload fields: ip,user,password,token,action,path,protocol,id,query)."""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
from datetime import datetime
from urllib.parse import parse_qs

from edge_control.config.schema import MediaConfig
from edge_control.storage.database import Database
from edge_control.util import parse_iso, sha256_hex, utcnow


def new_viewer_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return sha256_hex(token)


def turn_credentials(secret: str, session_id: str, expires_at: datetime) -> tuple[str, str]:
    """coturn `use-auth-secret` style: username = <unix expiry>:<id>, credential = base64(HMAC-SHA1(secret, username))."""
    username = f"{int(expires_at.timestamp())}:{session_id}"
    digest = hmac.new(secret.encode(), username.encode(), hashlib.sha1).digest()
    return username, base64.b64encode(digest).decode()


def ice_servers(media: MediaConfig, session_id: str, expires_at: datetime) -> list[dict]:
    servers: list[dict] = []
    if media.stun_urls:
        servers.append({"urls": list(media.stun_urls)})
    secret = os.environ.get(media.turn_secret_env, "")
    if media.turn_enabled and media.turn_urls and secret:
        u, c = turn_credentials(secret, session_id, expires_at)  # per-session, expires with the session: never permanent
        servers.append({"urls": list(media.turn_urls), "username": u, "credential": c})
    return servers


class MediaAuthorizer:
    def __init__(self, db: Database, internal_user: str, internal_secret: str):
        self.db, self.internal_user, self.internal_secret = db, internal_user, internal_secret

    def authorize(self, req: dict) -> tuple[bool, str]:
        action = (req.get("action") or "").lower()
        path = (req.get("path") or "").strip("/")
        if action in ("publish", "api"):
            # NOTE: MediaMTX `authHTTPExclude` ALLOWS excluded actions without any check, so `api` is never excluded;
            # publishing and the control API both require the agent's internal credential instead.
            ok = bool(self.internal_secret) and req.get("user") == self.internal_user and \
                hmac.compare_digest(str(req.get("password") or ""), self.internal_secret)
            return ok, f"{action} requires the agent's internal credential"
        if action in ("read", "playback"):
            token = req.get("token") or req.get("password") or ""
            if not token:
                q = parse_qs(req.get("query") or "")
                token = (q.get("token") or [""])[0]
            if not token:
                return False, "no viewer token"
            row = self.db.fetchone("SELECT * FROM media_sessions WHERE token_hash=:h", h=hash_token(token))
            if not row:
                return False, "unknown token"
            if row["status"] != "ready":
                return False, f"session is {row['status']}"
            if parse_iso(row["expires_at"]) <= utcnow():
                return False, "session expired"
            if row["path_name"] != path:
                return False, "token is not valid for this path"
            return True, "ok"
        return False, f"action {action!r} not allowed through the public gateway"
