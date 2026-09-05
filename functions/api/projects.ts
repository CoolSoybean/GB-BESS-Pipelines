import { intParam, json, type PagesContext, textParam } from '../_shared';

export const onRequestGet = async ({ env, request }: PagesContext): Promise<Response> => {
  try {
    const url = new URL(request.url);
    const source = textParam(url, 'source');
    const status = textParam(url, 'status');
    const operator = textParam(url, 'operator');
    const technology = textParam(url, 'technology');
    const q = textParam(url, 'q');
    const year = intParam(url, 'year', 0, 0, 2200);
    const page = intParam(url, 'page', 1, 1, 100000);
    const pageSize = intParam(url, 'pageSize', 100, 1, 500);

    const clauses: string[] = [];
    const values: unknown[] = [];
    if (source && ['transmission', 'distribution'].includes(source)) { clauses.push('source = ?'); values.push(source); }
    if (status) { clauses.push('status = ?'); values.push(status); }
    if (operator) { clauses.push('operator_name = ?'); values.push(operator); }
    if (technology) { clauses.push('technology = ?'); values.push(technology); }
    if (year) { clauses.push('target_year = ?'); values.push(year); }
    if (q) {
      clauses.push("(project_name LIKE ? ESCAPE '\\' OR site_name LIKE ? ESCAPE '\\' OR customer_name LIKE ? ESCAPE '\\')");
      const pattern = `%${q.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
      values.push(pattern, pattern, pattern);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const count = await env.DB.prepare(`SELECT COUNT(*) AS total FROM storage_sites ${where}`)
      .bind(...values).first<{ total: number }>();
    const result = await env.DB.prepare(`
      SELECT id, source, project_name, customer_name, site_name, operator_name,
             technology, status, capacity_mw, connected_capacity_mw,
             accepted_capacity_mw, connection_date, target_year, latitude,
             longitude, synced_at
      FROM storage_sites ${where}
      ORDER BY capacity_mw DESC, project_name ASC
      LIMIT ? OFFSET ?
    `).bind(...values, pageSize, (page - 1) * pageSize).all();

    return json({ data: result.results, pagination: { page, pageSize, total: count?.total ?? 0 } });
  } catch (error) {
    console.error(error);
    return json({ error: 'Unable to load projects.' }, 500);
  }
};
