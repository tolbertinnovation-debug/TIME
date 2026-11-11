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

## Administrator reports, managed cohorts, and activity history

Migration `006_admin_operations.sql` adds managed cohorts, optional enrolment links, and an audit-history index. Existing free-text cohort labels and enrolments are preserved. Administrators can create and edit up to 200 managed cohorts with optional dates, status, notes, and selected courses. A cohort roster links to its enrolment report. Eligible student selection is searchable and paginated at 50; each bulk assignment validates all selected students and applies course enrolments in one database statement. Only verified, active student accounts qualify. Completed or archived cohorts cannot receive new assignments.

Each student still has one enrolment per course. Assignment explicitly replaces the current cohort and enrolment status for selected courses, with a confirmation in the UI. Coursework, grades, and attendance remain intact. Editing a cohort's course list affects future assignments and does not revoke existing enrolments; date/status changes do not automatically expire course access. Renaming updates linked labels. Changing an individual enrolment to a different free-text cohort label unlinks it from its managed cohort. Cohorts organize enrolments; they do not isolate course content, classes, or historical assessment attempts between groups.

Admin-only student, enrolment, grade, and recorded-attendance reports have course/managed-cohort filters, 50-row previews, and authenticated CSV exports. Exports include all matching rows up to 5,000; larger results require narrower filters and are never silently truncated. UTF-8 CSV escapes quotes/delimiters and prefixes spreadsheet formula inputs. Null grades remain blank, and cleared/unrecorded attendance is excluded. Cohort filters reflect current enrolment assignments, including for older grades and attendance; they are not historical cohort snapshots. Reports exclude submission text, attachment bytes, credentials, and private session tokens. Downloaded reports contain personal information and should be shared only with authorized TIME staff.

The read-only activity view searches actors, action names, and resource IDs, with inclusive Liberia calendar-day filters and pagination. It displays existing application audit events and new cohort/export events. It does not provide identity-provider sign-in logs or before/after field snapshots, and there is no audit editing/deletion endpoint.

Validation: 109 automated checks including administrator-only permissions, report filtering, CSV safety/limits, blank scores, audit filters, cohort validation, protected assignment scopes and atomic eligibility checks; 11 SQL statements planned on development; development Function deployment; mobile reports/cohorts/activity/editor/assignment visual review with synthetic data. Live authenticated admin use remains a user-session check.

## Private support centre

Migration `007_support_centre.sql` adds private support requests and immutable text-message threads. Verified, active students and lecturers can create requests and access only their own conversations. An optional course label does not require approved enrolment, so users can ask about pending access. Administrators can review all requests, search by subject/requester, filter status, and view queue totals. Course teaching access alone never grants access to other users' support requests.

Requests start Open. Administrators can mark In progress or Resolved; requesters can resolve or reopen their own requests. Resolved threads reject new replies until reopened, checked atomically when a reply is written. Admin claims/releases are bound to the current administrator and conflicting claims are rejected; all administrators can still respond and update status regardless of the claim. Replies are visible to the requester; there are no private staff notes. Initial request/message creation and reply/timestamp updates each use a single database statement. Mutations are audited without logging message contents.

Request lists and threads paginate at 50 records. Opening a conversation loads its most recent message page, with older pages available. Subjects are limited to 160 characters and messages to 4,000. The centre supports text only, with manual refresh and no email/push notifications, automatic response promises, attachments, or message editing/deletion. It requires a verified active account; signed-out or suspended users can use the existing Contact TIME link.

Validation: 125 automated checks including cross-user privacy for students/lecturers, admin-only overview/claiming, server-bound requester/author/staff flags, atomic request creation, resolved-thread restrictions, pagination, status transitions, and safe rendering; eight SQL statements planned on development; development Function deployment; mobile student/admin list, thread, and request-form review using synthetic records. Authenticated production request/reply interaction remains a user-session check.

## Managed courses and cohort-targeted content

Migration `008_courses_and_cohort_content.sql` seeds the existing eight courses into a private catalogue and adds optional managed cohort audiences to lessons, assignments, sessions, and announcements. Existing content keeps a null audience, meaning shared with all approved students in that course. Existing enrolments, teaching permissions, files, grades, and attendance remain intact.

Administrators can create courses, update title/code/description/lecturer display text, archive, and restore them in Manage courses. Course IDs are permanent and validated; the catalogue supports 500 courses. Archiving blocks new student requests, administrator approvals, and bulk cohort enrolment into archived courses; existing course access and historical work are preserved. Declining/revoking access remains available. A display name never grants lecturer permissions: approve the verified teaching account separately. Course validation is tied to the current request's database catalogue, without a process-wide mutable ID list. New courses work with enrolments, teaching tools, cohorts, support labels, and reports. Managed cohorts still support up to eight selected courses each.

