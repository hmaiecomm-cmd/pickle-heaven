"""Static SDK diagnostics: path, architecture, libraries, loadability.  Never logs in to any device."""
from __future__ import annotations

import ctypes
import json
import platform
from pathlib import Path
from typing import Any

ARCH_DIRS = {"x86_64": "linux-x86_64", "amd64": "linux-x86_64", "aarch64": "linux-aarch64", "arm64": "linux-aarch64"}


def check_sdk(sdk_dir: str | Path | None, *, try_load: bool = True) -> dict[str, Any]:
    """Result `state`: unconfigured | missing | arch_mismatch | no_manifest | not_loadable | loadable.
    Only `manifest.json -> entry_library` is ever loaded (we do not guess the library name)."""
    res: dict[str, Any] = {"state": "unconfigured", "machine": platform.machine(), "system": platform.system(),
                           "sdk_dir_set": bool(sdk_dir), "libraries": [], "errors": []}
    if not sdk_dir:
        res["errors"].append("HIKVISION_SDK_DIR not set")
        return res
    root = Path(sdk_dir)
    if not root.is_dir():
        res.update(state="missing")
        res["errors"].append("SDK directory does not exist")
        return res
    arch_dir = ARCH_DIRS.get(platform.machine().lower())
    res["expected_arch_dir"] = arch_dir
    present = sorted(d.name for d in root.iterdir() if d.is_dir())
    res["arch_dirs_present"] = present
    base = root / arch_dir if arch_dir and (root / arch_dir).is_dir() else root
    libs = sorted(str(p.relative_to(root)) for p in base.rglob("*.so*") if p.is_file())
    res["libraries"] = libs
    if arch_dir and arch_dir not in present and not libs:
        res.update(state="arch_mismatch")
        res["errors"].append(f"no libraries for this machine ({platform.machine()}); package may be for another CPU")
        return res
    if platform.system() != "Linux":
        res.update(state="not_loadable")
        res["errors"].append("native SDK can only be loaded on Linux")
        return res
    manifest = root / "manifest.json"
    if not manifest.is_file():
        res.update(state="no_manifest")
        res["errors"].append("manifest.json missing (copy manifest.example.json and fill version/entry_library/sha256)")
        return res
    try:
        m = json.loads(manifest.read_text(encoding="utf-8"))
        res["manifest"] = {k: m.get(k) for k in ("version", "arch", "source", "acquired_on", "license", "entry_library")}
        entry = m["entry_library"]
    except Exception as e:  # noqa: BLE001
        res.update(state="no_manifest")
        res["errors"].append(f"manifest invalid: {type(e).__name__}")
        return res
    lib_path = base / entry
    if not lib_path.is_file():
        res.update(state="not_loadable")
        res["errors"].append("entry_library listed in manifest not found")
        return res
    if not try_load:
        res["state"] = "loadable_untested"
        return res
    try:
        ctypes.CDLL(str(lib_path))  # loads only; no function is called
        res["state"] = "loadable"
    except OSError as e:
        res.update(state="not_loadable")
        res["errors"].append(f"dlopen failed: {str(e)[:200]}")  # message names missing dependencies
    return res
