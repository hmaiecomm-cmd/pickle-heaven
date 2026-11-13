#!/usr/bin/env python3
"""Static Hikvision SDK check: path, architecture, library files, loadability. NEVER logs in to a device.

    HIKVISION_SDK_DIR=/opt/hikvision-sdk python scripts/check_hikvision_sdk.py [--no-load]
Exit code 0 only when the SDK is loadable.
"""
import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from edge_control.drivers.nvr.hikvision.sdk_loader import check_sdk  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--sdk-dir", default=os.environ.get("HIKVISION_SDK_DIR"))
ap.add_argument("--no-load", action="store_true", help="do not dlopen the entry library")
ns = ap.parse_args()
res = check_sdk(ns.sdk_dir, try_load=not ns.no_load)
print(json.dumps(res, indent=2, ensure_ascii=False))
print("\nNote: loadable != usable. A verified binding generated from the package's own headers is still required "
      "(docs/hikvision-sdk-installation.md).")
sys.exit(0 if res["state"] in ("loadable", "loadable_untested") else 1)
