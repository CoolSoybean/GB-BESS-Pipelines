# GB BESS Pipelines

A Cloudflare Pages dashboard backed by D1, with a scheduled Cloudflare Worker that synchronises the public Transmission and Distribution connected pipeline storage site layers from the Regen / ESN ArcGIS dashboard.

## What is included

- Responsive React dashboard with a Great Britain project map, headline metrics, charts, filters and project register.
- Same-origin Pages Functions APIs at `/api/projects`, `/api/summary` and `/api/health`.
- D1 schema, indexes, staging table and sync audit state.
- Scheduled Worker that checks ArcGIS edit timestamps, downloads all pages, normalises both schemas and atomically replaces each source.
- Safe demo-data fallback when the local UI is run without D1.
- Cloudflare configuration for Pages and the separate sync Worker.

## Data sources

- Transmission: `Transmission_connected_pipeline_storage_sites/FeatureServer/0`
- Distribution: `Distribution_connected_pipeline_storage_sites/FeatureServer/0`

The upstream endpoints are defined once in `sync-worker/src/index.ts`. Public API access does not by itself grant unrestricted republication rights. Confirm the source licensing and attribution requirements before publishing this site.

## 1. Install and build

```powershell
pnpm install
pnpm build
```

The static frontend is written to `dist/`.

## 2. Create D1

```powershell
npx wrangler login
npx wrangler d1 create gb-bess-pipelines
```

Copy the returned database ID into both:

- `wrangler.toml`
- `sync-worker/wrangler.toml`

Replace `REPLACE_WITH_D1_DATABASE_ID` in each file with the same ID.

Apply the schema:

```powershell
pnpm db:remote
```

## 3. Deploy the Pages site

Create a Cloudflare Pages project named `gb-bess-pipelines`, then deploy:

```powershell
pnpm build
pnpm pages:deploy
```

Both Pages Functions and the frontend are deployed together. The `DB` binding in `wrangler.toml` lets the API read the same D1 database populated by the sync Worker.

## 4. Deploy the scheduled sync Worker

```powershell
pnpm worker:deploy
```

The schedule in `sync-worker/wrangler.toml` is `15 2 * * *`, meaning 02:15 UTC every day. Change the cron if another interval is preferred.

For a protected manual sync endpoint, create a secret:

```powershell
npx wrangler secret put SYNC_TOKEN --config sync-worker/wrangler.toml
```

Then call the deployed Worker:

```powershell
Invoke-RestMethod -Method Post -Uri "https://YOUR-WORKER.workers.dev/sync?force=true" -Headers @{ Authorization = "Bearer YOUR_TOKEN" }
```

Do not commit the token to this repository or put it in `wrangler.toml`.

## Local development

For the visual frontend with sample data:

```powershell
pnpm dev
```

For a local Pages + D1 run:

```powershell
pnpm build
pnpm db:local
pnpm pages:dev
```

Until a local sync is run, the real API returns an empty register. The regular Vite development mode intentionally falls back to clearly labelled demonstration records.

## API examples

```text
GET /api/projects?page=1&pageSize=100
GET /api/projects?source=transmission&status=Built
GET /api/projects?source=distribution&operator=UK%20Power%20Networks
GET /api/projects?q=Iron%20Acton&year=2028
GET /api/summary
GET /api/health
```

The frontend never connects directly to D1. It calls the Pages Functions API, which uses prepared SQL statements and the `DB` binding.
