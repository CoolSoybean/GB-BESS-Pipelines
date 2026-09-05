import { demoProjects, demoSummary } from './demo';
import type { MapProject, Project, Source, Summary } from './types';

const base = import.meta.env.VITE_API_BASE_URL ?? '';
export const PROJECTS_PER_PAGE = 50;

export interface Filters { source: Source | 'all'; q: string; status: string; operator: string; year: string }
export interface Pagination { page: number; pageSize: number; total: number }

function filterParams(filters: Filters) {
  const params = new URLSearchParams();
  if (filters.source !== 'all') params.set('source', filters.source);
  if (filters.q.trim().length >= 2) params.set('q', filters.q.trim());
  if (filters.status) params.set('status', filters.status);
  if (filters.operator) params.set('operator', filters.operator);
  if (filters.year) params.set('year', filters.year);
  return params;
}

function filterDemo(filters: Filters) {
  return demoProjects.filter(p =>
    (filters.source === 'all' || p.source === filters.source) &&
    (!filters.q || `${p.project_name} ${p.site_name} ${p.customer_name}`.toLowerCase().includes(filters.q.toLowerCase())) &&
    (!filters.status || p.status === filters.status) &&
    (!filters.operator || p.operator_name === filters.operator) &&
    (!filters.year || String(p.target_year) === filters.year)
  );
}

export async function loadSummary(): Promise<{ summary: Summary; demo: boolean }> {
  try {
    const response=await fetch(`${base}/api/summary`);
    if(!response.ok) throw new Error('API unavailable');
    return {summary:await response.json() as Summary,demo:false};
  } catch { return {summary:demoSummary,demo:true}; }
}

export async function loadProjects(filters: Filters, page: number): Promise<{ projects: Project[]; pagination: Pagination; demo: boolean }> {
  const params=filterParams(filters);params.set('page',String(page));params.set('pageSize',String(PROJECTS_PER_PAGE));
  try {
    const response=await fetch(`${base}/api/projects?${params}`);
    if(!response.ok) throw new Error('API unavailable');
    const payload=await response.json() as {data:Project[];pagination:Pagination};
    return {projects:payload.data,pagination:payload.pagination,demo:false};
  } catch {
    const filtered=filterDemo(filters);const start=(page-1)*PROJECTS_PER_PAGE;
    return {projects:filtered.slice(start,start+PROJECTS_PER_PAGE),pagination:{page,pageSize:PROJECTS_PER_PAGE,total:filtered.length},demo:true};
  }
}

export async function loadMapProjects(filters: Filters): Promise<MapProject[]> {
  const params=filterParams(filters);
  try {
    const response=await fetch(`${base}/api/map?${params}`);
    if(!response.ok) throw new Error('API unavailable');
    return (await response.json() as {data:MapProject[]}).data;
  } catch {
    return filterDemo(filters).map(({id,source,project_name,status,capacity_mw,latitude,longitude})=>({id,source,project_name,status,capacity_mw,latitude,longitude}));
  }
}

export async function recordVisit(): Promise<number | null> {
  const stored = sessionStorage.getItem('gb-bess-visit-total');
  if (stored) return Number(stored);
  try {
    const response = await fetch(`${base}/api/visits`, { method: 'POST' });
    if (!response.ok) throw new Error('Visit counter unavailable');
    const { total } = await response.json() as { total: number };
    sessionStorage.setItem('gb-bess-visit-total', String(total));
    return total;
  } catch {
    return null;
  }
}
