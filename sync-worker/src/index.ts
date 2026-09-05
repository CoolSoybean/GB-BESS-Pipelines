interface Env {
  DB: D1Database;
  SYNC_TOKEN?: string;
}

type SourceName = 'transmission' | 'distribution';
type Attributes = Record<string, string | number | null>;
interface ArcFeature { attributes: Attributes; geometry?: { x?: number; y?: number } }
interface ArcQuery { features?: ArcFeature[]; exceededTransferLimit?: boolean; error?: { message: string } }
interface ArcMetadata { editingInfo?: { dataLastEditDate?: number; lastEditDate?: number }; error?: { message: string } }

const BASE = 'https://services7.arcgis.com/hY4biVlc8UMq7NOM/arcgis/rest/services';
const SOURCES: Record<SourceName, string> = {
  transmission: `${BASE}/Transmission_connected_pipeline_storage_sites/FeatureServer/0`,
  distribution: `${BASE}/Distribution_connected_pipeline_storage_sites/FeatureServer/0`,
};
const COLUMNS = `id, source, source_fid, source_project_id, project_name, customer_name,
  site_name, operator_name, technology, status, capacity_mw, connected_capacity_mw,
  accepted_capacity_mw, connection_date, target_year, latitude, longitude,
  upstream_updated_at, synced_at, raw_json`;
const MAP_CACHE_CHUNK_SIZE = 500;

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function asString(value: unknown): string | null {
  return value === null || value === undefined || value === '' ? null : String(value).trim();
}

function isoDate(value: unknown): string | null {
  const number = asNumber(value);
  if (!number) return null;
  return new Date(number).toISOString();
}

function targetYear(value: unknown): number | null {
  const number = asNumber(value);
  if (!number) return null;
  if (number >= 1900 && number <= 2200) return Math.trunc(number);
  const date = new Date(number);
  return Number.isNaN(date.getTime()) ? null : date.getUTCFullYear();
}

function normalize(source: SourceName, feature: ArcFeature, syncedAt: string) {
  const a = feature.attributes;
  const fid = asNumber(a.FID) ?? 0;
  const connected = source === 'distribution' ? asNumber(a.Already_connected_registered_ca) : asNumber(a.MW_Connected);
  const accepted = source === 'distribution' ? asNumber(a.Accepted_to_connect_registered_) : asNumber(a.Cumulative_Total_Capacity__MW_);
  const projectId = source === 'transmission' ? asString(a.Project_ID) : null;
  const capacity = source === 'transmission'
    ? (asNumber(a.Cumulative_Total_Capacity__MW_) ?? asNumber(a.MW_Connected) ?? 0)
    : (accepted ?? connected ?? 0);
  return {
    id: `${source}:${fid}`,
    source,
    sourceFid: fid,
    projectId,
    projectName: asString(source === 'transmission' ? a.Project_Name : a.Customer_site) ?? `Unnamed project ${fid}`,
    customerName: asString(source === 'transmission' ? a.Customer_Name : a.Customer_name),
    siteName: asString(source === 'transmission' ? a.Connection_Site : a.Customer_site),
    operator: asString(source === 'transmission' ? a.HOST_TO : a.DNO),
    technology: asString(a.Combined_technology) ?? asString(a.Plant_Type) ?? asString(a.Energy_conversion_technology_1),
    status: asString(source === 'transmission' ? a.Project_Status : a.Connection_status) ?? 'Unknown',
    capacity,
    connected,
    accepted,
    connectionDate: isoDate(source === 'transmission' ? a.MW_Effective_From : a.Date_connected),
    targetYear: targetYear(source === 'transmission' ? a.Year : a.Target_energisation_date),
    latitude: asNumber(source === 'transmission' ? a.Lat : a.lat) ?? asNumber(feature.geometry?.y),
    longitude: asNumber(source === 'transmission' ? a.Long : a.long) ?? asNumber(feature.geometry?.x),
    upstreamUpdatedAt: isoDate(a.Last_updated),
    syncedAt,
    rawJson: JSON.stringify(feature),
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'GB-BESS-Pipelines/1.0' } });
  if (!response.ok) throw new Error(`ArcGIS returned HTTP ${response.status}`);
  const body = await response.json<T>();
  if (body && typeof body === 'object' && 'error' in body && body.error) {
    throw new Error((body as ArcQuery).error?.message ?? 'ArcGIS request failed');
  }
  return body;
}

