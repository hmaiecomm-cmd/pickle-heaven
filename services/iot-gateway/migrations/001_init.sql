-- 顧好 IoT Gateway 資料表（DigitalOcean Managed Postgres）
-- 執行：npm run migrate（可重複執行）

CREATE TABLE IF NOT EXISTS schema_migrations (
  name        text PRIMARY KEY,
  applied_at  timestamptz NOT NULL DEFAULT now()
);

-- 場館（每台場館電腦一筆）
CREATE TABLE IF NOT EXISTS sites (
  site_id        text PRIMARY KEY,
  name           text NOT NULL,
  venue_id       text,
  key_version    integer NOT NULL DEFAULT 1,
  disabled       boolean NOT NULL DEFAULT false,
  plan_rev       integer NOT NULL DEFAULT 0,
  online         boolean NOT NULL DEFAULT false,
  last_seen_at   timestamptz,
  agent_version  text,
  status         jsonb,
  status_at      timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sites_online_seen_idx ON sites (online, last_seen_at);

-- 場館計畫（含門禁明碼，整份以 AES-256-GCM 加密）；保留最近幾版供追查
CREATE TABLE IF NOT EXISTS site_plans (
  site_id     text NOT NULL REFERENCES sites(site_id) ON DELETE CASCADE,
  rev         integer NOT NULL,
  hash        text NOT NULL,
  ciphertext  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, rev)
);

-- 指令佇列
CREATE TABLE IF NOT EXISTS commands (
  id            text PRIMARY KEY,
  site_id       text NOT NULL REFERENCES sites(site_id) ON DELETE CASCADE,
  type          text NOT NULL,
  command       jsonb NOT NULL,
  status        text NOT NULL DEFAULT 'QUEUED',
  requested_by  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  delivered_at  timestamptz,
  deliveries    integer NOT NULL DEFAULT 0,
  acked_at      timestamptz,
  ack           jsonb
);
CREATE INDEX IF NOT EXISTS commands_site_open_idx ON commands (site_id, created_at) WHERE status IN ('QUEUED', 'DELIVERED');
CREATE INDEX IF NOT EXISTS commands_site_created_idx ON commands (site_id, created_at DESC);

-- 地端事件（刷卡、迴路變化、異常…），依 (site_id, event_id) 去重
CREATE TABLE IF NOT EXISTS events (
  site_id      text NOT NULL REFERENCES sites(site_id) ON DELETE CASCADE,
  event_id     text NOT NULL,
  type         text NOT NULL,
  at           timestamptz NOT NULL,
  data         jsonb,
  received_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, event_id)
);
CREATE INDEX IF NOT EXISTS events_site_at_idx ON events (site_id, at DESC);

-- 回報平台的 webhook（至少送達一次，失敗會退避重試）
CREATE TABLE IF NOT EXISTS webhook_outbox (
  id               bigserial PRIMARY KEY,
  payload          jsonb NOT NULL,
  attempts         integer NOT NULL DEFAULT 0,
  next_attempt_at  timestamptz NOT NULL DEFAULT now(),
  claimed_until    timestamptz,
  delivered_at     timestamptz,
  last_error       text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webhook_outbox_due_idx ON webhook_outbox (next_attempt_at) WHERE delivered_at IS NULL;
