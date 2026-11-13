from __future__ import annotations

import json
import shutil
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from edge_control.api.app import create_app  # noqa: E402
from edge_control.config.settings import HikvisionEnv, Settings  # noqa: E402
from edge_control.context import AppContext  # noqa: E402
from edge_control.media.gateway_client import FakeGateway  # noqa: E402

TOKENS = [
    {"token": "viewer-token-123", "role": "viewer", "actor": "viewer1"},
    {"token": "viewer2-token-123", "role": "viewer", "actor": "viewer2"},
    {"token": "operator-token-123", "role": "operator", "actor": "op1"},
    {"token": "admin-token-12345", "role": "admin", "actor": "admin1"},
    {"token": "cam4only-token-123", "role": "viewer", "actor": "cam4", "cameras": ["camera-04"]},
]
H = {k: {"Authorization": f"Bearer {t}"} for k, t in
     (("viewer", "viewer-token-123"), ("viewer2", "viewer2-token-123"), ("operator", "operator-token-123"),
      ("admin", "admin-token-12345"), ("cam4", "cam4only-token-123"))}


def future(seconds: int = 60) -> str:
    return (datetime.now(timezone.utc) + timedelta(seconds=seconds)).isoformat()


def cid(prefix: str = "cmd") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


class Env:
    def __init__(self, app, client: TestClient, ctx: AppContext):
        self.app, self.client, self.ctx = app, client, ctx

    def drain(self):
        self.ctx.worker.run_pending()


def build_env(tmp_path: Path, *, mode: str = "mock", tokens=TOKENS, gateway=None, config_overrides: dict | None = None) -> Env:
    cfg_dir = tmp_path / "config"
    shutil.copytree(ROOT / "config" / "examples", cfg_dir)
    for name, text in (config_overrides or {}).items():
        (cfg_dir / name).write_text(text, encoding="utf-8")
    s = Settings(config_dir=cfg_dir, data_dir=tmp_path / "data", cache_dir=tmp_path / "cache", mode=mode,
                 auth_tokens=json.dumps(tokens), background_workers=False, media_internal_secret="internal-secret-xyz",
                 media_backend="mock", _env_file=None)
    ctx = AppContext(s, gateway=gateway or FakeGateway(), hik_env=HikvisionEnv(_env_file=None))
    app = create_app(s, ctx)
    client = TestClient(app)
    client.__enter__()
    return Env(app, client, ctx)


@pytest.fixture()
def env(tmp_path):
    e = build_env(tmp_path)
    yield e
    e.client.__exit__(None, None, None)


@pytest.fixture()
def real_env(tmp_path):
    e = build_env(tmp_path, mode="real")
    yield e
    e.client.__exit__(None, None, None)
