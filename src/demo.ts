import type { Project, Summary } from './types';

export const demoProjects: Project[] = [
  { id:'t-1', source:'transmission', project_name:'Iron Acton', customer_name:'Iron Acton Green Limited', site_name:'Iron Acton Substation', operator_name:'NGET', technology:'Storage (co-located renewable)', status:'Built', capacity_mw:120, connected_capacity_mw:99.4, accepted_capacity_mw:120, connection_date:'2024-06-01', target_year:2026, latitude:51.569, longitude:-2.481, synced_at:'2026-09-05T02:15:00Z' },
  { id:'t-2', source:'transmission', project_name:'Kintore Storage', customer_name:'Kintore Grid Storage', site_name:'Kintore Substation', operator_name:'SHET', technology:'Battery Energy Storage', status:'Contracted', capacity_mw:300, connected_capacity_mw:0, accepted_capacity_mw:300, connection_date:null, target_year:2028, latitude:57.237, longitude:-2.346, synced_at:'2026-09-05T02:15:00Z' },
  { id:'t-3', source:'transmission', project_name:'Carrington Storage', customer_name:'Carrington Energy', site_name:'Carrington Substation', operator_name:'NGET', technology:'Battery Energy Storage', status:'Scoping', capacity_mw:250, connected_capacity_mw:0, accepted_capacity_mw:250, connection_date:null, target_year:2029, latitude:53.431, longitude:-2.421, synced_at:'2026-09-05T02:15:00Z' },
  { id:'t-4', source:'transmission', project_name:'Ferrybridge BESS', customer_name:'Harmony Energy', site_name:'Ferrybridge Substation', operator_name:'NGET', technology:'Battery Energy Storage', status:'Planning', capacity_mw:200, connected_capacity_mw:0, accepted_capacity_mw:200, connection_date:null, target_year:2030, latitude:53.711, longitude:-1.277, synced_at:'2026-09-05T02:15:00Z' },
  { id:'d-1', source:'distribution', project_name:'Minety Storage', customer_name:'Minety Power', site_name:'Minety', operator_name:'National Grid Electricity Distribution', technology:'Battery Energy Storage', status:'CONNECTED', capacity_mw:100, connected_capacity_mw:100, accepted_capacity_mw:null, connection_date:'2023-11-01', target_year:2023, latitude:51.616, longitude:-1.957, synced_at:'2026-09-05T02:15:00Z' },
  { id:'d-2', source:'distribution', project_name:'Clay Tye', customer_name:'Field', site_name:'Essex', operator_name:'UK Power Networks', technology:'Battery Energy Storage', status:'ACCEPTED TO CONNECT', capacity_mw:99, connected_capacity_mw:null, accepted_capacity_mw:99, connection_date:null, target_year:2027, latitude:51.69, longitude:0.36, synced_at:'2026-09-05T02:15:00Z' },
  { id:'d-3', source:'distribution', project_name:'Salisbury BESS', customer_name:'Grid Scale Developments', site_name:'Salisbury', operator_name:'Scottish and Southern Electricity Networks', technology:'Storage (co-located renewable)', status:'ACCEPTED TO CONNECT', capacity_mw:80, connected_capacity_mw:null, accepted_capacity_mw:80, connection_date:null, target_year:2028, latitude:51.069, longitude:-1.795, synced_at:'2026-09-05T02:15:00Z' },
  { id:'d-4', source:'distribution', project_name:'Welshpool Storage', customer_name:'BESS Developments', site_name:'Welshpool', operator_name:'National Grid Electricity Distribution', technology:'Battery Energy Storage', status:'SCOPING', capacity_mw:50, connected_capacity_mw:null, accepted_capacity_mw:50, connection_date:null, target_year:2031, latitude:52.66, longitude:-3.147, synced_at:'2026-09-05T02:15:00Z' },
];

export function summaryFromProjects(projects: Project[]): Summary {
  const by = <T extends string | number>(key: (p: Project) => T | null) => Object.values(projects.reduce<Record<string,{ name:T;projects:number;capacity:number }>>((acc,p) => {
    const value = key(p); if (value === null) return acc; const k=String(value); acc[k] ??= { name:value,projects:0,capacity:0 }; acc[k].projects++; acc[k].capacity += p.capacity_mw; return acc;
  },{}));
  const statuses = by((p)=>p.status ?? 'Unknown').sort((a,b)=>b.capacity-a.capacity);
  const technologies = by((p)=>p.technology ?? 'Unknown').sort((a,b)=>b.capacity-a.capacity);
  const timeline = by((p)=>p.target_year).map(x=>({year:Number(x.name),projects:x.projects,capacity:x.capacity})).sort((a,b)=>a.year-b.year);
  const capacity = projects.reduce((sum,p)=>sum+p.capacity_mw,0);
  const connected = projects.filter(p=>/built|connected/i.test(p.status ?? '')).reduce((sum,p)=>sum+p.capacity_mw,0);
  return {
    headline:{ projects:projects.length, capacity, connected, transmission:projects.filter(p=>p.source==='transmission').reduce((s,p)=>s+p.capacity_mw,0), distribution:projects.filter(p=>p.source==='distribution').reduce((s,p)=>s+p.capacity_mw,0) },
    statuses, technologies, timeline,
    operators:[...new Set(projects.map(p=>p.operator_name).filter(Boolean))].sort().map(value=>({value:value!})),
    sync:[{source:'transmission',last_success_at:projects[0]?.synced_at ?? null,record_count:4,status:'demo',error_message:null},{source:'distribution',last_success_at:projects[0]?.synced_at ?? null,record_count:4,status:'demo',error_message:null}],
  };
}

export const demoSummary = summaryFromProjects(demoProjects);
