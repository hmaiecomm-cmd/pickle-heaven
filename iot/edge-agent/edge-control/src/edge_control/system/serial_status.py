"""Serial port presence (stable paths).  Read-only: never opens a port."""
from __future__ import annotations

import os
from pathlib import Path

from edge_control.config.schema import Deployment


def serial_status(dep: Deployment) -> list[dict]:
    out = []
    for b in dep.buses:
        entry = {"bus_id": b.bus_id, "serial_path": b.serial_path, "protocol_profile": b.protocol_profile}
        if not b.serial_path:
            entry.update(state="not_configured")
        else:
            p = Path(b.serial_path)
            entry.update(state="present" if p.exists() else "missing",
                         stable_path=b.serial_path.startswith("/dev/serial/by-id/") or b.serial_path.startswith("/dev/serial/by-path/"),
                         readable=os.access(p, os.R_OK | os.W_OK) if p.exists() else False)
        out.append(entry)
    return out
