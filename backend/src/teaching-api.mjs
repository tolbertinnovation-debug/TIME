import {contentAudience,keepAudience} from './catalogue-api.mjs';
import {HttpError,requireCourse,requireUUID,text,checkFile,courseIds} from './policy.mjs';
export function cleanResources(value){
 if(!Array.isArray(value)||value.length>10)throw new HttpError(400,'Add no more than 10 resource links.');
 return value.map(r=>{if(!r||!['reading','pdf','slides','video'].includes(r.type))throw new HttpError(400,'Choose a resource type.');
  let url;try{url=new URL(text(r.url,1,1500,'Resource URL'));if(url.protocol!=='https:'||url.username||url.password)throw Error();}catch{throw new HttpError(400,'Resource links must use HTTPS without embedded credentials.');}
  return {title:text(r.title,1,120,'Resource title'),type:r.type,url:url.href};
 });
}
export async function handleTeaching({path,request,url,body,query,member,identity,teaching,teaches,courseIds:catalogueIds=courseIds,requireCourse:validateCourse=requireCourse,audit,json,headers}){
 if(!path.startsWith('/teaching/')&&path!=='/lessons'&&!path.startsWith('/lessons/'))return null;
 const staff=['admin','lecturer'].includes(member.role),scope=member.role==='admin'?[...catalogueIds]:teaching;
 const requireTeacher=course=>{validateCourse(course);if(!teaches(course))throw new HttpError(403,'You may manage only your assigned courses.');};
 const canStudy=async (course,cohort=null)=>staff?teaches(course):(await query("SELECT 1 FROM time_learning.enrollments WHERE user_id=$1 AND course_id=$2 AND status='approved' AND ($3::uuid IS NULL OR cohort_id=$3)",[identity,course,cohort])).rows.length>0;
 if(path.startsWith('/teaching/')&&!staff)throw new HttpError(403,'Lecturer access is required.');
 if(path==='/teaching/overview'&&request.method==='GET'){
  const r=await query(`SELECT c.course_id,
   (SELECT count(*)::int FROM time_learning.enrollments e JOIN time_learning.members m ON m.user_id=e.user_id JOIN neon_auth."user" u ON u.id=e.user_id WHERE e.course_id=c.course_id AND e.status='approved' AND m.role='student' AND NOT m.suspended AND NOT coalesce(u.banned,false)) AS students,
   (SELECT count(*)::int FROM time_learning.submissions s JOIN time_learning.assignments a ON a.id=s.assignment_id WHERE a.course_id=c.course_id AND s.graded_at IS NULL) AS ungraded,
   (SELECT count(*)::int FROM time_learning.sessions s WHERE s.course_id=c.course_id AND starts_at>=now()) AS upcoming_classes,
   (SELECT count(*)::int FROM time_learning.lessons l WHERE l.course_id=c.course_id AND l.published) AS published_lessons,
   (SELECT count(*)::int FROM time_learning.lessons l WHERE l.course_id=c.course_id AND NOT l.published) AS draft_lessons
   FROM unnest($1::text[]) AS c(course_id) ORDER BY c.course_id`,[scope]);return json({courses:r.rows});
 }
 if(path==='/teaching/students'&&request.method==='GET'){
  const course=url.searchParams.get('courseId');requireTeacher(course);
  const search=(url.searchParams.get('search')||'').trim().slice(0,100),offset=Math.max(0,Math.min(100000,Math.floor(Number(url.searchParams.get('offset'))||0)));
  const r=await query(`SELECT u.id AS user_id,u.name,u.email,e.cohort,e.joined_at,count(*) OVER()::int AS total
   FROM time_learning.enrollments e JOIN time_learning.members m ON m.user_id=e.user_id JOIN neon_auth."user" u ON u.id=e.user_id
   WHERE e.course_id=$1 AND e.status='approved' AND m.role='student' AND NOT m.suspended AND NOT coalesce(u.banned,false)
   AND ($2='' OR u.name ILIKE '%'||$2||'%' OR u.email ILIKE '%'||$2||'%' OR e.cohort ILIKE '%'||$2||'%') ORDER BY u.name,u.id LIMIT 50 OFFSET $3`,[course,search,offset]);return json({students:r.rows,total:r.rows[0]?.total||0,offset});
 }
 if(path==='/lessons'&&request.method==='GET'){
  const course=url.searchParams.get('courseId');validateCourse(course);if(!await canStudy(course))throw new HttpError(403,'Approved course enrolment is required.');
  const r=await query(`SELECT id,course_id,title,published,file_name,created_at,updated_at,cohort_id FROM time_learning.lessons l WHERE course_id=$1 AND ($2::boolean OR (published AND EXISTS(SELECT 1 FROM time_learning.enrollments e WHERE e.user_id=$3 AND e.course_id=l.course_id AND e.status='approved' AND (l.cohort_id IS NULL OR l.cohort_id=e.cohort_id)))) ORDER BY created_at DESC LIMIT 200`,[course,teaches(course),identity]);return json({lessons:r.rows});
 }
 if(path==='/lessons'&&request.method==='POST'){
  const b=await body();requireTeacher(b.courseId);const cohort=await contentAudience(query,b.courseId,b.cohortId);const resources=cleanResources(b.resources||[]),file=checkFile(b.fileName,b.fileType,b.fileData);
  const r=await query(`INSERT INTO time_learning.lessons(course_id,title,content,resources,published,file_name,file_type,file_data,created_by,cohort_id) VALUES($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10) RETURNING id`,[b.courseId,text(b.title,1,160,'Lesson title'),text(b.content,1,40000,'Lesson content'),JSON.stringify(resources),b.published===true,file?.name||null,file?.type||null,file?.bytes||null,identity,cohort]);await audit('lesson.create',r.rows[0].id);return json({lesson:r.rows[0]},201);
 }
 const match=path.match(/^\/lessons\/([^/]+)(\/file)?$/);
 if(match){
  const id=requireUUID(match[1]),lesson=(await query('SELECT * FROM time_learning.lessons WHERE id=$1',[id])).rows[0];
  if(!lesson||(!teaches(lesson.course_id)&&(!lesson.published||!await canStudy(lesson.course_id,lesson.cohort_id||null))))throw new HttpError(404,'Lesson not found.');
  if(request.method==='GET'&&match[2]==='/file'){
   if(!lesson.file_data)throw new HttpError(404,'No file is attached.');return new Response(lesson.file_data,{headers:{...headers,'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="'+lesson.file_name.replace(/[^a-zA-Z0-9._ -]/g,'_')+'"','Content-Security-Policy':"sandbox; default-src 'none'"}});
  }
  if(request.method==='GET'&&!match[2]){const {file_data,...safe}=lesson;return json({lesson:safe});}
  if(request.method==='PUT'&&!match[2]){
   requireTeacher(lesson.course_id);const b=await body();keepAudience(b,lesson);const resources=cleanResources(b.resources||[]),file=checkFile(b.fileName,b.fileType,b.fileData);
   if(file&&b.removeFile)throw new HttpError(400,'Choose either a new file or remove the attachment.');
   await query(`UPDATE time_learning.lessons SET title=$2,content=$3,resources=$4::jsonb,published=$5,file_name=$6,file_type=$7,file_data=$8,updated_at=now() WHERE id=$1`,[id,text(b.title,1,160,'Lesson title'),text(b.content,1,40000,'Lesson content'),JSON.stringify(resources),b.published===true,file?.name||(b.removeFile?null:lesson.file_name),file?.type||(b.removeFile?null:lesson.file_type),file?.bytes||(b.removeFile?null:lesson.file_data)]);await audit('lesson.update',id);return json({ok:true});
  }
 }
 throw new HttpError(404,'This teaching action is not available.');
}
