CREATE TABLE IF NOT EXISTS storage_sites (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('transmission', 'distribution')),
  source_fid INTEGER NOT NULL,
  source_project_id TEXT,
  project_name TEXT NOT NULL,
  customer_name TEXT,
  site_name TEXT,
  operator_name TEXT,
  technology TEXT,
  status TEXT,
  capacity_mw REAL NOT NULL DEFAULT 0,
  connected_capacity_mw REAL,
  accepted_capacity_mw REAL,
  connection_date TEXT,
  target_year INTEGER,
  latitude REAL,
  longitude REAL,
  upstream_updated_at TEXT,
  synced_at TEXT NOT NULL,
  raw_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS storage_sites_staging (
  sync_token TEXT NOT NULL,
  id TEXT NOT NULL,
  source TEXT NOT NULL,
  source_fid INTEGER NOT NULL,
  source_project_id TEXT,
  project_name TEXT NOT NULL,
  customer_name TEXT,
  site_name TEXT,
  operator_name TEXT,
  technology TEXT,
  status TEXT,
  capacity_mw REAL NOT NULL DEFAULT 0,
  connected_capacity_mw REAL,
  accepted_capacity_mw REAL,
  connection_date TEXT,
  target_year INTEGER,
  latitude REAL,
  longitude REAL,
  upstream_updated_at TEXT,
  synced_at TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  PRIMARY KEY (sync_token, id)
);

CREATE TABLE IF NOT EXISTS sync_state (
  source TEXT PRIMARY KEY,
  upstream_edit_time INTEGER,
  last_started_at TEXT,
  last_success_at TEXT,
  record_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'never',
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_storage_sites_source_status
ON storage_sites(source, status);

CREATE INDEX IF NOT EXISTS idx_storage_sites_operator
ON storage_sites(operator_name);

CREATE INDEX IF NOT EXISTS idx_storage_sites_target_year
ON storage_sites(target_year);

CREATE INDEX IF NOT EXISTS idx_storage_sites_capacity
ON storage_sites(capacity_mw DESC);

CREATE INDEX IF NOT EXISTS idx_storage_sites_staging_token_source
ON storage_sites_staging(sync_token, source);

PRAGMA optimize;
