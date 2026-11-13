# Hikvision Linux SDK — operator installation

The SDK is optional. Without it, RS-485 control, Mock mode and RTSP live view all work; only SDK features show `unavailable`.

1. Open https://open.hikvision.com/download/5cda567cf47ae80dd41a54b3?type=10 in a browser, sign in / accept the licence **yourself**.
2. Pick the **device network SDK for NVR on Linux** (not a platform/iVMS/other-product SDK) matching `uname -m`
   (`x86_64` → linux-x86_64, `aarch64` → linux-aarch64). Do not assume an ARM64 build exists; check glibc (`ldd --version`).
3. Unpack into `vendor/hikvision/sdk/<arch>/` (libraries) and headers into `vendor/hikvision/include/`.
   These paths are git-ignored: **never commit** `.so`, headers or the archive unless the licence allows redistribution.
4. Copy `vendor/hikvision/manifest.example.json` → `manifest.json`; fill version, arch, source, acquired date, SHA-256 of the archive,
   licence, and the exact `entry_library` filename from the package.
5. Check: `HIKVISION_SDK_DIR=$PWD/vendor/hikvision python scripts/check_hikvision_sdk.py` (states: `unconfigured`, `missing`,
   `arch_mismatch`, `no_manifest`, `not_loadable` (message names missing deps), `loadable`). It never logs in to a device.
6. Binding: write `edge_control/drivers/nvr/hikvision/official_binding.py` from the package's **own headers** (struct packing, constants,
   function signatures, callback types) and make `load_official_binding` return it. Then set `sdk_binding: official` in `hikvision.yaml`
   and confirm capabilities one by one.
7. Docker: compose mounts `../vendor/hikvision` read-only at `/opt/hikvision-sdk`; set `HIKVISION_SDK_DIR=/opt/hikvision-sdk`.
   The image must contain the SDK's runtime deps (glibc-based image; add packages the `not_loadable` message names).
8. Before enabling playback via SDK callbacks: determine whether the callback delivers PS, a vendor container or elementary stream and
   build the matching demux/remux step (SDK bytes are **not** RTSP). `worker.py` already writes callback data to a sink file/FIFO
   from a bounded queue; the FFmpeg input format must be set after that determination.
