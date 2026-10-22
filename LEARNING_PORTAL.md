# TIME Learning

## Public study portal
`learning.html` provides eight courses, 48 draft study guides and practice questions, browser notes/progress, guide downloads, assignment draft preparation, and backup/restore. The teaching materials and proposed ten-week calendar still require lecturer approval.

## Connected account workspace
`account.html` uses managed Neon Auth and a Neon Function backend. New accounts are students and must verify email. Joined courses expose lecturer-published tasks and sessions. Students can submit private text with an optional PDF or TXT attachment (2 MB per file, 20 MB total per account), view receipts, scores, and feedback. Lecturers can work only with assigned courses; administrators can assign lecturers. Scoring is 0–100; criteria belong in the published assignment. Graded work cannot be replaced by a student.

The account workspace supports manually saving a private snapshot of browser study notes/progress and downloading it on another device. It does not automatically merge browser work or claim that practice progress is an official grade.

## Infrastructure
- Project: `weathered-forest-48081271` (`time-learning`), AWS Frankfurt.
- Production branch: `br-weathered-silence-ba91dn4v`.
- Isolated development branch: `br-dark-tree-baypad1n`.
- Function slug: `learning`.
- Production API: `https://br-weathered-silence-ba91dn4v-learning.compute.c-8.eu-central-1.aws.neon.tech/`.
- Static frontend: existing TIME GitHub Pages website.
- Vercel creation was denied by that connection, so no Vercel project is used.

Only public service URLs are in the browser. Database credentials are injected into the Function by Neon and never sent to clients.

## Authorization and data
The API verifies the Managed Auth JWT signature, issuer, and expiry, then checks the current user record and verified email. Browser-supplied roles and owner IDs cannot grant access. All SQL uses parameters. The service enforces ownership and course assignments for submissions and attachment downloads. JSON responses never contain attachment bytes. Records live in `time_learning`; `PUBLIC` receives no schema/table privileges. No browser-facing database client or Data API is used.

CORS permits the existing GitHub Pages origin. JWT authentication is still required independent of CORS. Verified users have a shared-store limit of 120 requests/minute. This application-level quota is not an edge WAF or DDoS filter. Auth sessions and short-lived issued JWTs follow Neon’s lifecycle; sign-out does not promise immediate revocation of a previously issued JWT.

## Staff activation
No first-user administrator shortcut exists. Before granting the first administrator, obtain the owner-confirmed email address, have the owner register and verify that exact email, and resolve the verified identity through the account service. Grant the application role in `time_learning.members` by that verified UUID through the trusted database administration connection. Do not grant access from a public form or an unverified email. Existing administrators can assign lecturers to courses in the staff workspace; there is no self-service staff promotion.

## Teaching and scheduling
TIME staff must publish real assignments, due dates, rubrics, meeting links, and campus venues. The portal does not create Zoom/Meet rooms. All scheduling inputs and displays use Africa/Monrovia (UTC). Automatic attendance, automatic completion certificates, payment verification, and video hosting are not implemented.

## Building and testing
Run `npm ci` in `backend/`, then `npm test` and `npm run build`. The build bundles the Function into `backend/build/index.mjs` and the Managed Auth client/UI into `assets/learning/account.bundle.js`. Commit the browser bundle with its source changes. Package `index.mjs` at the root of the Function deployment ZIP. The runtime is Node.js 24. Test new migrations on development before production.

`backend/test/security.test.mjs` covers authentication rejection, email verification, ownership boundaries, course-scoped staff access, self-promotion denial, grading rules, file validation, CORS, and backup validation. Development fixtures and credentials are not part of the repository or production database.

## Operational next steps
Set up production-branded SMTP and verify real email-code delivery with TIME before a cohort-wide launch. Cross-site cookie restrictions may affect browser sign-in; test on the students’ actual devices. Consider a same-site custom frontend/auth domain deployment when hosting permissions are available. Review data retention, storage usage, access logs, and backups for the expected cohort size. Uploads are private database attachments in this release, rather than an object-storage service or malware-scanned document system. Do not upload sensitive clinical records.

## Separate role portals

`account.html` is the workspace selector. `student-login.html` supports open student registration; `lecturer-login.html` supports registration for administrator approval and approved lecturer sign-in; `admin-login.html` offers sign-in only. Lecturer registrants retain the default student role until an administrator assigns teaching access. There is no public administrator promotion endpoint.

All portals use the same existing identity service. The selected page never changes a role: after verification, `/me` supplies the database role. A mismatched portal shows a link to the approved workspace. Staff tools appear first in lecturer/admin dashboards; lecturers see their assigned courses. API authorization remains independent of UI routing. Existing account links continue to work through the selector.

