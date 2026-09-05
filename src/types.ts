export type Source = 'transmission' | 'distribution';

export interface Project {
  id: string;
  source: Source;
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
}

export interface Summary {
  headline: { projects: number; capacity: number; connected: number; transmission: number; distribution: number };
  statuses: Array<{ name: string; projects: number; capacity: number }>;
  technologies: Array<{ name: string; projects: number; capacity: number }>;
  timeline: Array<{ year: number; projects: number; capacity: number }>;
  operators: Array<{ value: string }>;
  sync: Array<{ source: Source; last_success_at: string | null; record_count: number; status: string; error_message: string | null }>;
}
