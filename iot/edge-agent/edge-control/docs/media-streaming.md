# Media streaming (MediaMTX + FFmpeg + WebRTC)

- MediaMTX pinned to **v1.21.3**. Verified against that release: API `POST /v3/config/paths/add/{name}`, `DELETE …/delete/{name}`, `GET /v3/paths/get/{name}` (`ready`),
  HTTP-auth payload fields `ip,user,password,token,action,path,protocol,id,query` (Bearer tokens arrive in `token`).
- **Gateway auth**: `authMethod: http` → `POST /internal/media/auth` on the agent. `read`/`playback` need a per-session token valid for exactly that path while the session is `ready`
  and unexpired; `publish` and `api` need the agent's internal credential (`EDGE_MEDIA_INTERNAL_SECRET`). Everything else is denied. Note: `authHTTPExclude` would *allow*
  excluded actions unchecked, so it is empty. Port 9997 is never published; `/internal/*` is blocked by Caddy.
- **Live**: path `live/<camera>_<profile>`; MediaMTX pulls NVR RTSP (`sourceOnDemand: false`, config removed when the last viewer leaves). Ready = MediaMTX reports the path `ready`.
- **Playback**: path `playback/<session_id>`; FFmpeg (argv array, no shell) pulls the NVR playback URI (or a validated downloaded file) and publishes to MediaMTX. Job count, runtime and
  cache size are bounded; stop/expiry kills the process, deletes the path and removes temp files.
- **Demo/synthetic**: in Mock mode sources are FFmpeg `testsrc2` (H.264) published to MediaMTX. Without FFmpeg/MediaMTX sessions fail with `media_tool_missing` / `media_gateway_unavailable` — never a fake success.
- **WebRTC networking**: the HTTPS reverse proxy carries only WHEP signalling. Media needs ICE connectivity: UDP/TCP 8189 (published by compose) on the LAN, or STUN/TURN for remote viewers
  (`media.yaml`, `webrtcAdditionalHosts`, optional coturn in `services/turn`, short-lived HMAC credentials per session, no permanent TURN password in the browser).
  **Remote/NAT traversal has not been tested.**
- Ports: 8080 web+API+/media (Caddy); 8189 tcp/udp WebRTC media; internal only: 8000 agent, 9997 MediaMTX API, 8554 RTSP publish, 8889 WHEP.

## Verification status
Session/auth/refcount/cleanup logic: automated tests with a fake gateway. FFmpeg encoder settings for the synthetic source: tested locally. MediaMTX→browser WebRTC playback:
`tests/integration/test_e2e_webrtc.py` runs only when a `mediamtx` binary exists (it did not in the development environment) — see README "Verification".
