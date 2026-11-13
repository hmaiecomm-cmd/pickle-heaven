"""Secrets come from environment variables or secret files only."""
from __future__ import annotations

import json
import os
from pathlib import Path

from edge_control.config.settings import HikvisionEnv, Settings
from edge_control.errors import NotConfigured
from edge_control.security.permissions import ROLE_RANK, Principal


def read_secret(name: str, default: str = "") -> str:
    """NAME wins; otherwise NAME_FILE points to a file (Docker/K8s style)."""
    v = os.environ.get(name)
    if v:
        return v
    f = os.environ.get(name + "_FILE")
    if f and Path(f).is_file():
        return Path(f).read_text(encoding="utf-8").strip()
    return default


def load_tokens(settings: Settings) -> dict[str, Principal]:
    raw = ""
    if settings.auth_tokens_file:
        p = Path(settings.auth_tokens_file)
        if not p.is_file():
            raise NotConfigured(f"EDGE_AUTH_TOKENS_FILE not found: {p}", code="auth_not_configured")
        raw = p.read_text(encoding="utf-8")
    elif settings.auth_tokens.strip():
        raw = settings.auth_tokens
    if not raw.strip():
        return {}
    try:
        items = json.loads(raw)
        out: dict[str, Principal] = {}
        for it in items:
            if it["role"] not in ROLE_RANK:
                raise ValueError(f"bad role {it['role']!r}")
            if len(it["token"]) < 8:
                raise ValueError("token too short")
            out[it["token"]] = Principal(actor=it.get("actor", it["role"]), role=it["role"],
                                         devices=tuple(it.get("devices", ["*"])),
                                         cameras=tuple(it.get("cameras", ["*"])), site_id=it.get("site_id"))
        return out
    except Exception as e:  # noqa: BLE001
        raise NotConfigured(f"auth token configuration invalid: {type(e).__name__}: {e}", code="auth_not_configured") from e


def hikvision_credentials(env: HikvisionEnv) -> tuple[str, str]:
    user = env.username or read_secret("HIKVISION_USERNAME")
    pw = env.password or read_secret("HIKVISION_PASSWORD")
    return user, pw


def cloud_token(settings: Settings) -> str:
    if settings.cloud_token:
        return settings.cloud_token
    if settings.cloud_token_file and Path(settings.cloud_token_file).is_file():
        return Path(settings.cloud_token_file).read_text(encoding="utf-8").strip()
    return ""
