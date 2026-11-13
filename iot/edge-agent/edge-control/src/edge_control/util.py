"""Small shared helpers: time, ids, hashing, secret redaction."""
from __future__ import annotations

import hashlib
import json
import re
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote, urlsplit, urlunsplit


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def to_iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_iso(value: str) -> datetime:
    """Parse an ISO-8601 string. Naive values are rejected: timezone is mandatory."""
    v = value.strip()
    if v.endswith("Z") or v.endswith("z"):
        v = v[:-1] + "+00:00"
    dt = datetime.fromisoformat(v)
    if dt.tzinfo is None:
        raise ValueError("timestamp must include a timezone offset")
    return dt.astimezone(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:20]}"


def new_secret(nbytes: int = 24) -> str:
    return secrets.token_urlsafe(nbytes)


def canonical_json(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def payload_hash(obj: Any) -> str:
    return hashlib.sha256(canonical_json(obj).encode("utf-8")).hexdigest()


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------- redaction
_URL_CRED = re.compile(r"(?P<scheme>[a-zA-Z][a-zA-Z0-9+.-]*://)(?P<user>[^/@\s:]*)(?::(?P<pw>[^/@\s]*))?@")
_BEARER = re.compile(r"(?i)(bearer\s+)[A-Za-z0-9._~+/=\-]+")
_KV = re.compile(r"(?i)\b(password|passwd|pwd|token|secret|authorization|api[_-]?key)\b(\s*[=:]\s*)([^\s,;&\"']+)")
REDACTED = "***"


def redact_text(text: str, extra_secrets: list[str] | None = None) -> str:
    """Mask credentials inside arbitrary text (logs, error messages, FFmpeg stderr)."""
    if not text:
        return text
    out = _URL_CRED.sub(lambda m: f"{m.group('scheme')}{REDACTED}:{REDACTED}@" if m.group("pw") is not None
                        else f"{m.group('scheme')}{REDACTED}@", text)
    out = _BEARER.sub(lambda m: m.group(1) + REDACTED, out)
    out = _KV.sub(lambda m: f"{m.group(1)}{m.group(2)}{REDACTED}", out)
    for s in extra_secrets or []:
        if s and len(s) >= 3:
            out = out.replace(s, REDACTED)
            out = out.replace(quote(s, safe=""), REDACTED)
    return out


_SENSITIVE_KEYS = ("password", "passwd", "secret", "token", "authorization", "api_key", "apikey", "credential")


def redact_obj(obj: Any) -> Any:
    """Recursively mask sensitive keys and credential-bearing URLs in a JSON-like structure."""
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if any(s in str(k).lower() for s in _SENSITIVE_KEYS) and v not in (None, "")                     and not isinstance(v, bool) and v not in ("set", "unset"):  # presence flags are not secrets
                out[k] = REDACTED
            else:
                out[k] = redact_obj(v)
        return out
    if isinstance(obj, (list, tuple)):
        return [redact_obj(v) for v in obj]
    if isinstance(obj, str):
        return redact_text(obj)
    return obj


def build_rtsp_url(host: str, port: int, path: str, username: str | None, password: str | None) -> str:
    """Build an RTSP URL with percent-encoded credentials. The result contains secrets:
    it must only be handed to MediaMTX/FFmpeg and never logged or returned by an API."""
    userinfo = ""
    if username:
        userinfo = quote(username, safe="")
        if password is not None:
            userinfo += ":" + quote(password, safe="")
        userinfo += "@"
    host_part = f"[{host}]" if ":" in host and not host.startswith("[") else host
    if not path.startswith("/"):
        path = "/" + path
    return f"rtsp://{userinfo}{host_part}:{port}{path}"


def strip_url_credentials(url: str) -> str:
    parts = urlsplit(url)
    if parts.username is None and parts.password is None:
        return url
    host = parts.hostname or ""
    if ":" in host:
        host = f"[{host}]"
    netloc = host + (f":{parts.port}" if parts.port else "")
    return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))
