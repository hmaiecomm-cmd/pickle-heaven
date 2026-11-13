# 顧好 Edge Control

Edge agent for a venue Linux PC. It receives cloud REST calls and controls **RS-485 devices** (air conditioner, door lock, 18 power circuits via relay controller)
and manages **camera streaming** (live RTSP → WebRTC, Hikvision NVR history → WebRTC). **Mock mode is the default**: no hardware, NVR or cloud is needed, and mock
results are always labelled `simulated` / `unverified` — they are never hardware confirmation.

## Quick start (Mock)
```bash
pip install -e ".[dev]"                       # Python ≥3.11 (Docker image uses 3.12)
cp .env.example .env                          # contains DEV-ONLY tokens
python -m edge_control.main                   # http://localhost:8000/docs  (refuses to start without credentials)
cd web && npm ci && npm run dev               # UI http://localhost:5173  (log in with a token from .env)
# or the whole stack:  cd deploy && cp ../.env.example .env && docker compose up -d --build   (UI :8080)
```
Docs/API: `/docs` (Swagger), `contracts/openapi.yaml` (exported from the real routes by `scripts/export_openapi.py`), UI: Overview → system status.

## Mock ↔ real
`EDGE_MODE=mock|real` sets the default; each device in `config/examples/devices.yaml` can choose `driver: mock|real`. A `real` driver whose model/protocol is unknown answers
`driver_not_configured`; the real relay mapping starts **all 18 circuits unbound** (`circuit_unbound`). Real buses/controllers/addresses are entered by an Admin in
System → 部署與位址映射 (draft → validate → diff → apply, versioned, rollback). Mock uses a separate simulation-only mapping — never copy it into production.

## curl examples
```bash
B=http://localhost:8000; O="Authorization: Bearer dev-operator-token"; E=$(date -u -d '+60 sec' +%FT%TZ)
curl -s $B/v1/health
curl -s -X PUT $B/v1/relay/circuits/circuit-01/state -H "$O" -H 'Content-Type: application/json' \
     -d "{\"command_id\":\"demo-0001\",\"expires_at\":\"$E\",\"state\":\"on\"}"      # 202 {command_id,status,status_url}
curl -s $B/v1/commands/demo-0001 -H "$O"
curl -s -X PATCH $B/v1/hvac/hvac-1/settings -H "$O" -H 'Content-Type: application/json' -d "{\"command_id\":\"demo-0002\",\"expires_at\":\"$E\",\"power\":true,\"setpoint_c\":25}"
curl -s -X POST  $B/v1/access/door-1/unlock -H "$O" -H 'Content-Type: application/json' -d "{\"command_id\":\"demo-0003\",\"expires_at\":\"$E\"}"
curl -s $B/v1/relay/circuits -H "$O"                                                    # 18 circuits + policy + operability
```
Live/history curl examples (camera-04 live, camera-06 search/playback): `docs/nvr-rest-workflows.md`.

## 18 circuits
Fixed catalog in `config/examples/circuits.yaml` (see `docs/device-mapping.md`). 01–04 follow court bookings, 05–09 08:00–22:00, 10–11 18:00–22:00 (Asia/Taipei, adjustable),
12–16 are 24h supply/bypass (never switched, never in schedules/all-off/batch; 14 is `critical_power`), 17–18 reserved/disabled. Bindings (controller, channel, Modbus table/address or SOYAL selector)
are configured in the mapping menu, not in YAML.

## Adding a driver
`docs/vendor-sdk-integration.md`.

## Live and history
Live: `POST /v1/cameras/{id}/live-sessions` → poll → WHEP player. History: `GET …/recordings` → `POST …/playback-sessions` → poll → WHEP; seek = new session.
Sessions are authorised per viewer, expire, and release MediaMTX paths/FFmpeg/temp files. Details: `docs/media-streaming.md`, `docs/nvr-rest-workflows.md`.

## WebRTC over the internet
HTTPS proxying only covers signalling. Remote viewers need reachable ICE candidates (UDP/TCP 8189) or STUN/TURN. **Not tested over the internet.**

## Tests
`python -m pytest` (unit + integration; hardware tests are skipped unless `EDGE_HARDWARE_TESTS=1 EDGE_HW_CONFIRM=I-ACCEPT-REAL-OUTPUT`, and no real door/relay/HVAC action is ever run by default).
Frontend: `cd web && npm run typecheck && npm run build && npm test`.

## Known limitations
- No real HVAC/door/relay/NVR/SDK/cloud was available: all real-driver paths are verified only against fakes, and real-hardware behaviour is **unverified**. See `docs/integration-gaps.md`.
- Hikvision: search/ISAPI/SDK history are `unsupported` until verified; official SDK binding not included (and not downloaded).
- `cloud_media` is a stub; the cloud contract is proposed only; booking cache offline policies are unconfigured.
- Viewer media tokens and web sessions live in memory: an agent restart ends sessions and logs users out.
- Single process by design (one owner per serial port).
