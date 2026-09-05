import { json, type PagesContext, textParam, intParam } from '../_shared';

export const onRequestGet = async ({ env, request }: PagesContext): Promise<Response> => {
  try {
    const url=new URL(request.url);
    const source=textParam(url,'source');const status=textParam(url,'status');const operator=textParam(url,'operator');const q=textParam(url,'q');
    const year=intParam(url,'year',0,0,2200);const clauses=['latitude IS NOT NULL','longitude IS NOT NULL'];const values:unknown[]=[];
    if(source&&['transmission','distribution'].includes(source)){clauses.push('source = ?');values.push(source)}
    if(status){clauses.push('status = ?');values.push(status)}
    if(operator){clauses.push('operator_name = ?');values.push(operator)}
    if(year){clauses.push('target_year = ?');values.push(year)}
    if(q){clauses.push("(project_name LIKE ? ESCAPE '\\' OR site_name LIKE ? ESCAPE '\\' OR customer_name LIKE ? ESCAPE '\\')");const pattern=`%${q.replaceAll('%','\\%').replaceAll('_','\\_')}%`;values.push(pattern,pattern,pattern)}
    const result=await env.DB.prepare(`SELECT id,source,project_name,status,capacity_mw,latitude,longitude FROM storage_sites WHERE ${clauses.join(' AND ')} ORDER BY capacity_mw DESC LIMIT 10000`).bind(...values).all();
    return json({data:result.results});
  } catch(error){console.error(error);return json({error:'Unable to load map projects.'},500)}
};