async function fetchSource(source: SourceName): Promise<{ editTime: number; features: ArcFeature[] }> {
  const endpoint = SOURCES[source];
  const metadata = await fetchJson<ArcMetadata>(`${endpoint}?f=json`);
  const editTime = metadata.editingInfo?.dataLastEditDate ?? metadata.editingInfo?.lastEditDate ?? 0;
  const features: ArcFeature[] = [];
  let offset = 0;
  do {
    const params = new URLSearchParams({
      f: 'json', where: '1=1', outFields: '*', returnGeometry: 'true', outSR: '4326',
      resultOffset: String(offset), resultRecordCount: '2000', orderByFields: 'FID ASC',
    });
    const page = await fetchJson<ArcQuery>(`${endpoint}/query?${params}`);
    const rows = page.features ?? [];
    features.push(...rows);
    offset += rows.length;
    if (!page.exceededTransferLimit || rows.length === 0) break;
  } while (offset < 100000);
  return { editTime, features };
}

async function setState(db: D1Database, source: SourceName, status: string, error: string | null = null) {
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO sync_state(source,last_started_at,status,error_message)
    VALUES(?,?,?,?) ON CONFLICT(source) DO UPDATE SET last_started_at=excluded.last_started_at,
    status=excluded.status,error_message=excluded.error_message`).bind(source, now, status, error).run();
}

async function syncSource(env: Env, source: SourceName, force = false) {
  await setState(env.DB, source, 'running');
  try {
    const fetched = await fetchSource(source);
    const state = await env.DB.prepare('SELECT upstream_edit_time FROM sync_state WHERE source=?').bind(source).first<{ upstream_edit_time: number }>();
    if (!force && fetched.editTime && state?.upstream_edit_time === fetched.editTime) {
      await env.DB.prepare(`UPDATE sync_state SET status='success', last_success_at=?, error_message=NULL WHERE source=?`)
        .bind(new Date().toISOString(), source).run();
      return { source, skipped: true, count: fetched.features.length };
    }

    const syncedAt = new Date().toISOString();
    const token = crypto.randomUUID();
    const rows = fetched.features.map((feature) => normalize(source, feature, syncedAt));
    await env.DB.prepare('DELETE FROM storage_sites_staging WHERE source=?').bind(source).run();
    for (let start = 0; start < rows.length; start += 40) {
      const statements = rows.slice(start, start + 40).map((r) => env.DB.prepare(`INSERT INTO storage_sites_staging
        (sync_token, ${COLUMNS}) VALUES (${Array(21).fill('?').join(',')})`).bind(
        token, r.id, r.source, r.sourceFid, r.projectId, r.projectName, r.customerName,
        r.siteName, r.operator, r.technology, r.status, r.capacity, r.connected, r.accepted,
        r.connectionDate, r.targetYear, r.latitude, r.longitude, r.upstreamUpdatedAt,
        r.syncedAt, r.rawJson,
      ));
      await env.DB.batch(statements);
    }
    const staged = await env.DB.prepare('SELECT COUNT(*) count FROM storage_sites_staging WHERE sync_token=?').bind(token).first<{ count: number }>();
    if ((staged?.count ?? 0) !== rows.length) throw new Error('Staging row count did not match downloaded row count');

    await env.DB.batch([
      env.DB.prepare('DELETE FROM storage_sites WHERE source=?').bind(source),
      env.DB.prepare(`INSERT INTO storage_sites (${COLUMNS}) SELECT ${COLUMNS} FROM storage_sites_staging WHERE sync_token=?`).bind(token),
      env.DB.prepare('DELETE FROM storage_sites_staging WHERE sync_token=?').bind(token),
      env.DB.prepare(`UPDATE sync_state SET upstream_edit_time=?,last_success_at=?,record_count=?,status='success',error_message=NULL WHERE source=?`)
        .bind(fetched.editTime, syncedAt, rows.length, source),
    ]);
    return { source, skipped: false, count: rows.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setState(env.DB, source, 'error', message.slice(0, 500));
    throw error;
  }
}

async function refreshDashboardCache(db: D1Database) {
  const [headline, statuses, technologies, timeline, operators, sync, mapRows] = await Promise.all([
    db.prepare(`SELECT COUNT(*) projects, COALESCE(SUM(capacity_mw),0) capacity,
      COALESCE(SUM(CASE WHEN lower(status) LIKE '%built%' OR lower(status) LIKE '%connected%' THEN capacity_mw ELSE 0 END),0) connected,
      COALESCE(SUM(CASE WHEN source='transmission' THEN capacity_mw ELSE 0 END),0) transmission,
      COALESCE(SUM(CASE WHEN source='distribution' THEN capacity_mw ELSE 0 END),0) distribution
      FROM storage_sites`).first(),
    db.prepare(`SELECT COALESCE(status,'Unknown') name, COUNT(*) projects, ROUND(SUM(capacity_mw),2) capacity FROM storage_sites GROUP BY status ORDER BY capacity DESC LIMIT 10`).all(),
    db.prepare(`SELECT COALESCE(technology,'Unknown') name, COUNT(*) projects, ROUND(SUM(capacity_mw),2) capacity FROM storage_sites GROUP BY technology ORDER BY capacity DESC LIMIT 8`).all(),
    db.prepare(`SELECT target_year year, COUNT(*) projects, ROUND(SUM(capacity_mw),2) capacity FROM storage_sites WHERE target_year BETWEEN 2020 AND 2045 GROUP BY target_year ORDER BY target_year`).all(),
    db.prepare(`SELECT DISTINCT operator_name value FROM storage_sites WHERE operator_name IS NOT NULL ORDER BY operator_name`).all(),
    db.prepare(`SELECT source, last_success_at, record_count, status, error_message FROM sync_state ORDER BY source`).all(),
    db.prepare(`SELECT id, source, project_name, customer_name, site_name, operator_name,
      status, capacity_mw, target_year, latitude, longitude
      FROM storage_sites WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      ORDER BY capacity_mw DESC LIMIT 10000`).all(),
  ]);

  const generatedAt = new Date().toISOString();
  const summary = JSON.stringify({
    headline,
    statuses: statuses.results,
    technologies: technologies.results,
    timeline: timeline.results,
    operators: operators.results,
    sync: sync.results,
  });
  const mapChunks: unknown[][] = [];
  for (let start = 0; start < mapRows.results.length; start += MAP_CACHE_CHUNK_SIZE) {
    mapChunks.push(mapRows.results.slice(start, start + MAP_CACHE_CHUNK_SIZE));
  }

  await db.batch([
    db.prepare(`INSERT INTO dashboard_cache(cache_key,chunk_index,payload,generated_at)
      VALUES('summary',0,?,?) ON CONFLICT(cache_key,chunk_index) DO UPDATE SET
      payload=excluded.payload,generated_at=excluded.generated_at`).bind(summary, generatedAt),
    db.prepare(`DELETE FROM dashboard_cache WHERE cache_key='map'`),
    ...mapChunks.map((chunk, index) => db.prepare(`INSERT INTO dashboard_cache(cache_key,chunk_index,payload,generated_at)
      VALUES('map',?,?,?)`).bind(index, JSON.stringify(chunk), generatedAt)),
  ]);
}

async function run(env: Env, force = false) {
  const results = [];
  for (const source of Object.keys(SOURCES) as SourceName[]) results.push(await syncSource(env, source, force));
  await refreshDashboardCache(env.DB);
  return results;
}

const worker = {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(run(env));
  },
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') return Response.json({ ok: true });
    const authorization = request.headers.get('Authorization');
    if (url.pathname === '/sync' && request.method === 'POST' && env.SYNC_TOKEN && authorization === `Bearer ${env.SYNC_TOKEN}`) {
      try { return Response.json({ ok: true, results: await run(env, url.searchParams.get('force') === 'true') }); }
      catch (error) { return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 }); }
    }
    return new Response('Not found', { status: 404 });
  },
};

export default worker;
