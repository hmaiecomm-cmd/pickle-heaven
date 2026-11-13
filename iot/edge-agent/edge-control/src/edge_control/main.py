"""Entry point: single process, single Edge Agent (never run multiple workers: one owner per serial port)."""
from __future__ import annotations

import sys

import uvicorn

from edge_control.config.settings import Settings
from edge_control.errors import NotConfigured


def run() -> None:
    settings = Settings()
    try:
        from edge_control.api.app import create_app
        app = create_app(settings)
    except NotConfigured as e:
        print(f"FATAL: {e.message}", file=sys.stderr)
        raise SystemExit(2) from e
    uvicorn.run(app, host=settings.host, port=settings.port, workers=1, log_level="info")


if __name__ == "__main__":
    run()
