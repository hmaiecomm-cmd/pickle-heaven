# Architecture

```
Cloud/UI ──HTTPS──> Caddy ──> edge-agent (FastAPI, ONE process)
                               ├─ api/            auth, validation, 202 + command_id (no serial I/O)
                               ├─ commands/       policy engine, intake, executor, worker pool
                               ├─ controllers/    relay / hvac / access rules → drivers
                               ├─ drivers/        mock | real (modbus_m7000, soyal_721_727, hikvision…) ; transports/bus.py (per-bus lock)
                               ├─ scheduling/     bookings, desired state, reconciler (→ commands)
                               ├─ mapping/        versioned deployment mapping (draft/validate/diff/apply/rollback)
                               ├─ media/          sessions, MediaMTX client, FFmpeg supervisor, auth hook
                               ├─ storage/        SQLite: commands, audit, outbox, state, mappings, sessions
                               └─ cloud/          heartbeat + event outbox delivery (disabled w/o URL)
            MediaMTX (WebRTC/WHEP, RTSP publish)   ← authenticates every action via agent /internal/media/auth
```
Reliability: command is written to SQLite (PK = command_id, content hash ⇒ 409 on mismatch) → worker claims → expiry re-checked → bus lock → driver.
Timeout after bytes were sent ⇒ `unknown`; pre-send failure ⇒ `failed`; unlock never retried. Restart: running non-idempotent ⇒ `unknown` (not replayed); idempotent+sent ⇒ `unknown`;
idempotent+never sent ⇒ re-queued. No exactly-once claim. `requested_state` / `reported_state` / `verification` (confirmed|unverified|unknown) are stored separately; mock results are
`unverified` and flagged `simulated`. Times: UTC internally/ISO-8601 with zone in API; UI shows Asia/Taipei.
