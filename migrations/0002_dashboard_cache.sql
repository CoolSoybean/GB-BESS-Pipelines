CREATE TABLE IF NOT EXISTS dashboard_cache (
  cache_key TEXT NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  PRIMARY KEY (cache_key, chunk_index)
);

