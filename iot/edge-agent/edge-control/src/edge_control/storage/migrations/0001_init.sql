-- 0001 initial schema.  All timestamps are UTC ISO-8601 strings ending in Z.

CREATE TABLE commands (
    command_id        TEXT PRIMARY KEY,
    payload_hash      TEXT NOT NULL,
    type              TEXT NOT NULL,              -- hvac.settings | access.unlock | relay.set_state
    target_id         TEXT NOT NULL,
    bus_id            TEXT,
    payload           TEXT NOT NULL,              -- JSON
    status            TEXT NOT NULL,              -- accepted|running|succeeded|failed|expired|unknown
    requested_state   TEXT,                       -- JSON
    reported_state    TEXT,                       -- JSON
    verification      TEXT NOT NULL DEFAULT 'unverified',  -- confirmed|unverified|unknown
    error_code        TEXT,
    error_message     TEXT,
    actor             TEXT NOT NULL,
    source            TEXT NOT NULL DEFAULT 'api',   -- api|scheduler|recovery
    mapping_revision  INTEGER,
    driver_mode       TEXT,                       -- mock|real (so mock results are never read as hardware proof)
    idempotent        INTEGER NOT NULL DEFAULT 1,
    sent_to_device    INTEGER NOT NULL DEFAULT 0,
    expires_at        TEXT NOT NULL,
    created_at        TEXT NOT NULL,
    started_at        TEXT,
    finished_at       TEXT,
    updated_at        TEXT NOT NULL
);
CREATE INDEX idx_commands_status ON commands(status, created_at);
CREATE INDEX idx_commands_bus ON commands(bus_id, status);

CREATE TABLE audit_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ts          TEXT NOT NULL,
    actor       TEXT NOT NULL,
    role        TEXT,
    action      TEXT NOT NULL,
    target      TEXT,
    command_id  TEXT,
    result      TEXT NOT NULL,
    detail      TEXT
);
CREATE INDEX idx_audit_ts ON audit_log(ts);

CREATE TABLE event_outbox (
    event_id      TEXT PRIMARY KEY,
    kind          TEXT NOT NULL,
    payload       TEXT NOT NULL,
    created_at    TEXT NOT NULL,
    attempts      INTEGER NOT NULL DEFAULT 0,
    next_attempt  TEXT NOT NULL,
    last_error    TEXT,
    acked_at      TEXT
);
CREATE INDEX idx_outbox_due ON event_outbox(acked_at, next_attempt);

CREATE TABLE device_state (
    entity_id        TEXT PRIMARY KEY,           -- e.g. circuit-01, hvac-1, door-1
    entity_kind      TEXT NOT NULL,
    requested_state  TEXT,
    reported_state   TEXT,
    verification     TEXT NOT NULL DEFAULT 'unknown',
    source           TEXT,
    driver_mode      TEXT,
    updated_at       TEXT NOT NULL
);

CREATE TABLE deployment_revisions (
    revision    INTEGER PRIMARY KEY,
    payload     TEXT NOT NULL,
    created_by  TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    comment     TEXT,
    kind        TEXT NOT NULL DEFAULT 'apply'    -- seed|apply|rollback
);

CREATE TABLE deployment_state (
    id               INTEGER PRIMARY KEY CHECK (id = 1),
    active_revision  INTEGER NOT NULL,
    draft_payload    TEXT,
    draft_revision   INTEGER NOT NULL DEFAULT 0,
    draft_base       INTEGER,
    draft_by         TEXT,
    draft_at         TEXT
);

CREATE TABLE media_sessions (
    session_id       TEXT PRIMARY KEY,
    kind             TEXT NOT NULL,              -- live|playback
    camera_id        TEXT NOT NULL,
    actor            TEXT NOT NULL,
    status           TEXT NOT NULL,              -- preparing|ready|failed|stopped|expired
    stream_profile   TEXT,
    delivery_target  TEXT NOT NULL,
    path_name        TEXT,
    params           TEXT,                       -- JSON (non secret)
    error_code       TEXT,
    error_message    TEXT,
    token_hash       TEXT,
    idempotency_key  TEXT,
    request_hash     TEXT,
    mapping_revision INTEGER,
    created_at       TEXT NOT NULL,
    expires_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_media_idem ON media_sessions(actor, kind, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_media_status ON media_sessions(status, kind);

CREATE TABLE bookings (
    booking_id  TEXT PRIMARY KEY,
    court       TEXT NOT NULL,                   -- court_a | court_b
    start_at    TEXT NOT NULL,
    end_at      TEXT NOT NULL,
    status      TEXT NOT NULL,                   -- active|cancelled
    revision    INTEGER NOT NULL,
    received_at TEXT NOT NULL
);

CREATE TABLE circuit_overrides (
    circuit_id  TEXT PRIMARY KEY,
    desired     TEXT NOT NULL,                   -- on|off
    expires_at  TEXT NOT NULL,
    actor       TEXT NOT NULL,
    created_at  TEXT NOT NULL
);

CREATE TABLE kv (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
);
