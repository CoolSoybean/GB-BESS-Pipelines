import { type PagesContext } from '../_shared';

export const onRequestPost = async ({ env }: PagesContext): Promise<Response> => {
  try {
    const result = await env.DB.prepare(`INSERT INTO site_stats(key,value,updated_at)
      VALUES('total_visits',1,CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value=value+1,updated_at=CURRENT_TIMESTAMP
      RETURNING value`).first<{ value: number }>();
    return Response.json({ total: result?.value ?? 0 }, {
      headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Unable to record visit.' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  }
};
