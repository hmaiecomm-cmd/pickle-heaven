-- 場館本機 log 調閱（log.upload 指令的上傳結果）。內容為 gzip 後的 JSON，保留 30 天（Gateway 背景工作清除）
CREATE TABLE IF NOT EXISTS log_uploads (
  id           text PRIMARY KEY,               -- = log.upload 指令 id
  site_id      text NOT NULL REFERENCES sites(site_id) ON DELETE CASCADE,
  uploaded_at  timestamptz NOT NULL,
  bytes        integer NOT NULL,
  files        jsonb NOT NULL,                 -- [{ name, lines, bytes, truncated }]
  content_gz   bytea NOT NULL
);
CREATE INDEX IF NOT EXISTS log_uploads_site_idx ON log_uploads (site_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS log_uploads_uploaded_idx ON log_uploads (uploaded_at);
