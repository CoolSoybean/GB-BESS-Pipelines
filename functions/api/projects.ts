import { cachedResponse, intParam, json, textParam, type PagesContext } from '../_shared';

interface CachedProject {
  id: string;
  source: 'transmission' | 'distribution';
  project_name: string;
  customer_name: string | null;
  site_name: string | null;
  operator_name: string | null;
  technology: string | null;
  status: string | null;
  capacity_mw: number;
  connected_capacity_mw: number | null;
  accepted_capacity_mw: number | null;
  connection_date: string | null;
  target_year: number | null;
  latitude: number | null;
  longitude: number | null;
  synced_at: string;
  search_text: string;
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
    const requestedSource = textParam(url, 'source');
    const source = requestedSource && ['transmission', 'distribution'].includes(requestedSource) ? requestedSource : null;
    const status = textParam(url, 'status');
    const operator = textParam(url, 'operator');
    const technology = textParam(url, 'technology');
    const rawQuery = textParam(url, 'q');
    const q = rawQuery && rawQuery.length >= 2 ? rawQuery.toLocaleLowerCase('en-GB') : null;
    const year = intParam(url, 'year', 0, 0, 2200);
    const page = intParam(url, 'page', 1, 1, 100000);
    const pageSize = intParam(url, 'pageSize', 100, 1, 500);
    const cacheRequest = normalizedCacheRequest(request, { source, status, operator, technology, q, year, page, pageSize });

    return await cachedResponse(cacheRequest, waitUntil, async () => {
      const hasFilters = Boolean(source || status || operator || technology || q || year);
      if (!hasFilters && pageSize === 50) {
        const cachedPage = await env.DB.prepare(`SELECT payload FROM dashboard_cache WHERE cache_key='project_pages' AND chunk_index=?`)
          .bind(page - 1).first<{ payload: string }>();
        if (cachedPage) {
          const payload = JSON.parse(cachedPage.payload) as { data: Omit<CachedProject, 'search_text'>[]; total: number };
          return json({ data: payload.data, pagination: { page, pageSize, total: payload.total } }, 200, 900);
        }
        const firstPage = await env.DB.prepare(`SELECT payload FROM dashboard_cache WHERE cache_key='project_pages' AND chunk_index=0`)
          .first<{ payload: string }>();
        if (!firstPage) return json({ error: 'Project cache is not ready.' }, 503);
        const { total } = JSON.parse(firstPage.payload) as { total: number };
        return json({ data: [], pagination: { page, pageSize, total } }, 200, 900);
      }
      const result = await env.DB.prepare(`SELECT payload FROM dashboard_cache WHERE cache_key='projects' ORDER BY chunk_index`)
        .all<{ payload: string }>();
      if (!result.results.length) return json({ error: 'Project cache is not ready.' }, 503);
      const filtered = result.results.flatMap(({ payload }) => JSON.parse(payload) as CachedProject[]).filter((project) =>
        (!source || project.source === source) &&
        (!status || project.status === status) &&
        (!operator || project.operator_name === operator) &&
        (!technology || project.technology === technology) &&
        (!year || project.target_year === year) &&
        (!q || project.search_text.includes(q))
      );
      const total = filtered.length;
      const start = (page - 1) * pageSize;
      const data = filtered.slice(start, start + pageSize).map(({ search_text: _searchText, ...project }) => project);
      return json({ data, pagination: { page, pageSize, total } }, 200, 900);
    });
  } catch (error) {
    console.error(error);
    return json({ error: 'Unable to load projects.' }, 500);
  }
};