Email verification displays a persistent success screen after the authentication service accepts a code. Continue explicitly reloads the current session while bypassing the Neon SDK session cache and server cookie cache. Verification does not grant lecturer or administrator permissions. Invalid codes leave the verification form open with an error.

Signed-in screens hide all role login links. Opening `account.html` with a verified session routes to the database-approved workspace. Signed-out users retain the role selector. A wrong portal shows only the approved workspace link and sign-out controls; it never grants another role.

After successful student or lecturer registration, the verification page automatically requests an email-verification code once. It displays delivery-request status and a Resend code button. Normal reloads do not automatically send another email. While a request is in flight, the button is disabled. Failed delivery requests preserve the created account and show retry instructions. Only the most recent code should be used.

Account requests now share a loading indicator across sign-in, verification, course requests, saves, grading, lecturer access, snapshots, and attachment downloads. Concurrent requests keep the indicator visible until all finish, including errors. Grading and lecturer access screens also show the branded loading view while fetching. Portal links carry a release version to refresh cached entry pages.

## Administrator management release

Migration `002_admin_management.sql` adds reversible member suspension, active teaching assignments, and enrolment status/cohort fields. Existing enrolments default to approved and teaching assignments default to active. New student requests are pending until an administrator approves them. Published assignments, meeting details, and submission writes require approved enrolment. Previously submitted work remains available to its owner.

The administrator dashboard shows aggregate counts, searchable user records (50 per page), teaching approval/revocation, account suspension/restoration, and enrolment review with cohort assignment. Administrator accounts cannot be suspended through these controls; account deletion and administrator promotion are not exposed. Every access-management write is audited. Counts refresh with the workspace. Suspension blocks learning API access on the next request, while identity-provider sessions remain managed by the existing authentication service.

Validated: 58 automated tests, administrator SQL statements planned against the development database, development deployment, and mobile layout review with synthetic QA records. Real administrator sign-in and email delivery remain user-session checks.

## Lecturer teaching tools

Migration `003_lecturer_lessons.sql` adds a private lessons table. Lecturer overview totals cover active teaching assignments only. Course student lists include approved, active student accounts with name, email, cohort, and joining date; search and pagination are scoped to an assigned course.

Lecturers and administrators can create, edit, publish, or unpublish lessons. Lessons support plain text (40,000 characters), up to 10 HTTPS resource links (reading, PDF, slides, video), and one PDF/text attachment up to 2 MB. Editing keeps an existing attachment unless explicitly replaced or removed. Slides and video are external links, not uploaded/hosted media. Drafts are visible to authorized staff only. Students open published lessons from the Lecturer lessons button on an approved course card. Authenticated attachment downloads require the same course access as the lesson. Existing public study guides remain separate.

Validation: 70 automated checks, real SQL planning on the development database, development Function deployment, and mobile/dashboard/editor visual review with synthetic preview data. Production authenticated user interaction remains a user-session check.

## Student dashboard, calendar, and announcements

Students now have an overview of approved courses, pending enrolments, assignments still to submit, upcoming classes, and recent grades/feedback. A monthly calendar combines their published assignment deadlines and authorized class dates, with course/date filters and an agenda. Times use Africa/Monrovia. Calendar events come from existing private assignment/session responses; it does not create dates or sync external calendars.

Migration `004_course_announcements.sql` adds private course notices. Assigned lecturers and administrators can draft, publish, edit, and unpublish announcements. Students see published notices only for approved course enrolments, including recent notices on their dashboard. Notices appear inside the application and are refreshed with the workspace; no email, push, or background notification delivery is implemented.

Validation: 79 automated checks covering role/course boundaries, drafts, calendar month/leap dates, submission status, and dashboard controls; real SQL planning on the development database; development deployment; mobile dashboard and calendar visual review with synthetic preview records. Production authenticated interaction remains a user-session check.

## Manual class attendance

Migration `005_class_attendance.sql` adds private attendance records for existing online and in-person sessions. Assigned lecturers and administrators can view the approved, active student roster and record Present, Late, Absent, or Excused after the class starts. Notes are visible to the student. Corrections are audited; Not recorded clears the displayed mark while preserving the row and audit events. Joining a meeting does not mark attendance, and an unrecorded student is never automatically absent.

Students have a My attendance view containing only their own records (up to the most recent 200), with status totals and staff notes. There is no automatic attendance percentage, certificate eligibility policy, or meeting-provider tracking. Rosters are paginated at 50 students.

Validation: 87 automated checks, including own-record privacy, assigned-course scope, approved active rosters, future class restrictions, invalid input, and audited corrections; attendance SQL planned against the development database; development Function deployment; mobile roster and personal attendance visual review with synthetic data. Real authenticated production interaction remains a user-session check.
