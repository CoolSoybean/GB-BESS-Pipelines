import { memo, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, BatteryCharging, ChevronLeft, ChevronRight, Coffee, Database, FilterX, Map, RefreshCw, Search, Server, TriangleAlert, Zap } from 'lucide-react';
import { loadMapProjects, loadProjects, loadSummary, recordVisit, PROJECTS_PER_PAGE, type Filters, type Pagination } from './api';
import type { MapProject, Project, Summary } from './types';

const colors = { transmission:'#0f9f98', distribution:'#f59e0b', navy:'#0c2d48', muted:'#64748b' };
const initialFilters: Filters = { source:'all', q:'', status:'', operator:'', year:'' };
const KOFI_URL='https://ko-fi.com/0xkai';

function formatCapacity(value: number) {
  return value >= 1000 ? `${(value/1000).toFixed(1)} GW` : `${Math.round(value).toLocaleString()} MW`;
}

function StatCard({ label, value, detail, icon:Icon, tone='teal' }: { label:string; value:string; detail:string; icon:typeof Zap; tone?:'teal'|'amber'|'navy' }) {
  return <article className="stat-card">
    <div className={`stat-icon ${tone}`}><Icon size={20}/></div>
    <div><p>{label}</p><strong>{value}</strong><span>{detail}</span></div>
  </article>;
}

function StatusAxisTick({ x=0, y=0, payload }: { x?:number; y?:number; payload?:{value:string} }) {
  const label=payload?.value ?? '';
  const lines=label==='UnderConstruction/Commissioning'
    ? ['Under construction','/ Commissioning']
    : [label];
  return <text x={x} y={y} textAnchor="end" fill="#666" fontSize={11}>
    {lines.map((line,index)=><tspan key={index} x={x} dy={index===0?(lines.length===2?-3:4):14}>{line}</tspan>)}
  </text>;
}

function StatusPill({ value }: { value:string|null }) {
  const label=value ?? 'Unknown'; const done=/built|connected/i.test(label); const early=/scope|planning/i.test(label);
  return <span className={`status ${done?'done':early?'early':'progress'}`}>{label}</span>;
}

function Sidebar() {
  const [collapsed,setCollapsed]=useState(()=>localStorage.getItem('sidebar-collapsed')==='true');
  useEffect(()=>{
    document.documentElement.classList.toggle('sidebar-is-collapsed',collapsed);
    localStorage.setItem('sidebar-collapsed',String(collapsed));
    const frame=requestAnimationFrame(()=>window.dispatchEvent(new Event('sidebar-layout-changed')));
    return()=>cancelAnimationFrame(frame);
  },[collapsed]);
  return <aside className="sidebar">
    <div className="brand"><BatteryCharging/><div><strong>GB BESS</strong><span>Pipelines</span></div></div>
    <button className="sidebar-toggle" onClick={()=>setCollapsed(value=>!value)} aria-label={collapsed?'Expand sidebar':'Collapse sidebar'} title={collapsed?'Expand sidebar':'Collapse sidebar'}>{collapsed?<ChevronRight/>:<ChevronLeft/>}</button>
    <nav aria-label="Primary"><a className="active" href="#overview" title="Overview"><Activity/>Overview</a><a href="#map" title="Project map"><Map/>Project map</a><a href="#projects" title="Projects"><Database/>Projects</a></nav>
    <div className="source-note" title="Source: NESO TEC / DNO ECR"><Server/><div><strong>Source</strong><span>NESO TEC / DNO ECR</span></div></div>
  </aside>;
}

function KofiSupportButton() {
  const openKofi=(event:MouseEvent<HTMLAnchorElement>)=>{
    if(window.matchMedia('(max-width:720px)').matches)return;

    event.preventDefault();
    const width=Math.min(520,window.screen.availWidth-32);
    const height=Math.min(720,window.screen.availHeight-32);
    const left=Math.max(0,window.screenX+(window.outerWidth-width)/2);
    const top=Math.max(0,window.screenY+(window.outerHeight-height)/2);
    const popup=window.open(KOFI_URL,'kofi-support',`popup=yes,width=${width},height=${height},left=${Math.round(left)},top=${Math.round(top)},scrollbars=yes,resizable=yes`);

    if(popup){popup.opener=null;popup.focus()}
    else window.location.assign(KOFI_URL);
  };

  return <a className="kofi-support" href={KOFI_URL} target="_blank" rel="noopener noreferrer" onClick={openKofi} aria-label="Support us on Ko-fi"><Coffee aria-hidden="true"/><span>Support Me</span></a>;
}

