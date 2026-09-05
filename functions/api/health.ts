import { json, type PagesContext } from '../_shared';

export const onRequestGet = async ({ env }: PagesContext): Promise<Response> => {
  try {
    await env.DB.prepare('SELECT 1').first();
    return json({ ok: true, service: 'gb-bess-pipelines' });
  } catch {
    return json({ ok: false, service: 'gb-bess-pipelines' }, 503);
  }
};
