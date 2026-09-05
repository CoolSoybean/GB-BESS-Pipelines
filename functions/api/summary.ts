import { json, type PagesContext } from '../_shared';

export const onRequestGet = async ({ env }: PagesContext): Promise<Response> => {
  try {
    const [headline, statuses, technologies, timeline, operators, sync] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) projects, COALESCE(SUM(capacity_mw),0) capacity,
        COALESCE(SUM(CASE WHEN lower(status) LIKE '%built%' OR lower(status) LIKE '%connected%' THEN capacity_mw ELSE 0 END),0) connected,
        COALESCE(SUM(CASE WHEN source='transmission' THEN capacity_mw ELSE 0 END),0) transmission,
        COALESCE(SUM(CASE WHEN source='distribution' THEN capacity_mw ELSE 0 END),0) distribution
        FROM storage_sites`).first(),
      env.DB.prepare(`SELECT COALESCE(status,'Unknown') name, COUNT(*) projects, ROUND(SUM(capacity_mw),2) capacity FROM storage_sites GROUP BY status ORDER BY capacity DESC LIMIT 10`).all(),
      env.DB.prepare(`SELECT COALESCE(technology,'Unknown') name, COUNT(*) projects, ROUND(SUM(capacity_mw),2) capacity FROM storage_sites GROUP BY technology ORDER BY capacity DESC LIMIT 8`).all(),
      env.DB.prepare(`SELECT target_year year, COUNT(*) projects, ROUND(SUM(capacity_mw),2) capacity FROM storage_sites WHERE target_year BETWEEN 2020 AND 2045 GROUP BY target_year ORDER BY target_year`).all(),
      env.DB.prepare(`SELECT DISTINCT operator_name value FROM storage_sites WHERE operator_name IS NOT NULL ORDER BY operator_name`).all(),
      env.DB.prepare(`SELECT source, last_success_at, record_count, status, error_message FROM sync_state ORDER BY source`).all(),
    ]);
    return json({ headline, statuses: statuses.results, technologies: technologies.results, timeline: timeline.results, operators: operators.results, sync: sync.results });
  } catch (error) {
    console.error(error);
    return json({ error: 'Unable to load summary.' }, 500);
  }
};
