export const courseIds = new Set(['school-leadership','administrator-decisions','policy-strategy','project-management','research-skills','standard-english','drug-dispensing','health-care-management']);
export class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
export function requireCourse(id){if(!courseIds.has(id))throw new HttpError(400,'Unknown course.');return id;}
export function requireUUID(id){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id||''))throw new HttpError(400,'Invalid record ID.');return id;}
export function text(value,min,max,label){if(typeof value!=='string'||value.trim().length<min||value.length>max)throw new HttpError(400,`${label} must contain ${min}–${max} characters.`);return value.trim();}
export function canTeach(member,course,teaching){return member.role==='admin'||(member.role==='lecturer'&&teaching.includes(course));}
export function canReadSubmission(member,submission,teaching){return member.user_id===submission.student_id||canTeach(member,submission.course_id,teaching);}
export function validDate(value,required=false){if(!value&&!required)return null;if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw new HttpError(400,'Choose a valid date and time.');return new Date(value).toISOString();}
export function checkFile(name,type,data){
 if(!data)return null;
 if(typeof data!=='string'||data.length>2796204||!/^[A-Za-z0-9+/]*={0,2}$/.test(data))throw new HttpError(400,'Invalid file data.');
 const bytes=Buffer.from(data,'base64');if(bytes.length<1||bytes.length>2097152)throw new HttpError(400,'Files must be no larger than 2 MB.');
 const safe=text(name,1,160,'File name').replace(/[^a-zA-Z0-9._ -]/g,'_');
 if(type==='application/pdf'&&safe.toLowerCase().endsWith('.pdf')&&bytes.subarray(0,5).toString()==='%PDF-')return {name:safe,type,bytes};
 if(type==='text/plain'&&safe.toLowerCase().endsWith('.txt')&&!bytes.includes(0))return {name:safe,type,bytes};
 throw new HttpError(400,'Upload a valid PDF or plain-text file.');
}
export function cleanWorkspace(raw){
 if(!raw||raw.version!==1)throw new HttpError(400,'Choose a TIME Learning backup.');
 const out={version:1,lessons:{},notes:{},drafts:{},last:null};
 for(const c of courseIds){for(let i=0;i<6;i++){const k=c+':'+i;if(raw.lessons?.[k]===true)out.lessons[k]=true;if(typeof raw.notes?.[k]==='string')out.notes[k]=raw.notes[k].slice(0,12000);}if(typeof raw.drafts?.[c]==='string')out.drafts[c]=raw.drafts[c].slice(0,30000);}
 if(typeof raw.last==='string'&&/^[a-z-]+:[0-5]$/.test(raw.last)&&courseIds.has(raw.last.split(':')[0]))out.last=raw.last;
 if(Buffer.byteLength(JSON.stringify(out))>600000)throw new HttpError(413,'Workspace is larger than 600 KB. Download a local backup instead.');return out;
}
