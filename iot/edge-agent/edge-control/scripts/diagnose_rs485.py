#!/usr/bin/env python3
"""RS-485 adapter diagnostics. READ-ONLY: lists serial ports, checks configured stable paths and permissions.
It never opens a port for writing and never sends a protocol frame (so it cannot actuate anything).

    python scripts/diagnose_rs485.py [--mapping exported-mapping.json]
"""
import argparse
import json
import os
import sys
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("--mapping", help="mapping JSON exported from the UI/API (GET /v1/mapping/export)")
ns = ap.parse_args()

print("== by-id (stable) ==")
byid = Path("/dev/serial/by-id")
if byid.is_dir():
    for p in sorted(byid.iterdir()):
        print(f"  {p.name} -> {os.path.realpath(p)}")
else:
    print("  /dev/serial/by-id not present (not Linux, or no USB serial adapters)")

try:
    from serial.tools import list_ports
    print("== pyserial ports ==")
    for p in list_ports.comports():
        print(f"  {p.device}  vid:pid={p.vid}:{p.pid}  serial={p.serial_number}  {p.description}")
except Exception as e:  # noqa: BLE001
    print("pyserial unavailable:", type(e).__name__)

if ns.mapping:
    dep = json.loads(Path(ns.mapping).read_text(encoding="utf-8"))
    print("== configured buses ==")
    for b in dep.get("buses", []):
        sp = b.get("serial_path")
        if not sp:
            print(f"  {b['bus_id']}: serial_path not configured")
            continue
        exists = Path(sp).exists()
        ok = os.access(sp, os.R_OK | os.W_OK) if exists else False
        stable = sp.startswith(("/dev/serial/by-id/", "/dev/serial/by-path/"))
        print(f"  {b['bus_id']}: {sp} exists={exists} rw={ok} stable_path={stable} profile={b.get('protocol_profile')}")
sys.exit(0)
