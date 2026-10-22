import {HttpError,requireUUID,text} from './policy.mjs';
export const attendanceStatuses=['unrecorded','present','late','absent','excused'];
export async function handleAttendance({path,request,url,body,query,member,identity,teaches,audit,json}){
 if(!path.startsWith('/attendance/'))return null;
 if(path==='/attendance/my'&&request.method==='GET'){
  const r=await query(`SELECT a.session_id,a.status,a.note,a.updated_at,s.title,s.course_id,s.starts_at,s.mode FROM time_learning.attendance a JOIN time_learning.sessions s ON s.id=a.session_id WHERE a.student_id=$1 AND a.status<>'unrecorded' ORDER BY s.starts_at DESC LIMIT 200`,[identity]);return json({attendance:r.rows});
 }
 if(!['admin','lecturer'].includes(member.role))throw new HttpError(403,'Only course staff can manage attendance.');
 const match=path.match(/^\/attendance\/sessions\/([^/]+)$/);
 if(match){
  const id=requireUUID(match[1]),session=(await query('SELECT id,course_id,title,starts_at,mode FROM time_learning.sessions WHERE id=$1',[id])).rows[0];
  if(!session||!teaches(session.course_id))throw new HttpError(404,'Class not found in your assigned courses.');
  if(request.method==='GET'){
   const offset=Math.max(0,Math.min(100000,Math.floor(Number(url.searchParams.get('offset'))||0)));
   const r=await query(`SELECT u.id AS student_id,u.name,u.email,e.cohort,coalesce(a.status,'unrecorded') AS status,coalesce(a.note,'') AS note,a.updated_at,count(*) OVER()::int AS total
    FROM time_learning.enrollments e JOIN time_learning.members m ON m.user_id=e.user_id JOIN neon_auth."user" u ON u.id=e.user_id
    LEFT JOIN time_learning.attendance a ON a.student_id=e.user_id AND a.session_id=$1
    WHERE e.course_id=$2 AND e.status='approved' AND m.role='student' AND NOT m.suspended AND NOT coalesce(u.banned,false)
    ORDER BY u.name,u.id LIMIT 50 OFFSET $3`,[id,session.course_id,offset]);return json({session,students:r.rows,total:r.rows[0]?.total||0,offset});
  }
  if(request.method==='PUT'){
   if(Date.parse(session.starts_at)>Date.now())throw new HttpError(409,'Attendance can be recorded after the class starts.');
   const b=await body();requireUUID(b.studentId);if(b.studentId===identity)throw new HttpError(403,'You cannot record your own attendance.');
   if(!attendanceStatuses.includes(b.status))throw new HttpError(400,'Choose a valid attendance status.');
   const target=(await query(`SELECT e.user_id FROM time_learning.enrollments e JOIN time_learning.members m ON m.user_id=e.user_id JOIN neon_auth."user" u ON u.id=e.user_id WHERE e.user_id=$1 AND e.course_id=$2 AND e.status='approved' AND m.role='student' AND NOT m.suspended AND NOT coalesce(u.banned,false)`,[b.studentId,session.course_id])).rows[0];if(!target)throw new HttpError(400,'Attendance requires an active student approved for this course.');
   await query(`INSERT INTO time_learning.attendance(session_id,student_id,status,note,recorded_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(session_id,student_id) DO UPDATE SET status=excluded.status,note=excluded.note,recorded_by=excluded.recorded_by,updated_at=now()`,[id,b.studentId,b.status,text(b.note||'',0,1000,'Student-visible note'),identity]);await audit('attendance.'+b.status,id+':'+b.studentId);return json({ok:true});
  }
 }
 throw new HttpError(404,'This attendance action is not available.');
}
