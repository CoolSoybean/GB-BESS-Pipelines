import { demoProjects, demoSummary } from './demo';
import type { Project, Source, Summary } from './types';

const base = import.meta.env.VITE_API_BASE_URL ?? '';

export interface Filters { source: Source | 'all'; q: string; status: string; operator: string; year: string }

export async function loadData(filters: Filters): Promise<{ projects: Project[]; summary: Summary; demo: boolean }> {
  const params = new URLSearchParams({ pageSize:'500' });
  if (filters.source !== 'all') params.set('source', filters.source);
  if (filters.q) params.set('q', filters.q);
  if (filters.status) params.set('status', filters.status);
  if (filters.operator) params.set('operator', filters.operator);
  if (filters.year) params.set('year', filters.year);
  try {
    const [projectsResponse, summaryResponse] = await Promise.all([
      fetch(`${base}/api/projects?${params}`), fetch(`${base}/api/summary`),
    ]);
    if (!projectsResponse.ok || !summaryResponse.ok) throw new Error('API unavailable');
    const projectPayload = await projectsResponse.json() as { data: Project[] };
    const summary = await summaryResponse.json() as Summary;
    return { projects: projectPayload.data, summary, demo:false };
  } catch {
    const projects = demoProjects.filter(p =>
      (filters.source === 'all' || p.source === filters.source) &&
      (!filters.q || `${p.project_name} ${p.site_name} ${p.customer_name}`.toLowerCase().includes(filters.q.toLowerCase())) &&
      (!filters.status || p.status === filters.status) &&
      (!filters.operator || p.operator_name === filters.operator) &&
      (!filters.year || String(p.target_year) === filters.year)
    );
    return { projects, summary:demoSummary, demo:true };
  }
}
