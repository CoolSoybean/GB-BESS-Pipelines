import { cachedResponse, intParam, json, textParam, type PagesContext } from '../_shared';

interface CachedMapProject {
  id: string;
  source: 'transmission' | 'distribution';
  project_name: string;
  customer_name: string | null;
  site_name: string | null;
  operator_name: string | null;
  status: string | null;
  capacity_mw: number;
  target_year: number | null;
  latitude: number;
  longitude: number;
}

function normalizedCacheRequest(request: Request, values: Record<string, string | number | null>) {
  const url = new URL(request.url);
  url.search = '';
  for (const [name, value] of Object.entries(values)) {
    if (value !== null && value !== 0) url.searchParams.set(name, String(value));
  }
  return new Request(url, request);
}

export const onRequestGet = async ({ env, request, waitUntil }: PagesContext): Promise<Response> => {
  try {
    const url = new URL(request.url);
    const source = textParam(url, 'source');
    const status = textParam(url, 'status');
    const operator = textParam(url, 'operator');
    const q = textParam(url, 'q')?.toLocaleLowerCase('en-GB') ?? null;
    const year = intParam(url, 'year', 0, 0, 2200);
    const cacheRequest = normalizedCacheRequest(request, { source, status, operator, q, year });

    return await cachedResponse(cacheRequest, waitUntil, async () => {
      const result = await env.DB.prepare(`SELECT payload FROM dashboard_cache WHERE cache_key='map' ORDER BY chunk_index`)
        .all<{ payload: string }>();
      if (!result.results.length) return json({ error: 'Map cache is not ready.' }, 503);
      const rows = result.results.flatMap(({ payload }) => JSON.parse(payload) as CachedMapProject[]);
      const data = rows.filter((project) =>
        (!source || project.source === source) &&
        (!status || project.status === status) &&
        (!operator || project.operator_name === operator) &&
        (!year || project.target_year === year) &&
        (!q || `${project.project_name} ${project.site_name ?? ''} ${project.customer_name ?? ''}`.toLocaleLowerCase('en-GB').includes(q))
      ).slice(0, 10000).map(({ id, source: projectSource, project_name, status: projectStatus, capacity_mw, latitude, longitude }) => ({
        id,
        source: projectSource,
        project_name,
        status: projectStatus,
        capacity_mw,
        latitude,
        longitude,
      }));
      return json({ data }, 200, 900);
    });
  } catch (error) {
    console.error(error);
    return json({ error: 'Unable to load map projects.' }, 500);
  }
};