function MapResizeOnSidebarChange() {
  const map=useMap();
  useEffect(()=>{const resize=()=>map.invalidateSize({animate:false});window.addEventListener('sidebar-layout-changed',resize);return()=>window.removeEventListener('sidebar-layout-changed',resize)},[map]);
  return null;
}

const ProjectMap=memo(function ProjectMap({ projects }: { projects:MapProject[] }) {
  const points=projects.filter(p=>p.latitude!=null&&p.longitude!=null);
  return <MapContainer center={[54.5,-3]} zoom={5} minZoom={4} scrollWheelZoom className="map">
    <MapResizeOnSidebarChange/>
    <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    {points.map(p=><CircleMarker key={p.id} center={[p.latitude!,p.longitude!]} radius={Math.min(13,5+Math.sqrt(Math.max(p.capacity_mw,0))/4)} pathOptions={{color:'#fff',weight:2,fillColor:colors[p.source],fillOpacity:.9}}>
      <Popup><strong>{p.project_name}</strong><br/>{p.source}<br/>{formatCapacity(p.capacity_mw)}<br/>{p.status}</Popup>
    </CircleMarker>)}
  </MapContainer>;
});

function Dashboard({ projects, mapProjects, pagination, page, setPage, summary, demo, filters, setFilters, reload, loading, totalVisits }: { projects:Project[]; mapProjects:MapProject[]; pagination:Pagination; page:number; setPage:(page:number)=>void; summary:Summary; demo:boolean; filters:Filters; setFilters:(f:Filters)=>void; reload:()=>void; loading:boolean; totalVisits:number|null }) {
  const statuses=useMemo(()=>summary.statuses.map(item=>item.name).sort(),[summary.statuses]);
  const years=useMemo(()=>summary.timeline.map(item=>item.year).sort((a,b)=>a-b),[summary.timeline]);
  const updated=summary.sync.map(s=>s.last_success_at).filter(Boolean).sort().at(-1);
  const development=Math.max(0,Number(summary.headline.capacity)-Number(summary.headline.connected));
  const totalPages=Math.max(1,Math.ceil(pagination.total/pagination.pageSize));
  const rangeStart=pagination.total?(page-1)*pagination.pageSize+1:0;
  const rangeEnd=Math.min(page*pagination.pageSize,pagination.total);
  return <div className="shell">
    <Sidebar/>

    <main>
      <header className="topbar">
        <div><p className="eyebrow">GREAT BRITAIN ENERGY STORAGE</p><h1>Storage pipeline intelligence</h1><p>Transmission and distribution-connected projects in one view.</p></div>
        <div className="sync"><button onClick={reload} disabled={loading} aria-label="Refresh data"><RefreshCw className={loading?'spin':''}/></button><div><span>Last synced</span><strong>{updated?new Date(updated).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'}):'Not yet synced'}</strong></div></div>
      </header>

      {demo&&<div className="demo-banner"><strong>Demo mode</strong><span>—</span><TriangleAlert aria-label="Alert"/>daily operation limit exceeded</div>}

      <section className="tabs" aria-label="Connection type">
        {(['all','transmission','distribution'] as const).map(source=><button key={source} className={filters.source===source?'active':''} onClick={()=>setFilters({...filters,source})}>{source==='all'?'All projects':source[0].toUpperCase()+source.slice(1)}</button>)}
      </section>

      <section id="overview" className="stats-grid">
        <StatCard label="Total projects" value={Number(summary.headline.projects).toLocaleString()} detail="Across both connection levels" icon={Database}/>
        <StatCard label="Pipeline capacity" value={formatCapacity(Number(summary.headline.capacity))} detail="Combined reported capacity" icon={Zap} tone="navy"/>
        <StatCard label="Connected / built" value={formatCapacity(Number(summary.headline.connected))} detail="Operational capacity" icon={Activity}/>
        <StatCard label="In development" value={formatCapacity(development)} detail="Remaining pipeline" icon={BatteryCharging} tone="amber"/>
      </section>

      <section className="visual-grid">
        <article id="map" className="panel map-panel"><div className="panel-heading"><div><span className="kicker">GEOGRAPHY</span><h2>Project map</h2></div><div className="legend"><span><i className="transmission"/>Transmission</span><span><i className="distribution"/>Distribution</span></div></div><ProjectMap projects={mapProjects}/></article>
        <article className="panel"><div className="panel-heading"><div><span className="kicker">PIPELINE</span><h2>Capacity by status</h2></div><span className="unit">MW</span></div><div className="chart tall"><ResponsiveContainer initialDimension={{width:600,height:330}}><BarChart data={summary.statuses.slice(0,7)} layout="vertical" margin={{left:18,right:35}}><CartesianGrid horizontal={false} strokeDasharray="3 3"/><XAxis type="number" tickLine={false} axisLine={false}/><YAxis dataKey="name" type="category" width={105} tickLine={false} axisLine={false} tick={<StatusAxisTick/>}/><Tooltip formatter={(v)=>formatCapacity(Number(v))}/><Bar dataKey="capacity" radius={[0,6,6,0]}>{summary.statuses.slice(0,7).map((_,i)=><Cell key={i} fill={i%2?colors.navy:colors.transmission}/>)}</Bar></BarChart></ResponsiveContainer></div></article>
      </section>

      <section className="chart-grid">
        <article className="panel"><div className="panel-heading"><div><span className="kicker">DELIVERY</span><h2>Target energisation timeline</h2></div></div><div className="chart"><ResponsiveContainer initialDimension={{width:700,height:235}}><AreaChart data={summary.timeline}><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={colors.transmission} stopOpacity=".35"/><stop offset="1" stopColor={colors.transmission} stopOpacity=".02"/></linearGradient></defs><CartesianGrid vertical={false} strokeDasharray="3 3"/><XAxis dataKey="year" tickLine={false} axisLine={false}/><YAxis tickLine={false} axisLine={false}/><Tooltip formatter={(v)=>formatCapacity(Number(v))}/><Area dataKey="capacity" stroke={colors.transmission} fill="url(#area)" strokeWidth={3}/></AreaChart></ResponsiveContainer></div></article>
        <article className="panel"><div className="panel-heading"><div><span className="kicker">TECHNOLOGY</span><h2>Technology mix</h2></div></div><div className="tech-wrap"><div className="donut"><ResponsiveContainer initialDimension={{width:260,height:210}}><PieChart><Pie data={summary.technologies.slice(0,6)} dataKey="capacity" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={2}>{summary.technologies.slice(0,6).map((_,i)=><Cell key={i} fill={[colors.transmission,colors.navy,colors.distribution,'#7c3aed','#38bdf8','#94a3b8'][i]}/>)}</Pie><Tooltip formatter={(v)=>formatCapacity(Number(v))}/></PieChart></ResponsiveContainer></div><div className="tech-list">{summary.technologies.slice(0,6).map((t,i)=><div key={t.name}><i style={{background:[colors.transmission,colors.navy,colors.distribution,'#7c3aed','#38bdf8','#94a3b8'][i]}}/><span title={t.name}>{t.name}</span><strong>{formatCapacity(Number(t.capacity))}</strong></div>)}</div></div></article>
      </section>

      <section id="projects" className="panel projects-panel">
        <div className="panel-heading"><div><span className="kicker">REGISTER</span><h2>Storage projects</h2></div><span className="result-count">{rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of {pagination.total.toLocaleString()}</span></div>
        <div className="filters"><label className="search"><Search/><input value={filters.q} onChange={e=>setFilters({...filters,q:e.target.value})} placeholder="Search projects, sites or customers"/></label><select aria-label="Status" value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}><option value="">All statuses</option>{statuses.map(x=><option key={x}>{x}</option>)}</select><select aria-label="Operator" value={filters.operator} onChange={e=>setFilters({...filters,operator:e.target.value})}><option value="">All operators</option>{summary.operators.map(x=><option key={x.value}>{x.value}</option>)}</select><select aria-label="Target year" value={filters.year} onChange={e=>setFilters({...filters,year:e.target.value})}><option value="">All target years</option>{years.map(x=><option key={x}>{x}</option>)}</select><button className="clear" onClick={()=>setFilters(initialFilters)}><FilterX/>Clear</button></div>
        <div className="table-wrap"><table><thead><tr><th>Project</th><th>Customer</th><th>Site</th><th>Technology</th><th>Connection</th><th>Status</th><th>Capacity</th><th>Target</th><th>Operator</th></tr></thead><tbody>{projects.map(p=><tr key={p.id}><td><strong>{p.project_name}</strong></td><td>{p.customer_name ?? '—'}</td><td>{p.site_name ?? '—'}</td><td>{p.technology ?? '—'}</td><td><span className={`connection ${p.source}`}><i/>{p.source}</span></td><td><StatusPill value={p.status}/></td><td><strong>{formatCapacity(p.capacity_mw)}</strong></td><td>{p.target_year ?? '—'}</td><td>{p.operator_name ?? '—'}</td></tr>)}{!projects.length&&<tr><td colSpan={9} className="empty">No projects match these filters.</td></tr>}</tbody></table></div>
        <div className="pagination"><button onClick={()=>setPage(Math.max(1,page-1))} disabled={page<=1||loading}>Previous</button><span>Page {page.toLocaleString()} of {totalPages.toLocaleString()}</span><button onClick={()=>setPage(Math.min(totalPages,page+1))} disabled={page>=totalPages||loading}>Next</button></div>
      </section>
      <footer><span>Created by the GB124 Team and developed by ChatGPT.</span><span>Total visits: {totalVisits?.toLocaleString() ?? '—'}</span></footer>
    </main>
    <KofiSupportButton/>
  </div>;
}

export default function App() {
  const [filters,setFilterState]=useState<Filters>(initialFilters); const [projects,setProjects]=useState<Project[]>([]); const [mapProjects,setMapProjects]=useState<MapProject[]>([]); const [pagination,setPagination]=useState<Pagination>({page:1,pageSize:PROJECTS_PER_PAGE,total:0}); const [page,setPage]=useState(1); const [summary,setSummary]=useState<Summary|null>(null); const [demo,setDemo]=useState(false); const [loading,setLoading]=useState(true); const [revision,setRevision]=useState(0); const [totalVisits,setTotalVisits]=useState<number|null>(null);
  const setFilters=(next:Filters)=>{setLoading(true);setPage(1);setFilterState(next)};
  useEffect(()=>{let active=true;loadSummary().then(data=>{if(active){setSummary(data.summary);setDemo(data.demo)}});return()=>{active=false}},[revision]);
  useEffect(()=>{let active=true;recordVisit().then(total=>active&&setTotalVisits(total));return()=>{active=false}},[]);
  useEffect(()=>{let active=true;const timer=setTimeout(()=>loadProjects(filters,page).then(data=>{if(active){setProjects(data.projects);setPagination(data.pagination);setDemo(current=>current||data.demo)}}).finally(()=>active&&setLoading(false)),filters.q?500:0);return()=>{active=false;clearTimeout(timer)}},[filters,page,revision]);
  useEffect(()=>{let active=true;const timer=setTimeout(()=>loadMapProjects(filters).then(data=>active&&setMapProjects(data)),filters.q?500:0);return()=>{active=false;clearTimeout(timer)}},[filters,revision]);
  if(!summary)return <div className="loading"><BatteryCharging/><strong>Loading pipeline intelligence…</strong></div>;
  return <Dashboard projects={projects} mapProjects={mapProjects} pagination={pagination} page={page} setPage={next=>{setLoading(true);setPage(next)}} summary={summary} demo={demo} filters={filters} setFilters={setFilters} reload={()=>{setLoading(true);setRevision(x=>x+1)}} loading={loading} totalVisits={totalVisits}/>;
}
