CREATE TABLE IF NOT EXISTS site_stats (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO site_stats(key, value, updated_at)
VALUES('total_visits', 0, CURRENT_TIMESTAMP);

