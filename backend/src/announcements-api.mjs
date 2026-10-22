import {HttpError,requireCourse,requireUUID,text,courseIds} from './policy.mjs';
export async function handleAnnouncements({path,request,url,body,query,member,identity,teaching,teaches,audit,json}){
 if(path!=='/announcements'&&!path.startsWith('/announcements/'))return null;
 if(request.method!=='GET'&&!['admin','lecturer'].includes(member.role))throw new HttpError(403,'Lecturer access is required.');
 const scope=member.role==='admin'?[...courseIds]:member.role==='lecturer'?teaching:null;
 if(path==='/announcements'&&request.method==='GET'){
  const course=url.searchParams.get('courseId');if(course)requireCourse(course);
  const r=await query(`SELECT a.id,a.course_id,a.title,a.content,a.published,a.created_at,a.updated_at FROM time_learning.announcements a
   WHERE ($1::text IS NULL OR a.course_id=$1) AND
   (a.course_id=ANY($2::text[]) OR (a.published AND $3='student' AND EXISTS(SELECT 1 FROM time_learning.enrollments e WHERE e.user_id=$4 AND e.course_id=a.course_id AND e.status='approved')))
   ORDER BY a.updated_at DESC LIMIT 200`,[course||null,scope||[],member.role,identity]);return json({announcements:r.rows});
 }
 if(path==='/announcements'&&request.method==='POST'){
  const b=await body();requireCourse(b.courseId);if(!teaches(b.courseId))throw new HttpError(403,'Only assigned course staff can publish announcements.');
  const r=await query(`INSERT INTO time_learning.announcements(course_id,title,content,published,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id`,[b.courseId,text(b.title,1,160,'Announcement title'),text(b.content,1,8000,'Announcement text'),b.published===true,identity]);await audit('announcement.create',r.rows[0].id);return json({announcement:r.rows[0]},201);
 }
 const match=path.match(/^\/announcements\/([^/]+)$/);
 if(match&&request.method==='PUT'){
  const id=requireUUID(match[1]),a=(await query('SELECT course_id FROM time_learning.announcements WHERE id=$1',[id])).rows[0];if(!a)throw new HttpError(404,'Announcement not found.');if(!teaches(a.course_id))throw new HttpError(403,'Only assigned course staff can change announcements.');
  const b=await body();await query('UPDATE time_learning.announcements SET title=$2,content=$3,published=$4,updated_at=now() WHERE id=$1',[id,text(b.title,1,160,'Announcement title'),text(b.content,1,8000,'Announcement text'),b.published===true]);await audit('announcement.update',id);return json({ok:true});
 }
 throw new HttpError(404,'This announcement action is not available.');
}
