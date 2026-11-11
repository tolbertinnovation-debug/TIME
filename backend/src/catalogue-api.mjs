import {HttpError,text,requireUUID} from './policy.mjs';
export function courseInput(b,creating=false){
 if(!b||typeof b!=='object')throw new HttpError(400,'Enter course details.');
 if(creating&&(typeof b.id!=='string'||!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(b.id)||b.id.length>64))throw new HttpError(400,'Use a unique course ID of lowercase letters, numbers, and hyphens, starting with a letter.');
 if(typeof b.archived!=='boolean')throw new HttpError(400,'Choose active or archived.');
 return [text(b.code,1,12,'Course code'),text(b.title,1,160,'Course title'),text(b.lecturer||'',0,160,'Lecturer display name'),text(b.description||'',0,2000,'Description'),b.archived];
}
export async function contentAudience(query,courseId,cohortId){
 if(cohortId==null||cohortId==='')return null;requireUUID(cohortId);
 const r=await query("SELECT id FROM time_learning.cohorts WHERE id=$1 AND $2=ANY(course_ids) AND status<>'archived'",[cohortId,courseId]);if(!r.rows[0])throw new HttpError(400,'Choose an available cohort that includes this course.');return cohortId;
}
export function keepAudience(body,record){if(Object.hasOwn(body,'cohortId')&&(body.cohortId||null)!==(record.cohort_id||null))throw new HttpError(409,'The audience is fixed when content is created. Create a separate item for another cohort.');}
export async function handleCatalogue({path,request,body,query,member,identity,teaching,catalogue,audit,json}){
 if(path==='/courses'&&request.method==='GET'){
  if(member.role!=='student')return json({courses:catalogue});
  const enrolled=(await query('SELECT course_id FROM time_learning.enrollments WHERE user_id=$1',[identity])).rows.map(e=>e.course_id);return json({courses:catalogue.filter(c=>!c.archived||enrolled.includes(c.id))});
 }
 if(path==='/content/cohorts'&&request.method==='GET'){
  if(!['admin','lecturer'].includes(member.role))throw new HttpError(403,'Lecturer access is required.');
  const scope=member.role==='admin'?catalogue.map(c=>c.id):teaching;
  const r=await query(`SELECT id,name,status,course_ids FROM time_learning.cohorts WHERE course_ids && $1::text[] ORDER BY name LIMIT 200`,[scope]);return json({cohorts:r.rows});
 }
 if(!/^\/admin\/courses(\/|$)/.test(path))return null;
 if(member.role!=='admin')throw new HttpError(403,'Administrator access is required.');
 if(path==='/admin/courses'&&request.method==='GET')return json({courses:catalogue});
 if(path==='/admin/courses'&&request.method==='POST'){
  const b=await body(),input=courseInput(b,true);const r=await query(`INSERT INTO time_learning.courses(id,code,title,lecturer,description,archived) SELECT $1,$2,$3,$4,$5,$6 WHERE (SELECT count(*) FROM time_learning.courses)<500 ON CONFLICT(id) DO NOTHING RETURNING id`,[b.id,...input]);if(!r.rows[0])throw new HttpError(409,'Choose a unique course ID. The catalogue supports up to 500 courses.');await audit('course.create',b.id);return json({course:r.rows[0]},201);
 }
 const match=path.match(/^\/admin\/courses\/([a-z0-9-]+)$/);
 if(match&&request.method==='PUT'){
  const b=await body(),input=courseInput(b);const r=await query(`UPDATE time_learning.courses SET code=$2,title=$3,lecturer=$4,description=$5,archived=$6,updated_at=now() WHERE id=$1 RETURNING id`,[match[1],...input]);if(!r.rows[0])throw new HttpError(404,'Course not found.');await audit('course.update',match[1]);return json({ok:true});
 }
 throw new HttpError(404,'This course action is not available.');
}
