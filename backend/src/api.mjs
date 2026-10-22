import {handleAdmin} from './admin-api.mjs';
import {HttpError,requireCourse,requireUUID,text,canTeach,canReadSubmission,validDate,checkFile,cleanWorkspace} from './policy.mjs';
const ORIGIN='https://tolbertinnovation-debug.github.io';
const MAX=2900000;
export function createHandler({query,verify,allowedOrigins=[ORIGIN]}){
 return {async fetch(request){
  const origin=request.headers.get('origin');
  const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  if(origin&&allowedOrigins.includes(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, PUT, OPTIONS'});
  const json=(body,status=200,extra={})=>Response.json(body,{status,headers:{...headers,...extra}});
  try{
   if(origin&&!allowedOrigins.includes(origin))throw new HttpError(403,'This origin is not permitted.');
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
   const url=new URL(request.url),path=url.pathname;
   if(path==='/health'&&request.method==='GET')return json({service:'TIME Learning',status:'ready',version:3});
   const authorization=request.headers.get('authorization');
   if(!authorization?.startsWith('Bearer '))throw new HttpError(401,'Sign in to continue.');
   let identity;try{identity=await verify(authorization.slice(7));requireUUID(identity);}catch{throw new HttpError(401,'Your session has expired. Sign in again.');}
   const users=await query('SELECT id, name, email, "emailVerified", banned FROM neon_auth."user" WHERE id=$1',[identity]);
   const user=users.rows[0];if(!user||user.banned)throw new HttpError(401,'This account is unavailable.');
   if(!user.emailVerified)throw new HttpError(403,'Verify your email address before opening the student workspace.');
   const quota=await query('INSERT INTO time_learning.quotas(user_id,minute,requests) VALUES($1,date_trunc(\'minute\',now()),1) ON CONFLICT(user_id,minute) DO UPDATE SET requests=time_learning.quotas.requests+1 RETURNING requests',[identity]);
   if(quota.rows[0].requests>120)return json({error:'Too many requests. Please try again in a minute.'},429,{'Retry-After':'60'});
   await query('INSERT INTO time_learning.members(user_id) VALUES($1) ON CONFLICT DO NOTHING',[identity]);
   const member=(await query('SELECT user_id, role, suspended FROM time_learning.members WHERE user_id=$1',[identity])).rows[0];
   if(member.suspended)throw new HttpError(403,'Your learning account is suspended. Contact TIME.');
   const teaching=(await query('SELECT course_id FROM time_learning.teaching WHERE user_id=$1 AND active',[identity])).rows.map(x=>x.course_id);
   const teaches=course=>canTeach(member,course,teaching);
   const requireTeacher=course=>{if(!teaches(course))throw new HttpError(403,'Lecturer access to this course is required.');};
   const audit=async(action,id)=>query('INSERT INTO time_learning.audit(actor,action,resource_id) VALUES($1,$2,$3)',[identity,action,id]);
   const body=async()=>{
    if(!request.headers.get('content-type')?.startsWith('application/json'))throw new HttpError(415,'Send JSON data.');
    if(Number(request.headers.get('content-length'))>MAX)throw new HttpError(413,'Request is too large.');
    const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Request data is missing.');let bytes=0,chunks=[];
    while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX){await reader.cancel();throw new HttpError(413,'Request is too large.');}chunks.push(value);}
    try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw new HttpError(400,'Request data is not valid JSON.');}
   };
   const adminResponse=await handleAdmin({path,request,url,body,query,member,identity,audit,json});if(adminResponse)return adminResponse;
   if(path==='/me'&&request.method==='GET'){
    const enrollments=(await query('SELECT course_id,joined_at,status,cohort FROM time_learning.enrollments WHERE user_id=$1 ORDER BY joined_at',[identity])).rows;
    return json({user:{id:user.id,name:user.name,email:user.email},role:member.role,teaching,enrollments});
   }
   if(path==='/enroll'&&request.method==='POST'){
    const b=await body();requireCourse(b.courseId);if(member.role!=='student')throw new HttpError(403,'Student access is required to request enrollment.');
    await query("INSERT INTO time_learning.enrollments(user_id,course_id,status) VALUES($1,$2,'pending') ON CONFLICT(user_id,course_id) DO UPDATE SET status='pending' WHERE time_learning.enrollments.status='declined'",[identity,b.courseId]);await audit('course.request',b.courseId);return json({ok:true});
   }
   if(path==='/workspace'&&request.method==='GET'){
    const r=await query('SELECT data,updated_at FROM time_learning.workspace WHERE user_id=$1',[identity]);return json(r.rows[0]||{data:null});
   }
   if(path==='/workspace'&&request.method==='PUT'){
    const data=cleanWorkspace(await body());
    await query('INSERT INTO time_learning.workspace(user_id,data) VALUES($1,$2::jsonb) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=now()',[identity,JSON.stringify(data)]);return json({ok:true});
   }
   if(path==='/assignments'&&request.method==='GET'){
    const rows=await query(`SELECT a.id,a.course_id,a.title,a.instructions,a.due_at,a.published,a.created_at,s.id AS submission_id,s.submitted_at,s.updated_at,s.score,s.feedback,s.graded_at,s.file_name
     FROM time_learning.assignments a LEFT JOIN time_learning.submissions s ON s.assignment_id=a.id AND s.student_id=$1
     WHERE ($2='admin' OR a.course_id=ANY($3::text[]) OR (a.published AND EXISTS(SELECT 1 FROM time_learning.enrollments e WHERE e.user_id=$1 AND e.course_id=a.course_id AND e.status='approved'))) ORDER BY a.created_at DESC LIMIT 200`,[identity,member.role,member.role==='lecturer'?teaching:[]]);return json({assignments:rows.rows});
   }
   if(path==='/assignments'&&request.method==='POST'){
    const b=await body();requireCourse(b.courseId);requireTeacher(b.courseId);
    const r=await query('INSERT INTO time_learning.assignments(course_id,title,instructions,due_at,published,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[b.courseId,text(b.title,1,160,'Title'),text(b.instructions,1,12000,'Instructions'),validDate(b.dueAt),b.published===true,identity]);await audit('assignment.create',r.rows[0].id);return json({assignment:r.rows[0]},201);
   }
   const assignmentMatch=path.match(/^\/assignments\/([^/]+)$/);
   if(assignmentMatch&&request.method==='PUT'){
    const id=requireUUID(assignmentMatch[1]);const a=(await query('SELECT course_id FROM time_learning.assignments WHERE id=$1',[id])).rows[0];if(!a)throw new HttpError(404,'Assignment not found.');requireTeacher(a.course_id);
    const b=await body();await query('UPDATE time_learning.assignments SET title=$2,instructions=$3,due_at=$4,published=$5 WHERE id=$1',[id,text(b.title,1,160,'Title'),text(b.instructions,1,12000,'Instructions'),validDate(b.dueAt),b.published===true]);await audit('assignment.update',id);return json({ok:true});
   }
   const submitMatch=path.match(/^\/assignments\/([^/]+)\/submit$/);
   if(submitMatch&&request.method==='POST'){
    const id=requireUUID(submitMatch[1]);
    const a=(await query(`SELECT a.* FROM time_learning.assignments a JOIN time_learning.enrollments e ON e.course_id=a.course_id AND e.user_id=$2 AND e.status='approved' WHERE a.id=$1 AND a.published`,[id,identity])).rows[0];
    if(!a)throw new HttpError(404,'Assignment is not available in your joined courses.');
    if(a.due_at&&Date.now()>new Date(a.due_at).getTime())throw new HttpError(409,'The submission deadline has passed. Contact your lecturer.');
    const existing=(await query('SELECT id,graded_at FROM time_learning.submissions WHERE assignment_id=$1 AND student_id=$2',[id,identity])).rows[0];if(existing?.graded_at)throw new HttpError(409,'This submission has been graded. Contact your lecturer before changing it.');
    const b=await body(),content=text(b.body||'',0,30000,'Submission'),file=checkFile(b.fileName,b.fileType,b.fileData);
    if(!content&&!file)throw new HttpError(400,'Write your answer or attach a PDF/text file.');
    if(file){const usage=(await query('SELECT coalesce(sum(octet_length(file_data)),0)::integer AS bytes FROM time_learning.submissions WHERE student_id=$1 AND assignment_id<>$2',[identity,id])).rows[0];if(Number(usage.bytes)+file.bytes.length>20971520)throw new HttpError(413,'Your attachment allowance is 20 MB in total. Contact TIME for help.');}
    const r=await query(`INSERT INTO time_learning.submissions(assignment_id,student_id,body,file_name,file_type,file_data) VALUES($1,$2,$3,$4,$5,$6)
     ON CONFLICT(assignment_id,student_id) DO UPDATE SET body=excluded.body,file_name=excluded.file_name,file_type=excluded.file_type,file_data=excluded.file_data,updated_at=now()
     WHERE time_learning.submissions.graded_at IS NULL RETURNING id,submitted_at,updated_at`,[id,identity,content,file?.name||null,file?.type||null,file?.bytes||null]);
    if(!r.rows[0])throw new HttpError(409,'This submission has been graded.');await audit('submission.save',r.rows[0].id);return json({submission:r.rows[0]},201);
   }
   if(path==='/submissions'&&request.method==='GET'){
    if(!['admin','lecturer'].includes(member.role))throw new HttpError(403,'Lecturer access is required.');
    const r=await query(`SELECT s.id,s.assignment_id,s.student_id,s.submitted_at,s.updated_at,s.score,s.feedback,s.graded_at,s.file_name,a.title,a.course_id,u.name AS student_name,u.email AS student_email
     FROM time_learning.submissions s JOIN time_learning.assignments a ON a.id=s.assignment_id JOIN neon_auth."user" u ON u.id=s.student_id
     WHERE $1='admin' OR a.course_id=ANY($2::text[]) ORDER BY s.updated_at DESC LIMIT 200`,[member.role,teaching]);return json({submissions:r.rows});
   }
   const submissionMatch=path.match(/^\/submissions\/([^/]+)(\/file|\/grade)?$/);
   if(submissionMatch){
    const id=requireUUID(submissionMatch[1]);
    const s=(await query('SELECT s.*,a.course_id,a.title FROM time_learning.submissions s JOIN time_learning.assignments a ON a.id=s.assignment_id WHERE s.id=$1',[id])).rows[0];
    if(!s||!canReadSubmission(member,s,teaching))throw new HttpError(404,'Submission not found.');
    if(request.method==='GET'&&submissionMatch[2]==='/file'){
     if(!s.file_data)throw new HttpError(404,'No file was attached.');
     return new Response(s.file_data,{headers:{...headers,'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="'+s.file_name.replace(/[^a-zA-Z0-9._ -]/g,'_')+'"','Content-Security-Policy':"sandbox; default-src 'none'"}});
    }
    if(request.method==='GET'&&!submissionMatch[2]){
     const {file_data,...safe}=s;return json({submission:safe});
    }
    if(request.method==='POST'&&submissionMatch[2]==='/grade'){
     requireTeacher(s.course_id);if(s.student_id===identity)throw new HttpError(403,'You cannot grade your own work.');
     const b=await body();if(typeof b.score!=='number'||!Number.isFinite(b.score)||b.score<0||b.score>100)throw new HttpError(400,'Score must be between 0 and 100.');
     await query('UPDATE time_learning.submissions SET score=$2,feedback=$3,graded_by=$4,graded_at=now() WHERE id=$1',[id,b.score,text(b.feedback||'',0,12000,'Feedback'),identity]);await audit('submission.grade',id);return json({ok:true});
    }
   }
   if(path==='/sessions'&&request.method==='GET'){
    const r=await query(`SELECT s.id,s.course_id,s.title,s.starts_at,s.mode,s.location FROM time_learning.sessions s
     WHERE $2='admin' OR s.course_id=ANY($3::text[]) OR EXISTS(SELECT 1 FROM time_learning.enrollments e WHERE e.user_id=$1 AND e.course_id=s.course_id AND e.status='approved') ORDER BY s.starts_at LIMIT 100`,[identity,member.role,member.role==='lecturer'?teaching:[]]);return json({sessions:r.rows});
   }
   if(path==='/sessions'&&request.method==='POST'){
    const b=await body();requireCourse(b.courseId);requireTeacher(b.courseId);if(!['online','in-person'].includes(b.mode))throw new HttpError(400,'Choose an online or in-person session.');
    const location=text(b.location,1,1000,'Meeting link or venue');if(b.mode==='online'){try{if(new URL(location).protocol!=='https:')throw Error();}catch{throw new HttpError(400,'Use a full HTTPS meeting link.');}}
    const r=await query('INSERT INTO time_learning.sessions(course_id,title,starts_at,mode,location,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[b.courseId,text(b.title,1,160,'Session title'),validDate(b.startsAt,true),b.mode,location,identity]);await audit('session.create',r.rows[0].id);return json({session:r.rows[0]},201);
   }
   if(path==='/staff'&&request.method==='GET'){
    if(member.role!=='admin')throw new HttpError(403,'Administrator access is required.');
    const r=await query(`SELECT m.user_id,m.role,u.name,u.email,coalesce(array_agg(t.course_id) FILTER(WHERE t.course_id IS NOT NULL),'{}') AS teaching FROM time_learning.members m JOIN neon_auth."user" u ON u.id=m.user_id LEFT JOIN time_learning.teaching t ON t.user_id=m.user_id AND t.active GROUP BY m.user_id,u.name,u.email ORDER BY m.created_at DESC LIMIT 200`);return json({members:r.rows});
   }
   if(path==='/staff/assign-course'&&request.method==='POST'){
    if(member.role!=='admin')throw new HttpError(403,'Administrator access is required.');
    const b=await body();requireUUID(b.userId);requireCourse(b.courseId);
    const target=(await query('SELECT m.role,m.suspended,u.banned,u."emailVerified" FROM time_learning.members m JOIN neon_auth."user" u ON u.id=m.user_id WHERE m.user_id=$1',[b.userId])).rows[0];
    if(!target||!target.emailVerified||target.suspended||target.banned)throw new HttpError(400,'The lecturer must sign in and verify their email first.');
    await query("UPDATE time_learning.members SET role='lecturer' WHERE user_id=$1 AND role='student'",[b.userId]);
    await query('INSERT INTO time_learning.teaching(user_id,course_id) VALUES($1,$2) ON CONFLICT(user_id,course_id) DO UPDATE SET active=true',[b.userId,b.courseId]);await audit('lecturer.assign',b.userId+':'+b.courseId);return json({ok:true});
   }
   throw new HttpError(404,'This action is not available.');
  }catch(error){if(!(error instanceof HttpError))console.error('TIME API request failed',error?.code||error?.name||'Error');return json({error:error instanceof HttpError?error.message:'The service is temporarily unavailable. Please retry.'},error.status||503);}
 }};
}
