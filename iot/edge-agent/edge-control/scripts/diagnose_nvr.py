#!/usr/bin/env python3
"""NVR connectivity diagnostics (read-only). Uses HIKVISION_* env vars; prints only reachability, never secrets.

    python scripts/diagnose_nvr.py [--isapi]    # --isapi performs ONE Digest-auth GET /ISAPI/System/deviceInfo (no retries)
"""
import argparse
import socket
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from edge_control.config.settings import HikvisionEnv  # noqa: E402
from edge_control.drivers.nvr.isapi_driver import IsapiClient  # noqa: E402
from edge_control.errors import EdgeError  # noqa: E402
from edge_control.security.secret_provider import hikvision_credentials  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--isapi", action="store_true")
ns = ap.parse_args()
env = HikvisionEnv()
print("configured:", {"host": bool(env.host), "rtsp_port": env.rtsp_port, "http_port": env.http_port,
                      "credentials": bool(env.username and env.password), "sdk_dir": bool(env.sdk_dir)})
rc = 0
for name, port in (("rtsp", env.rtsp_port), ("http", env.http_port), ("sdk", env.sdk_port)):
    if not (env.host and port):
        print(f"{name}: not configured")
        continue
    try:
        with socket.create_connection((env.host, int(port)), timeout=3):
            print(f"{name}: TCP {port} reachable")
    except OSError as e:
        print(f"{name}: TCP {port} NOT reachable ({type(e).__name__})")
        rc = 1
if ns.isapi:
    try:
        print("isapi:", IsapiClient(env, *hikvision_credentials(env)).device_info())
    except EdgeError as e:
        print("isapi:", e.code, "-", e.message)
        rc = 1
sys.exit(rc)
