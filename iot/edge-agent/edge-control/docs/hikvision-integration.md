# Hikvision NVR integration

## Sources read (date 2026-11-12)
| Source | Result |
|---|---|
| knowbot.hikvision.com RTSP page → 录像机【实时预览】 | read in a browser: `rtsp://user:pwd@IP:554/Streaming/Channels/101` (101 = ch1 main, 102 = ch1 sub, 103 = third stream, 1201 = ch12 main); multicast `?transportmode=multicast`; pre-2012 devices `/h264/ch1/main/av_stream`; "RTSP cannot pull the whole NVR" |
| same → 录像机【回放录像】 | `rtsp://user:pwd@IP:554/Streaming/tracks/<channel+stream>?starttime=20221201t010000z&endtime=20221201t040000z` |
| same → 摄像机 sections | not read |
| open.hikvision.com SDK download | not reachable here; nothing downloaded |

The patterns are **documentation examples, not confirmed for the venue's NVR**. They are therefore *not* hard-coded:
templates live in `config/examples/hikvision.yaml` (commented candidates), per-camera ids in the deployment mapping.

## Capability matrix (what the code does today)
| Function | RTSP | ISAPI | SDK | State |
|---|---|---|---|---|
| Live view | ✔ URL built from template + `rtsp_stream_ids[profile]`, creds percent-encoded | – | – | needs template + env; **unverified on hardware** |
| Search recordings | – | `unsupported` (`isapi_search_unverified`) | `unsupported` until an official binding exists | Mock only |
| Playback | candidate via `playback_path_template` (RTSP) | – | bridge implemented generically, native part missing | Mock + unverified RTSP path |
| Download | – | – | – | not implemented |
| pause / speed / seek | not offered (UI disabled) | | | capability flags default false |

`strategy: auto` follows only capabilities marked confirmed (`capabilities_confirmed: true`). Wrong credentials are reported
(`nvr_auth_failed`) and **never retried across interfaces**.

## Identifiers are never assumed equal
`logical_camera_id` (camera-04) ≠ `nvr_channel` ≠ `isapi_track_id` ≠ `sdk_channel_id` ≠ `rtsp_stream_ids.{main,sub}`.
camera-01 is not bound to channel 1; `101/102` is not applied automatically.

## Codec
`needs_transcode`: copy only for H.264/VP8/VP9/AV1; H.265/unknown → libx264 (CPU cost, bounded by `max_ffmpeg_jobs`). Audio is dropped
(AAC is not a WebRTC codec).

## SDK isolation
`drivers/nvr/hikvision/`: `sdk_loader.py` (static check), `runtime.py` (ref-counted init/cleanup), `session.py` (login/handles,
bounded `ChunkQueue`, strong callback refs), `worker.py` (subprocess, JSON-lines IPC), `client.py` (timeouts, restart, generation
counter → old sessions invalid), `binding.py` (contract + `FakeSdkBinding`; official binding **must be generated from the
package headers**). Tested with the fake binding including worker crash/restart.

## Not verified
No real NVR, no real Hikvision SDK, no real recordings were used. Everything Hikvision-specific marked "unverified" above is exactly that.
