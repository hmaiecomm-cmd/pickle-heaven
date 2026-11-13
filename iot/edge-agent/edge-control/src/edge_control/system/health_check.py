"""Aggregated system diagnostics (no secrets, no side effects on devices)."""
from __future__ import annotations

from typing import TYPE_CHECKING, Any

from edge_control.drivers.nvr.hikvision.sdk_loader import check_sdk
from edge_control.system.network_status import network_status
from edge_control.system.serial_status import serial_status
from edge_control.system.service_status import tool_status
from edge_control.util import to_iso, utcnow

if TYPE_CHECKING:
    from edge_control.context import AppContext


def liveness(ctx: "AppContext") -> dict[str, Any]:
    db_ok = True
    try:
        ctx.db.fetchone("SELECT 1 AS x")
    except Exception:  # noqa: BLE001
        db_ok = False
    return {"status": "ok" if db_ok else "degraded", "mode": ctx.settings.mode, "site_id": ctx.cfg.site.site_id,
            "edge_id": ctx.cfg.site.edge_id, "time": to_iso(utcnow()), "database": "ok" if db_ok else "error",
            "mock": ctx.settings.mode == "mock"}


def system_status(ctx: "AppContext") -> dict[str, Any]:
    rev, dep = ctx.deployment.active()
    gw = ctx.gateway.health()
    hik_env = ctx.hik_env
    sdk_state = check_sdk(hik_env.sdk_dir or None, try_load=False)
    st = {
        **liveness(ctx),
        "simulation_mapping": dep.simulation_only,
        "mapping_revision": rev,
        "commands": {"active": ctx.commands.active_count(),
                     "recent_failed": len([c for c in ctx.commands.list_recent(50) if c["status"] in ("failed", "unknown")])},
        "buses": serial_status(dep),
        "network": network_status(),
        "media": {"gateway": gw, "tools": tool_status(ctx.settings.ffmpeg_path), "ffmpeg_jobs": ctx.procs.count(),
                  "live_sessions": ctx.sessions.active_count("live"), "playback_sessions": ctx.sessions.active_count("playback")},
        "nvr": {"driver": ctx.nvr.mode, "capabilities": ctx.nvr.capabilities(),
                "hikvision_configured": hik_env.configured,  # booleans only, never values
                "sdk": {"state": sdk_state["state"], "worker": ctx.sdk.health() if ctx.sdk else {"binding": "none"}}},
        "cloud": {"enabled": ctx.cloud.enabled, "client": ctx.cloud.name, "last_event_success": ctx.reporter.last_success,
                  "last_error": ctx.reporter.last_error or ctx.heartbeat.last_error,
                  "heartbeat_last_success": ctx.heartbeat.last_success, "outbox": ctx.outbox.stats()},
        "auth": {"tokens_configured": len(ctx.tokens)},
        "warnings": list(ctx.cfg.warnings),
    }
    return st
