import {HttpError,requireUUID,requireCourse,text} from './policy.mjs';
const cohortStatuses=['planned','active','completed','archived'];
const offsetOf=url=>Math.max(0,Math.min(100000,Math.floor(Number(url.searchParams.get('offset'))||0)));
export function dateOnly(value,label='Date'){
 if(value==null||value==='')return null;
 if(typeof value!=='string'||value.startsWith('0000-')||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw new HttpError(400,label+' must be a valid calendar date.');return value;
}
export function cohortInput(b){
 if(!b||typeof b!=='object'||Array.isArray(b))throw new HttpError(400,'Enter the cohort details.');
 const name=text(b.name,1,80,'Cohort name'),starts=dateOnly(b.startsOn,'Start date'),ends=dateOnly(b.endsOn,'End date');
 if(starts&&ends&&ends<starts)throw new HttpError(400,'The end date must be on or after the start date.');
 if(!cohortStatuses.includes(b.status))throw new HttpError(400,'Choose a valid cohort status.');
 if(!Array.isArray(b.courseIds)||!b.courseIds.length||b.courseIds.length>8||new Set(b.courseIds).size!==b.courseIds.length)throw new HttpError(400,'Choose one or more different courses.');b.courseIds.forEach(requireCourse);
 return [name,starts,ends,b.status,b.courseIds,text(b.notes||'',0,2000,'Cohort notes')];
}
export function csvCell(value){
 let s=value==null?'':value instanceof Date?value.toISOString():String(value);
 if(/^[\s\uFEFF]*[=+\-@]/u.test(s)||/^[\t\r\n]/.test(s))s="'"+s;
 return '"'+s.replaceAll('"','""')+'"';
}
export function toCSV(columns,rows){return '\uFEFF'+[columns.map(c=>csvCell(c.label)).join(','),...rows.map(r=>columns.map(c=>csvCell(r[c.key])).join(','))].join('\r\n')+'\r\n';}
const cols=items=>items.map(([key,label])=>({key,label}));
export const reportTypes={
 students:{columns:cols([['student_id','Student ID'],['name','Student name'],['email','Email'],['verified','Email verified'],['suspended','Suspended'],['banned','Identity blocked'],['registered_at','Registered at']]),sql:`SELECT u.id AS student_id,u.name,u.email,u."emailVerified" AS verified,coalesce(m.suspended,false) AS suspended,coalesce(u.banned,false) AS banned,u."createdAt" AS registered_at,count(*) OVER()::int AS total FROM neon_auth."user" u LEFT JOIN time_learning.members m ON m.user_id=u.id WHERE coalesce(m.role,'student')='student' AND (($1='' AND $2::uuid IS NULL) OR EXISTS(SELECT 1 FROM time_learning.enrollments e WHERE e.user_id=u.id AND ($1='' OR e.course_id=$1) AND ($2::uuid IS NULL OR e.cohort_id=$2))) ORDER BY u.name,u.id`},
 enrollments:{columns:cols([['student_id','Student ID'],['name','Student name'],['email','Email'],['course_id','Course ID'],['cohort','Cohort'],['status','Enrolment status'],['joined_at','Joined at']]),sql:`SELECT e.user_id AS student_id,u.name,u.email,e.course_id,coalesce(c.name,e.cohort) AS cohort,e.status,e.joined_at,count(*) OVER()::int AS total FROM time_learning.enrollments e JOIN neon_auth."user" u ON u.id=e.user_id LEFT JOIN time_learning.cohorts c ON c.id=e.cohort_id WHERE ($1='' OR e.course_id=$1) AND ($2::uuid IS NULL OR e.cohort_id=$2) ORDER BY e.joined_at DESC,e.user_id,e.course_id`},
 grades:{columns:cols([['student_id','Student ID'],['name','Student name'],['email','Email'],['course_id','Course ID'],['cohort','Current cohort'],['title','Assignment'],['submitted_at','Submitted at'],['score','Score out of 100'],['graded_at','Graded at']]),sql:`SELECT s.student_id,u.name,u.email,a.course_id,coalesce(c.name,e.cohort,'') AS cohort,a.title,s.submitted_at,s.score,s.graded_at,count(*) OVER()::int AS total FROM time_learning.submissions s JOIN time_learning.assignments a ON a.id=s.assignment_id JOIN neon_auth."user" u ON u.id=s.student_id LEFT JOIN time_learning.enrollments e ON e.user_id=s.student_id AND e.course_id=a.course_id LEFT JOIN time_learning.cohorts c ON c.id=e.cohort_id WHERE ($1='' OR a.course_id=$1) AND ($2::uuid IS NULL OR e.cohort_id=$2) ORDER BY s.submitted_at DESC,s.id`},
 attendance:{columns:cols([['student_id','Student ID'],['name','Student name'],['email','Email'],['course_id','Course ID'],['cohort','Current cohort'],['title','Class'],['starts_at','Class starts at'],['mode','Delivery'],['status','Attendance'],['updated_at','Recorded at']]),sql:`SELECT a.student_id,u.name,u.email,s.course_id,coalesce(c.name,e.cohort,'') AS cohort,s.title,s.starts_at,s.mode,a.status,a.updated_at,count(*) OVER()::int AS total FROM time_learning.attendance a JOIN time_learning.sessions s ON s.id=a.session_id JOIN neon_auth."user" u ON u.id=a.student_id LEFT JOIN time_learning.enrollments e ON e.user_id=a.student_id AND e.course_id=s.course_id LEFT JOIN time_learning.cohorts c ON c.id=e.cohort_id WHERE a.status<>'unrecorded' AND ($1='' OR s.course_id=$1) AND ($2::uuid IS NULL OR e.cohort_id=$2) ORDER BY s.starts_at DESC,a.session_id,a.student_id`}
};
export async function handleAdminOperations({path,request,url,body,query,member,identity,audit,json,headers}){
 if(!/^\/admin\/(reports|cohorts|activity)(\/|$)/.test(path))return null;
 if(member.role!=='admin')throw new HttpError(403,'Administrator access is required.');
 if(path==='/admin/reports'&&request.method==='GET'){
  const kind=url.searchParams.get('type')||'enrollments';if(!Object.hasOwn(reportTypes,kind))throw new HttpError(400,'Choose a valid report.');
  const course=url.searchParams.get('courseId')||'',cohort=url.searchParams.get('cohortId')||null;if(course)requireCourse(course);if(cohort)requireUUID(cohort);
  const format=url.searchParams.get('format')||'json';if(!['json','csv'].includes(format))throw new HttpError(400,'Choose JSON or CSV.');
  const offset=format==='csv'?0:offsetOf(url),limit=format==='csv'?5001:50,definition=reportTypes[kind];
  const r=await query(definition.sql+' LIMIT $3 OFFSET $4',[course,cohort,limit,offset]);
  if(format==='csv'){
   if(r.rows.length>5000)throw new HttpError(422,'This export exceeds 5,000 rows. Select a course or cohort to narrow it.');
   await audit('report.export',kind+':'+(course||'all')+':'+(cohort||'all'));
   return new Response(toCSV(definition.columns,r.rows),{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="time-'+kind+'.csv"'}});
  }
  return json({columns:definition.columns,rows:r.rows.map(({total,...row})=>row),total:r.rows[0]?.total||0,offset});
 }
 if(path==='/admin/activity'&&request.method==='GET'){
  const search=(url.searchParams.get('search')||'').trim().slice(0,100),from=dateOnly(url.searchParams.get('from'),'From date'),to=dateOnly(url.searchParams.get('to'),'To date'),offset=offsetOf(url);if(from&&to&&to<from)throw new HttpError(400,'The end date must be on or after the start date.');
  const r=await query(`SELECT a.id::text,a.actor,a.action,a.resource_id,a.created_at,u.name AS actor_name,u.email AS actor_email,count(*) OVER()::int AS total FROM time_learning.audit a LEFT JOIN neon_auth."user" u ON u.id=a.actor WHERE ($1='' OR a.action ILIKE '%'||$1||'%' OR a.resource_id ILIKE '%'||$1||'%' OR u.name ILIKE '%'||$1||'%' OR u.email ILIKE '%'||$1||'%') AND ($2::date IS NULL OR a.created_at>=$2::date::timestamp AT TIME ZONE 'Africa/Monrovia') AND ($3::date IS NULL OR a.created_at<($3::date+1)::timestamp AT TIME ZONE 'Africa/Monrovia') ORDER BY a.created_at DESC,a.id DESC LIMIT 50 OFFSET $4`,[search,from,to,offset]);return json({activity:r.rows,total:r.rows[0]?.total||0,offset});
 }
 if(path==='/admin/cohorts'&&request.method==='GET'){
  const r=await query(`SELECT c.id,c.name,to_char(c.starts_on,'YYYY-MM-DD') AS starts_on,to_char(c.ends_on,'YYYY-MM-DD') AS ends_on,c.status,c.course_ids,c.notes,c.updated_at,(SELECT count(DISTINCT e.user_id)::int FROM time_learning.enrollments e WHERE e.cohort_id=c.id) AS students FROM time_learning.cohorts c ORDER BY c.created_at DESC,c.id LIMIT 201`);
  if(r.rows.length>200)throw new HttpError(422,'This workspace supports up to 200 managed cohorts.');return json({cohorts:r.rows});
 }
 if(path==='/admin/cohorts'&&request.method==='POST'){
  const input=cohortInput(await body());
  const r=await query(`INSERT INTO time_learning.cohorts(name,starts_on,ends_on,status,course_ids,notes,created_by) SELECT $1,$2,$3,$4,$5,$6,$7 WHERE (SELECT count(*) FROM time_learning.cohorts)<200 ON CONFLICT(name) DO NOTHING RETURNING id`,[...input,identity]);if(!r.rows[0])throw new HttpError(409,'Choose a unique cohort name. This workspace supports up to 200 managed cohorts.');await audit('cohort.create',r.rows[0].id);return json({cohort:r.rows[0]},201);
 }
 const match=path.match(/^\/admin\/cohorts\/([^/]+)(\/candidates|\/assign)?$/);
 if(match){
  const id=requireUUID(match[1]),cohort=(await query('SELECT * FROM time_learning.cohorts WHERE id=$1',[id])).rows[0];if(!cohort)throw new HttpError(404,'Cohort not found.');
  if(!match[2]&&request.method==='PUT'){
   const input=cohortInput(await body());const r=await query(`WITH changed AS (UPDATE time_learning.cohorts SET name=$2,starts_on=$3,ends_on=$4,status=$5,course_ids=$6,notes=$7,updated_at=now() WHERE id=$1 AND NOT EXISTS(SELECT 1 FROM time_learning.cohorts other WHERE other.name=$2 AND other.id<>$1) RETURNING id,name), synced AS (UPDATE time_learning.enrollments e SET cohort=c.name FROM changed c WHERE e.cohort_id=c.id RETURNING e.user_id) SELECT id FROM changed`,[id,...input]);if(!r.rows[0])throw new HttpError(409,'A cohort with this name already exists.');await audit('cohort.update',id);return json({ok:true});
  }
  if(match[2]==='/candidates'&&request.method==='GET'){
   const search=(url.searchParams.get('search')||'').trim().slice(0,100),offset=offsetOf(url);
   const r=await query(`SELECT u.id AS user_id,u.name,u.email,ARRAY(SELECT e.course_id FROM time_learning.enrollments e WHERE e.user_id=u.id AND e.cohort_id=$1) AS cohort_courses,count(*) OVER()::int AS total FROM neon_auth."user" u JOIN time_learning.members m ON m.user_id=u.id WHERE m.role='student' AND NOT m.suspended AND u."emailVerified" AND NOT coalesce(u.banned,false) AND ($2='' OR u.name ILIKE '%'||$2||'%' OR u.email ILIKE '%'||$2||'%') ORDER BY u.name,u.id LIMIT 50 OFFSET $3`,[id,search,offset]);return json({students:r.rows,total:r.rows[0]?.total||0,offset});
  }
  if(match[2]==='/assign'&&request.method==='POST'){
   if(cohort.status==='archived'||cohort.status==='completed')throw new HttpError(409,'Open a planned or active cohort to assign students.');
   const b=await body();if(!Array.isArray(b.studentIds)||!b.studentIds.length||b.studentIds.length>50||new Set(b.studentIds).size!==b.studentIds.length)throw new HttpError(400,'Select between 1 and 50 different students.');b.studentIds.forEach(requireUUID);if(!['approved','pending'].includes(b.status))throw new HttpError(400,'Choose approved or pending enrolment.');
   const r=await query(`WITH eligible AS (SELECT m.user_id FROM time_learning.members m JOIN neon_auth."user" u ON u.id=m.user_id WHERE m.user_id=ANY($1::uuid[]) AND m.role='student' AND NOT m.suspended AND u."emailVerified" AND NOT coalesce(u.banned,false)), chosen AS (SELECT c.* FROM time_learning.cohorts c WHERE c.id=$2 AND c.status IN('planned','active')), applied AS (INSERT INTO time_learning.enrollments(user_id,course_id,status,cohort,cohort_id) SELECT e.user_id,course,$3::text,c.name,c.id FROM eligible e CROSS JOIN chosen c CROSS JOIN unnest(c.course_ids) AS course WHERE (SELECT count(*) FROM eligible)=cardinality($1::uuid[]) ON CONFLICT(user_id,course_id) DO UPDATE SET status=excluded.status,cohort=excluded.cohort,cohort_id=excluded.cohort_id RETURNING user_id) SELECT count(*)::int AS assigned FROM applied`,[b.studentIds,id,b.status]);
   const assigned=r.rows[0]?.assigned||0;if(!assigned)throw new HttpError(409,'No changes were made. Refresh and select only active, verified students and an open cohort.');await audit('cohort.assign.'+b.status,id+':'+b.studentIds.join(','));return json({ok:true,assigned});
  }
 }
 throw new HttpError(404,'This administrator action is not available.');
}
