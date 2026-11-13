# REST workflows for live and history

REST is the **cloud → edge control** interface. The NVR itself has no "start RTSP" endpoint; RTSP is negotiated by MediaMTX/FFmpeg.
Stopping a session releases viewing resources only — NVR recording is never touched.

## Live: cloud → Edge REST → permission + camera mapping → NVR driver → MediaMTX pulls RTSP → (transcode if needed) → WebRTC (WHEP)
```bash
B=http://localhost:8080 ; T=dev-viewer-token
curl -s -X POST $B/v1/cameras/camera-04/live-sessions -H "Authorization: Bearer $T" -H "Idempotency-Key: demo-1" \
  -H 'Content-Type: application/json' -d '{"stream_profile":"sub","delivery_target":"browser","ttl_seconds":300}'
# 202 {"session_id":"ses_…","camera_id":"camera-04","kind":"live","status":"preparing","status_url":"/v1/live-sessions/ses_…"}
curl -s $B/v1/live-sessions/<id> -H "Authorization: Bearer $T"      # → status ready + playback{url,token,ice_servers}
curl -s -X DELETE $B/v1/live-sessions/<id> -H "Authorization: Bearer $T"
```
Statuses: preparing, ready, failed (`error.code`), stopped, expired. No playback URL exists while `preparing`. Sessions on the same camera/profile share one
source (reference-counted) but each viewer has its own token; one stopping never cuts another.

## History: search → choose segment → create playback → NVR source/bridge → WebRTC
```bash
curl -s "$B/v1/cameras/camera-06/recordings?from=2026-11-10T00:00:00%2B08:00&to=2026-11-12T00:00:00%2B08:00" -H "Authorization: Bearer $T"
curl -s -X POST $B/v1/cameras/camera-06/playback-sessions -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d '{"start_time":"2026-11-12T10:00:00+08:00","end_time":"2026-11-12T10:10:00+08:00","delivery_target":"browser","ttl_seconds":900}'
curl -s $B/v1/playback-sessions/<id> -H "Authorization: Bearer $T" ; curl -s -X DELETE $B/v1/playback-sessions/<id> -H "Authorization: Bearer $T"
```
(Dates are format examples, not a promise of recordings.) Creation first checks recordings exist (`404 no_recording` otherwise, no session created).
Each playback has its own path `playback/<session_id>` and pipeline; seek = delete + create with a new `start_time`. pause/speed/seek are not offered
(capability flags false). Stable errors: `no_recording`, `camera_unbound`, `camera_capability_unavailable`, `nvr_not_configured`, `rtsp_template_not_configured`,
`prepare_timeout`, `source_unavailable`, `media_tool_missing`, `media_gateway_unavailable`, `resource_limit`, `session_limit_per_actor`, `delivery_target_not_configured`.

## delivery_target
`browser` (Edge media service serves WHEP; ICE/STUN/TURN per `media.yaml`). `cloud_media`: reserved — without a configured receiver it returns
`503 delivery_target_not_configured`; with one configured it returns `501 delivery_target_unsupported` until an adapter (e.g. WHIP, if the platform supports it) is built.
