import {HttpError,requireUUID,requireCourse,text} from './policy.mjs';
export async function handleAdmin({path,request,url,body,query,member,identity,requireCourse:validateCourse=requireCourse,audit,json}){
 if(!path.startsWith('/admin/'))return null;
 if(member.role!=='admin')throw new HttpError(403,'Administrator access is required.');
 if(path==='/admin/overview'&&request.method==='GET'){
  const r=await query(`SELECT
   (SELECT count(*)::int FROM neon_auth."user") AS users,
   (SELECT count(*)::int FROM neon_auth."user" u LEFT JOIN time_learning.members m ON m.user_id=u.id WHERE coalesce(m.role,'student')='student') AS students,
   (SELECT count(*)::int FROM time_learning.members WHERE role='lecturer') AS lecturers,
   (SELECT count(*)::int FROM neon_auth."user" WHERE NOT "emailVerified") AS unverified,
   (SELECT count(*)::int FROM time_learning.members WHERE suspended) AS suspended,
   (SELECT count(*)::int FROM time_learning.enrollments WHERE status='pending') AS pending_enrollments,
   (SELECT count(*)::int FROM time_learning.enrollments WHERE status='approved') AS approved_enrollments,
   (SELECT count(*)::int FROM time_learning.submissions WHERE graded_at IS NULL) AS ungraded,
   (SELECT count(*)::int FROM time_learning.sessions WHERE starts_at>=now()) AS upcoming_classes`);
  return json({overview:r.rows[0]});
 }
 if(path==='/admin/users'&&request.method==='GET'){
  const search=(url.searchParams.get('search')||'').trim().slice(0,100),offset=Math.max(0,Math.min(100000,Number(url.searchParams.get('offset'))||0));
  const r=await query(`SELECT u.id AS user_id,u.name,u.email,u."emailVerified" AS verified,coalesce(u.banned,false) AS banned,coalesce(m.role,'student') AS role,coalesce(m.suspended,false) AS suspended,
   ARRAY(SELECT t.course_id FROM time_learning.teaching t WHERE t.user_id=u.id AND t.active) AS teaching,
   count(*) OVER()::int AS total
   FROM neon_auth."user" u LEFT JOIN time_learning.members m ON m.user_id=u.id
   WHERE $1='' OR u.name ILIKE '%'||$1||'%' OR u.email ILIKE '%'||$1||'%' ORDER BY u."createdAt" DESC,u.id LIMIT 50 OFFSET $2`,[search,Math.floor(offset)]);
  return json({users:r.rows,total:r.rows[0]?.total||0,offset:Math.floor(offset)});
 }
 const statusMatch=path.match(/^\/admin\/users\/([^/]+)\/status$/);
 if(statusMatch&&request.method==='PUT'){
  const id=requireUUID(statusMatch[1]),b=await body();if(typeof b.suspended!=='boolean')throw new HttpError(400,'Choose suspend or restore.');
  if(id===identity)throw new HttpError(409,'You cannot suspend your own account.');
  const target=(await query('SELECT id FROM neon_auth."user" WHERE id=$1',[id])).rows[0];if(!target)throw new HttpError(404,'Account not found.');
  const r=await query(`INSERT INTO time_learning.members(user_id,suspended) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET suspended=excluded.suspended WHERE time_learning.members.role<>'admin' RETURNING user_id`,[id,b.suspended]);
  if(!r.rows[0])throw new HttpError(409,'Administrator accounts cannot be suspended here.');await audit(b.suspended?'user.suspend':'user.restore',id);return json({ok:true});
 }
 if(path==='/admin/teaching'&&request.method==='PUT'){
  const b=await body();requireUUID(b.userId);validateCourse(b.courseId);if(b.active!==false)throw new HttpError(400,'Use lecturer approval to assign a course.');
  await query('UPDATE time_learning.teaching SET active=false WHERE user_id=$1 AND course_id=$2',[b.userId,b.courseId]);await audit('lecturer.course.revoke',b.userId+':'+b.courseId);return json({ok:true});
 }
 if(path==='/admin/enrollments'&&request.method==='GET'){
  const status=url.searchParams.get('status')||'pending',search=(url.searchParams.get('search')||'').trim().slice(0,100),offset=Math.max(0,Math.min(100000,Number(url.searchParams.get('offset'))||0));
  if(!['all','pending','approved','declined'].includes(status))throw new HttpError(400,'Invalid enrollment status.');
  const r=await query(`SELECT e.user_id,e.course_id,e.status,e.cohort,e.joined_at,u.name,u.email,u."emailVerified" AS verified,m.suspended,count(*) OVER()::int AS total
   FROM time_learning.enrollments e JOIN neon_auth."user" u ON u.id=e.user_id JOIN time_learning.members m ON m.user_id=e.user_id
   WHERE ($1='all' OR e.status=$1) AND ($2='' OR u.name ILIKE '%'||$2||'%' OR u.email ILIKE '%'||$2||'%' OR e.cohort ILIKE '%'||$2||'%') ORDER BY e.joined_at DESC,e.user_id,e.course_id LIMIT 50 OFFSET $3`,[status,search,Math.floor(offset)]);
  return json({enrollments:r.rows,total:r.rows[0]?.total||0,offset:Math.floor(offset)});
 }
 if(path==='/admin/enrollments'&&request.method==='PUT'){
  const b=await body();requireUUID(b.userId);validateCourse(b.courseId);if(!['pending','approved','declined'].includes(b.status))throw new HttpError(400,'Invalid enrollment status.');
  const cohort=text(b.cohort,1,80,'Cohort');if(b.status==='approved'&&(await query('SELECT archived FROM time_learning.courses WHERE id=$1',[b.courseId])).rows[0]?.archived)throw new HttpError(409,'Restore this archived course before approving enrolment.');
  const target=(await query(`SELECT m.role,m.suspended,u."emailVerified" AS verified,u.banned FROM time_learning.members m JOIN neon_auth."user" u ON u.id=m.user_id WHERE m.user_id=$1`,[b.userId])).rows[0];
  if(!target||(b.status==='approved'&&(target.role!=='student'||!target.verified||target.banned||target.suspended)))throw new HttpError(400,'Choose an active, verified student account.');
  await query(`INSERT INTO time_learning.enrollments(user_id,course_id,status,cohort) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,course_id) DO UPDATE SET status=excluded.status,cohort=excluded.cohort,cohort_id=CASE WHEN time_learning.enrollments.cohort=excluded.cohort THEN time_learning.enrollments.cohort_id ELSE NULL END`,[b.userId,b.courseId,b.status,cohort]);await audit('enrollment.'+b.status,b.userId+':'+b.courseId);return json({ok:true});
 }
 throw new HttpError(404,'This administrator action is not available.');
}
