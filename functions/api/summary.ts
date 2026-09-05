import { cachedResponse, json, type PagesContext } from '../_shared';

export const onRequestGet = async ({ env, request, waitUntil }: PagesContext): Promise<Response> => {
  try {
    return await cachedResponse(request, waitUntil, async () => {
      const cached = await env.DB.prepare(`SELECT payload FROM dashboard_cache WHERE cache_key='summary' AND chunk_index=0`)
        .first<{ payload: string }>();
      if (!cached) return json({ error: 'Dashboard cache is not ready.' }, 503);
      return json(JSON.parse(cached.payload), 200, 900);
    });
  } catch (error) {
    console.error(error);
    return json({ error: 'Unable to load summary.' }, 500);
  }
};
