"""Environment-driven runtime settings (secrets come only from env vars or secret files)."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="EDGE_", env_file=".env", extra="ignore")

    site_id: str = "site-demo"
    id: str = "edge-demo"  # EDGE_ID
    config_dir: Path = Path("./config/examples")
    data_dir: Path = Path("./data")
    cache_dir: Path = Path("./data/cache")
    mode: Literal["mock", "real"] = "mock"

    auth_tokens: str = ""  # JSON list (dev) - prefer auth_tokens_file
    auth_tokens_file: Path | None = None
    session_ttl_seconds: int = 3600
    cors_origins: list[str] = Field(default_factory=list)
    cookie_secure: bool = False  # set true behind HTTPS

    cloud_url: str = ""
    cloud_token_file: Path | None = None
    cloud_token: str = ""

    mediamtx_api_url: str = "http://127.0.0.1:9997"
    mediamtx_rtsp_publish_url: str = "rtsp://127.0.0.1:8554"
    mediamtx_public_whep_base: str = ""  # e.g. https://edge.example/media  (browser-visible)
    media_backend: Literal["auto", "mock", "mediamtx"] = "auto"
    media_internal_secret: str = ""
    media_internal_user: str = "edge-agent"
    ffmpeg_path: str = "ffmpeg"

    background_workers: bool = True
    worker_threads: int = 4
    host: str = "0.0.0.0"
    port: int = 8000

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return []
            if v.startswith("["):
                return json.loads(v)
            return [s.strip() for s in v.split(",") if s.strip()]
        return v

    @property
    def db_path(self) -> Path:
        return self.data_dir / "edge-control.db"


class HikvisionEnv(BaseSettings):
    """HIKVISION_* variables.  Values are never logged or exposed by any API."""
    model_config = SettingsConfigDict(env_prefix="HIKVISION_", env_file=".env", extra="ignore")

    host: str = ""
    username: str = ""
    password: str = ""
    rtsp_port: int | None = None
    http_port: int | None = None
    http_scheme: Literal["http", "https"] = "http"
    sdk_port: int | None = None
    sdk_dir: str = ""
    device_timezone: str = "Asia/Taipei"

    @field_validator("rtsp_port", "http_port", "sdk_port", mode="before")
    @classmethod
    def _empty_none(cls, v: Any) -> Any:
        return None if v in ("", None) else v

    @property
    def configured(self) -> bool:
        return bool(self.host and self.username and self.password)
