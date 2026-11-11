// These guides describe existing controls; all access decisions remain in the API.
export function workspaceGuide(role){
 const guides={
  admin:{title:'Prepare a course for teaching',steps:[
   ['Set up courses and cohorts','Open Manage courses to confirm the course details. In Manage cohorts, create the learning group and select its courses.'],
   ['Approve teaching access','Ask lecturers to register and verify their email. Use Assign lecturer access to grant each verified account only the courses it teaches. A lecturer name on a course card does not grant access.'],
   ['Approve student requests','Review Manage enrolments. Select the course and a matching managed cohort, then approve the request. Pending requests cannot open private course materials.'],
   ['Confirm materials are ready','Ask the assigned lecturer to publish lessons, assignments, and quizzes for the correct audience. Approval alone does not create teaching content.'],
   ['Support the class','Use reports, attendance, and Manage support requests to follow up on access problems and learning activity.']
  ]},
  lecturer:{title:'Prepare and teach your first week',steps:[
   ['Check your assigned courses','Your course list shows where you can teach. If a course is missing, ask TIME to approve your verified account for that course.'],
   ['Create the lesson','Open Lessons and materials, choose the course, and select Create lesson. Add text, a PDF or text attachment, or links to slides, readings, and videos. Set the week and lesson order.'],
   ['Choose who can learn','Select the matching cohort or shared course audience. Save a draft while preparing. Select Publish when the lesson is ready. Enable the earlier-lesson requirement when students must learn in sequence.'],
   ['Add practice and assessment','Open Quizzes and tests to create a multiple-choice quiz or timed test. Set the pass mark, attempt limit, and any completed-lesson prerequisite. Use Create assignment for written work or uploads, then publish it.'],
   ['Schedule and explain the week','Use Schedule a class for the date, online meeting link, or in-person venue. Use Course announcements to tell students what to complete and when.'],
   ['Review learning','Use Student results under Quizzes and tests, Student lesson progress, and Review submissions to check progress, grade written work, and give feedback.']
  ]}
 };
 const guide=guides[role];if(!guide)return '';
 return '<details class="panel workspace-guide"><summary>'+guide.title+'</summary><p class="small muted">Follow these steps using the controls in your workspace.</p><ol>'+guide.steps.map(([title,description])=>'<li><strong>'+title+'</strong><p class="small">'+description+'</p></li>').join('')+'</ol></details>';
}
export function courseLearningGuide(){return '<details class="panel workspace-guide"><summary>How to learn in this course</summary><ol><li><strong>Start with the current week.</strong><p class="small">Open an available lesson and study its text, attachment, and resource links. Locked lessons explain what you need to complete first.</p></li><li><strong>Record your lesson progress.</strong><p class="small">Select Mark lesson complete after studying. This saves your progress and can unlock later lessons or assessments.</p></li><li><strong>Take quizzes and tests.</strong><p class="small">Open Quizzes and tests. Read the instructions, deadline, and attempt limit before starting. A timed attempt keeps running if you leave. Check that your answers are saved, then select Submit for marking.</p></li><li><strong>Submit written assignments.</strong><p class="small">Open the assignment, read the instructions and due date, prepare your response or supported attachment, and submit it. Return to see the lecturer’s grade and feedback.</p></li><li><strong>Attend scheduled classes.</strong><p class="small">Check the course calendar. At the scheduled time, open the online meeting link or attend the listed venue. Class times use Liberia time.</p></li><li><strong>Review and ask for help.</strong><p class="small">Check My results, assignment feedback, and course announcements. Use Ask TIME for help if access or learning materials are missing.</p></li></ol></details>';}
