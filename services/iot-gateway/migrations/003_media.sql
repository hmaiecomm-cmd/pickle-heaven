-- 攝影機即時串流與 NVR 錄影調閱（HLS 片段暫存）。即時片段保留 10 分鐘、錄影片段保留 24 小時（背景工作清除）
CREATE TABLE IF NOT EXISTS media_sessions (
  session         text PRIMARY KEY,               -- 雲端產生（camera.live / nvr.clip 指令帶下去）
  site_id         text NOT NULL REFERENCES sites(site_id) ON DELETE CASCADE,
  kind            text NOT NULL,                  -- live | clip
  camera          text NOT NULL,
  created_at      timestamptz NOT NULL,
  until_at        timestamptz,                    -- live 自動停止時間
  from_at         timestamptz,                    -- clip 範圍
  to_at           timestamptz,
  segments        integer NOT NULL DEFAULT 0,
  bytes           bigint NOT NULL DEFAULT 0,
  last_segment_at timestamptz,
  ended           boolean NOT NULL DEFAULT false,
  end_reason      text
);
CREATE INDEX IF NOT EXISTS media_sessions_site_idx ON media_sessions (site_id, created_at DESC);

CREATE TABLE IF NOT EXISTS media_segments (
  session       text NOT NULL REFERENCES media_sessions(session) ON DELETE CASCADE,
  seq           integer NOT NULL,
  duration      real NOT NULL,
  content_type  text NOT NULL,
  data          bytea NOT NULL,
  created_at    timestamptz NOT NULL,
  PRIMARY KEY (session, seq)
);
CREATE INDEX IF NOT EXISTS media_segments_created_idx ON media_segments (created_at);

-- NVR 錄影索引（nvr.index 指令的回覆）
CREATE TABLE IF NOT EXISTS nvr_indexes (
  id           text PRIMARY KEY,                 -- = nvr.index 指令 id
  site_id      text NOT NULL REFERENCES sites(site_id) ON DELETE CASCADE,
  uploaded_at  timestamptz NOT NULL,
  body         jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS nvr_indexes_uploaded_idx ON nvr_indexes (uploaded_at);
