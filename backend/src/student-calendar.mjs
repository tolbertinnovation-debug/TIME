export function calendarEvents(assignments,sessions,now=Date.now()){
 const events=[];
 for(const a of assignments){const at=Date.parse(a.due_at);if(!a.published||!Number.isFinite(at))continue;events.push({id:a.id,type:'assignment',courseId:a.course_id,title:a.title,at,status:a.graded_at?'Graded':a.submission_id?'Submitted':at<now?'Overdue':'To submit'});}
 for(const s of sessions){const at=Date.parse(s.starts_at);if(Number.isFinite(at))events.push({id:s.id,type:'class',courseId:s.course_id,title:s.title,at,status:s.mode==='online'?'Online class':'In-person class',location:s.location,mode:s.mode});}
 return events.sort((a,b)=>a.at-b.at||a.title.localeCompare(b.title));
}
export function calendarMonth(year,month){
 if(!Number.isInteger(year)||!Number.isInteger(month)||month<0||month>11||year<2000||year>2200)throw Error('Choose a valid calendar month.');
 const offset=(new Date(Date.UTC(year,month,1)).getUTCDay()+6)%7,days=new Date(Date.UTC(year,month+1,0)).getUTCDate();
 return {offset,days,keys:Array.from({length:days},(_,i)=>new Date(Date.UTC(year,month,i+1)).toISOString().slice(0,10))};
}
export function studentOverview(profile,assignments,sessions,now=Date.now()){
 const visible=assignments.filter(a=>a.published),pending=visible.filter(a=>!a.submission_id),futureClasses=sessions.filter(s=>Date.parse(s.starts_at)>=now);
 return {approved:profile.enrollments.filter(e=>!e.status||e.status==='approved').length,pendingEnrollments:profile.enrollments.filter(e=>e.status==='pending').length,toSubmit:pending.length,overdue:pending.filter(a=>a.due_at&&Date.parse(a.due_at)<now).length,upcomingClasses:futureClasses.length,graded:visible.filter(a=>a.graded_at).length};
}