Signed-in course cards read catalogue metadata. New courses have no invented curriculum or public study guide; assigned lecturers author private lessons, assignments, class dates, and announcements. Original public programme pages and browser-local draft study guides remain separately maintained. Changing online catalogue metadata does not rewrite public website copy or the static draft guides.

Every new content editor requires an explicit Audience choice: shared with all approved course students, or a managed cohort that includes the course and is not archived. Lecturer cohort choices are limited to their assigned courses. The audience is fixed after creation: create a separate item for another cohort. Existing shared content can be unpublished where supported and replaced by cohort-targeted items; it is not silently reassigned. Backend writes validate cohort/course membership and enforce immutable audiences.

Students see targeted content only when their approved course enrolment references that same managed cohort. Free-text cohort labels alone do not establish managed cohort access; assign students through Manage cohorts first. This applies to lesson lists, direct lesson and file reads, assignment lists and submissions, class meeting links/calendar inputs, and announcement feeds. Attendance rosters and eligibility checks also match the class cohort. Assigned lecturers can manage all cohorts of their teaching courses; this release does not add separate cohort-specific staff permissions. Existing own submissions and attendance history remain readable to their owner. There remains one current enrolment/cohort per student/course; moving a student changes current content access and does not create historical enrolment versions or duplicate attempts at a shared assignment. Create distinct assignments for each cohort when separate attempts are required.

Validation: 142 automated checks for dynamic course permissions, safe rendering, archive behaviour, request-local validators, fixed audiences, content/file isolation, submissions, and attendance cohort eligibility; 26 changed SQL statements planned against development; 23 read-only PostgreSQL fixture checks executing the actual visibility queries for Alpha, Beta, pending, and legacy enrolments. The fixtures confirmed cohort-only plus shared content, draft exclusion, direct lesson/file guards, and attendance rosters/targets. Fixtures were CTE values only and created no student records or teaching content. Development Function deployment and mobile catalogue/editor/audience visual review completed. Authenticated production interactions remain user-session checks.

## Registration, course approval, and Start course flow

Student registration and email verification feed into a visible account-to-course journey. Students request enrolment, see an explicit received/pending state, use Check approval to refresh the decision, and receive a Start course entry on approved cards. Declined requests have review/support guidance; archived courses close new requests. Request success confirms the application was received and does not grant access. No payment collection, payment status, or payment requirement is part of this flow.

The Start course page refreshes the signed-in profile and checks approved enrolment before requesting private materials. It brings together published lessons/files, assignments/submission feedback, class links/venues, announcements, a course calendar, and support. Every underlying API still enforces approval and cohort boundaries. Approved courses with no lecturer content clearly explain that materials have not been published yet. Approval updates appear on refresh; there is no approval email or background notification.

Enrolment review now includes a managed cohort selector filtered to planned/active cohorts containing the chosen course. The server validates that relationship and uses the cohort's stored name, rather than trusting a typed name. A free-text label remains available for shared-only access. Existing managed links are preserved when a label is unchanged. Administrators can approve and assign a matching managed cohort together, without a separate bulk assignment step. Existing access controls and stored coursework remain intact.

Validation: 147 automated checks, including a stateful flow from unverified access denial through a pending student request, administrator cohort approval, and published lesson access; student self-approval denial; refreshed Start course gating; managed-cohort validation; existing registration/code verification checks. Five approval SQL statements planned against development, development deployment, and mobile pending/course/admin approval layout review with synthetic data. Real email delivery and fully authenticated production account interactions still require a user-session check.

## Weekly learning paths and official quizzes/tests

Migration `009_learning_path_assessments.sql` adds lesson week/order fields, private student completion records, official assessments, and immutable attempt question/pass-mark snapshots. Existing lessons remain open by default. Lecturers assign week and order numbers and can require earlier available published lessons to be completed before opening a lesson or its attachment. The sequence combines shared and matching-cohort material; other cohorts and drafts cannot block a student. Previously completed lessons remain available if earlier material is added later. Completion is the student's own confirmation, not proof of attendance, mastery, or a passing grade. Students see weekly cards and course progress; assigned staff can page through approved active students' completion counts.

Quizzes and timed tests support 1–40 single-answer multiple-choice questions, 2–6 distinct choices each, equal marks, lecturer-set pass marks, 1–10 attempts, optional opening/closing times, and an optional completed lesson prerequisite. Tests require a duration (1–180 minutes); quizzes can be untimed or timed. Content audiences follow the same fixed shared/cohort rules as lessons. Students see assessment instructions and their own saved answers/results. Answer keys are available only to assigned course staff, never in student API responses. Use existing assignments for written responses, uploads, manual grading, and lecturer feedback.

