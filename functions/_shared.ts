export interface Env { DB: D1Database }

export type PagesContext = EventContext<Env, string, Record<string, unknown>>;

export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': status === 200 ? 'public, max-age=60, s-maxage=300' : 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export function textParam(url: URL, name: string): string | null {
  const value = url.searchParams.get(name)?.trim();
  return value ? value.slice(0, 120) : null;
}

export function intParam(url: URL, name: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(url.searchParams.get(name) ?? '', 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}
