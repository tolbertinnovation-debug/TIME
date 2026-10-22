import {HttpError,requireUUID,requireCourse,text} from './policy.mjs';
export const supportCategories=['account','coursework','classes','technical','other'];
const statuses=['open','in-progress','resolved'];
const offsetOf=url=>Math.max(0,Math.min(100000,Math.floor(Number(url.searchParams.get('offset'))||0)));
export async function handleSupport({path,request,url,body,query,member,identity,requireCourse:validateCourse=requireCourse,audit,json}){
 if(!/^\/support(\/|$)/.test(path))return null;
 const admin=member.role==='admin';
 if(path==='/support'&&request.method==='GET'){
  const status=url.searchParams.get('status')||'all',search=(url.searchParams.get('search')||'').trim().slice(0,100),offset=offsetOf(url);
  if(status!=='all'&&!statuses.includes(status))throw new HttpError(400,'Choose a valid request status.');
  const r=await query(`SELECT t.id,t.title,t.category,t.course_id,t.status,t.requester_id,t.assigned_to,t.created_at,t.updated_at,u.name AS requester_name,u.email AS requester_email,assignee.name AS assignee_name,count(*) OVER()::int AS total FROM time_learning.support_tickets t JOIN neon_auth."user" u ON u.id=t.requester_id LEFT JOIN neon_auth."user" assignee ON assignee.id=t.assigned_to WHERE ($1::boolean OR t.requester_id=$2) AND ($3='all' OR t.status=$3) AND ($4='' OR t.title ILIKE '%'||$4||'%' OR u.name ILIKE '%'||$4||'%' OR u.email ILIKE '%'||$4||'%') ORDER BY t.updated_at DESC,t.id LIMIT 50 OFFSET $5`,[admin,identity,status,search,offset]);return json({tickets:r.rows,total:r.rows[0]?.total||0,offset});
 }
 if(path==='/support'&&request.method==='POST'){
  const b=await body();if(!b||typeof b!=='object')throw new HttpError(400,'Enter your request details.');
  const title=text(b.title,1,160,'Subject'),content=text(b.content,1,4000,'Message');if(!supportCategories.includes(b.category))throw new HttpError(400,'Choose a support category.');
  const course=b.courseId||null;if(course)validateCourse(course);
  const r=await query(`WITH created AS (INSERT INTO time_learning.support_tickets(requester_id,title,category,course_id) VALUES($1,$2,$3,$4) RETURNING id), message AS (INSERT INTO time_learning.support_messages(ticket_id,author_id,content,staff_reply) SELECT id,$1,$5,false FROM created) SELECT id FROM created`,[identity,title,b.category,course,content]);await audit('support.create',r.rows[0].id);return json({ticket:r.rows[0]},201);
 }
 if(path==='/support/overview'&&request.method==='GET'){
  if(!admin)throw new HttpError(403,'Administrator access is required.');
  const r=await query(`SELECT count(*) FILTER(WHERE status='open')::int AS open,count(*) FILTER(WHERE status='in-progress')::int AS in_progress,count(*) FILTER(WHERE status='resolved')::int AS resolved,count(*) FILTER(WHERE assigned_to IS NULL AND status<>'resolved')::int AS unassigned FROM time_learning.support_tickets`);return json({overview:r.rows[0]});
 }
 const match=path.match(/^\/support\/([^/]+)(\/messages|\/assignment)?$/);
 if(match){
  const id=requireUUID(match[1]),ticket=(await query(`SELECT t.*,u.name AS requester_name,u.email AS requester_email,assignee.name AS assignee_name FROM time_learning.support_tickets t JOIN neon_auth."user" u ON u.id=t.requester_id LEFT JOIN neon_auth."user" assignee ON assignee.id=t.assigned_to WHERE t.id=$1 AND ($2::boolean OR t.requester_id=$3)`,[id,admin,identity])).rows[0];if(!ticket)throw new HttpError(404,'Support request not found.');
  if(!match[2]&&request.method==='GET'){
   const offset=offsetOf(url),r=await query(`SELECT m.id::text,m.content,m.staff_reply,m.created_at,u.name AS author_name,count(*) OVER()::int AS total FROM time_learning.support_messages m JOIN neon_auth."user" u ON u.id=m.author_id WHERE m.ticket_id=$1 ORDER BY m.id LIMIT 50 OFFSET $2`,[id,offset]);return json({ticket,messages:r.rows,total:r.rows[0]?.total||0,offset});
  }
  if(!match[2]&&request.method==='PUT'){
   const b=await body(),status=b?.status;if(!statuses.includes(status))throw new HttpError(400,'Choose a valid request status.');if(!admin&&status==='in-progress')throw new HttpError(403,'You can reopen or resolve your own support request.');
   await query(`UPDATE time_learning.support_tickets SET status=$2,updated_at=now() WHERE id=$1 AND ($3::boolean OR requester_id=$4)`,[id,status,admin,identity]);await audit('support.'+status,id);return json({ok:true});
  }
  if(match[2]==='/assignment'&&request.method==='PUT'){
   if(!admin)throw new HttpError(403,'Administrator access is required.');const b=await body();if(!['claim','release'].includes(b?.action))throw new HttpError(400,'Choose claim or release.');
   const r=await query(`UPDATE time_learning.support_tickets SET assigned_to=$2,updated_at=now() WHERE id=$1 AND (assigned_to IS NULL OR assigned_to=$3) RETURNING id`,[id,b.action==='claim'?identity:null,identity]);if(!r.rows[0])throw new HttpError(409,'Another administrator has claimed this request. Ask them to release it first.');await audit('support.'+b.action,id);return json({ok:true});
  }
  if(match[2]==='/messages'&&request.method==='POST'){
   const b=await body(),content=text(b?.content,1,4000,'Message');
   const r=await query(`WITH available AS (UPDATE time_learning.support_tickets SET updated_at=now() WHERE id=$1 AND status<>'resolved' AND ($2::boolean OR requester_id=$3) RETURNING id), posted AS (INSERT INTO time_learning.support_messages(ticket_id,author_id,content,staff_reply) SELECT id,$3,$4,$2 FROM available RETURNING id) SELECT id::text FROM posted`,[id,admin,identity,content]);if(!r.rows[0])throw new HttpError(409,'Reopen this request before adding another reply.');await audit('support.reply',id);return json({ok:true},201);
  }
 }
 throw new HttpError(404,'This support action is not available.');
}