Starting an attempt checks approved course/cohort access, publication, availability windows, prerequisites and limits on the server. Concurrent starts are protected by unique attempt ordinals and one active attempt per student/assessment. Starting again resumes an active attempt. Answers autosave with revision checks to prevent silent overwrites from another window, with an explicit Save button and save/error feedback. Refresh resumes stored answers. Timers use the server's clock and the earlier of the test duration or assessment closing time; leaving or refreshing does not reset the deadline. Submission is graded from the stored question/pass-mark snapshot and is idempotent. Questions and assessment rules are frozen after attempts exist; staff can still change title/instructions and publication, or create a new assessment.

After the deadline, only answers already saved on the server are marked; late client answers and client-provided scores are ignored. The connected student page automatically submits at expiry. If the page is closed/offline, finalization happens on the student's next attempt read/start/save/submit; this release has no background finalization job. Staff result lists identify open attempts whose deadline has passed. There is no proctoring, automatic certificate issuance, pass-based lesson unlocking, or combined final-grade policy. Results remain stored, but attempt access requires a current approved enrolment matching the assessment audience. The original public practice quizzes remain separate from official assessments.

Validation: 171 automated checks passed, including weekly ordering, direct locked content/file/completion denial, authenticated completion ownership, draft/cohort filtering, assessment validation, staff/student separation, answer-key exclusion, attempt ownership, server grading, expired saved-answer marking, revision conflicts, idempotent submission, resumable attempts, frozen rules, and the UI save/submit/result flow. Nineteen SQL statements were planned against development PostgreSQL without executing writes; eight read-only CTE scenarios exercised the actual lesson-unlocking expression. Phone-width (390px) synthetic previews covered weekly learning, lecturer question editor and student attempt screens. Development Function health and unauthenticated-route checks completed. Real email delivery and a fully signed-in lecturer-to-student production exercise remain user-session checks. No payments were introduced.


## Follow-up: retain unsaved assessment choices

Leaving an active attempt now requires a successful answer save. A failed save keeps the student on the attempt with their current choices and an explicit retry message. A save that returns a finalized attempt leaves its result visible rather than replacing it with the dashboard. Successful saves still return to the workspace and stop the attempt UI timer.

Validation: 174 automated checks passed. Added failing-then-passing regression coverage for save failure during navigation, successful navigation after saving, and a stateful API journey through verified lecturer publication, draft exclusion, sequential lesson completion, quiz prerequisites, saved/resumed answers, server grading, attempt limits, staff results and cross-student denial. The stateful journey uses a synthetic in-memory query adapter, not real production logins. No backend schema or deployment change was needed for this frontend fix. A real signed-in lecturer/student production trial remains outstanding.


## Workspace operating guides

Collapsible guides now explain the existing workflow inside the application. Administrators see course/cohort setup, verified lecturer access, student enrolment approval, publication readiness and support steps. Lecturers see a first-week checklist covering lesson resources, ordering, audience, draft/publication, quizzes/tests, written assignments, class scheduling and review. Approved students see a course guide covering lesson completion, saved quiz answers, submission, class attendance, feedback and support. Guides are static instructions, do not grant access, and do not imply that course content has been published. They add no backend calls or schema changes. The 174 existing automated checks pass; a real signed-in production account trial remains outstanding.


## Lighter, offline-friendly portal (website release)

The account workspace bundle (`assets/learning/account.bundle.js`) is now 214 KB (61 KB gzipped), down from 717 KB (164 KB gzipped), with no change to `account.mjs` or the backend. The browser build in `backend/scripts/build.mjs`:
- maps `zod` to `src/zod-browser.mjs`, which exports only the `object`/`string`/`number` schemas from `zod/mini` that the Neon Auth client uses to validate its anonymous-token response. The full `zod` import pulled in about 420 KB of locale messages.
- lets esbuild drop `@supabase/auth-js`. The default Better Auth adapter shares a file with the unused Supabase adapter.

Against the live Neon Auth service, the old and new bundles made identical requests (`get-session`, `sign-in/email`) and showed identical screens and errors on all four portal pages. The 174 backend tests pass.

The website service worker now caches the public academy (`learning.html`, `assets/learning/academy.js`, `academy.css` and `courses.js`), so draft study guides, notes and practice checks work offline after a first visit. Account pages and the account bundle are never cached: offline sign-in attempts show the offline page.

## Workspace design (October 2026)

The account pages (`account.html`, `student-login.html`, `lecturer-login.html`, `admin-login.html`) now use the main website's header, footer and TIME Learning academy menu, kept in sync by `npm run layout`. The workspace logic and the live Neon service are unchanged. Styles: `assets/learning/workspace.css` is generated from `portal.css` by `node scripts/workspace-css.mjs` (every rule scoped to `#workspace`), and `assets/learning/workspace-theme.css` applies the academy look. The pages must keep `#workspace`, `#toast`, `#request-indicator`, `#request-message`, `#loading-detail`, a `.skip` link and `body[data-portal]`, which `account.bundle.js` uses; a test checks this.
