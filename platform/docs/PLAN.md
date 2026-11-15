# TIME Learning: complete plan

Updated 13 November 2026. This replaces the earlier plan. Steps 1 to 7 are built, except sending email and SMS. Of step 8, the installable app, offline lessons and the guides are built; the rest waits on accounts and decisions from TIME, listed in [GOING-LIVE.md](GOING-LIVE.md).

## What the earlier plan was missing

| Missing | Now in |
|---|---|
| **Certificate requests.** A student who has finished asks for their certificate; the platform checks they qualify; staff approve; the certificate is issued. | Step 6 (built) |
| **One approvals inbox.** Every decision that needs sign-off in one place, with an administrator able to step in on any of them. | Step 1 (built), extended in every step |
| **A full activity view.** Everything every person does, searchable, for administrators. | Step 1 (built), extended in every step |
| Academic setup: intakes, classes (cohorts), study centres, lecturer assignments | Step 2 (built) |
| Course building tools for lecturers, with review before lessons are published | Step 3 (built) |
| Announcements and class sessions (step 3, built); class discussions (step 7) | Steps 3 and 7 |
| Grade appeals, resits, withdrawals and deferrals | Steps 4 and 2 (built) |
| Payment arrangements and finance overview (step 5, built); refunds (later) | Step 5 |
| Transcripts, results slips and replacement certificates | Step 6 |
| Notifications in the app (step 7, built); by email and SMS/WhatsApp (needs providers) | Step 7 |
| Help desk and sponsor progress reports (step 7, built); course evaluations (later) | Step 7 |
| Password reset, email verification, sign-in by phone number | Step 2 (reset by an administrator, built) and Step 8 (self-service) |
| Terms and privacy acceptance, data retention, account deletion requests | Step 8 |
| Backups, monitoring, error alerts, a security review, load testing | Step 8 |
| Moving the old portal's accounts across | Step 8 |
| Staff training, user guides and a help centre | Step 8 |
| Reports and exports for the Ministry of Education and leadership | Steps 4 to 6 |

## Rules built into the platform

- **Programs:** TIME's certificates and diplomas, loaded from the website's catalogue.
- **Learning:** about 60% online and 40% practical, tracked separately in every course.
- **Grading:** 100 points: continuous assessment 30, assignments and practical activities 20, midterm 20, final 30. Pass mark 70.
- **Fees:** Mobile Money or bank transfer, confirmed by a finance officer. A class opens with the first confirmed payment. The balance is due 8 weeks after it; access pauses if it is unpaid and returns on payment or an approved arrangement.
- **Sponsors:** a termly progress summary, only with the student's consent.
- **Oversight:** every change is written to the activity log, and every sign-off goes through the approvals inbox.

## Roles

Student · Lecturer · Study centre facilitator · Registrar · Finance officer · Academic leadership (Dean, Executive Director) · System administrator.
The rules are in `src/lib/permissions.ts` and are checked on the server for every page and action.

## Steps

### Step 1. Foundation — built
- Accounts: create account, sign in, sign out. New accounts are always students.
- Seven roles with server-side permission checks.
- Staff ask for their role; an administrator approves or rejects with a reason.
- **Approvals inbox** (waiting and decided), built to take every later approval type.
- **Activity log** of every sign-in, failed sign-in, new account, role change, suspension and decision, with search and filters.
- Account management: search, change role, suspend and restore. The platform can never be left without an administrator.
- Sign-in locks for 10 minutes after 5 wrong passwords.
- TIME's 4 schools, 6 programs and 41 courses loaded from the website catalogue.
- Works on phones; pages need almost no JavaScript.

### Step 2. Academic setup, admissions and enrolment — built
- Intakes (planned, open, closed) and study centres. The March and October 2027 intakes are loaded from the website.
- Classes: a course in an intake, on weekdays or Saturdays, online or blended, with an optional number of places. A blended class needs a study centre.
- The registrar assigns lecturers and facilitators to classes. A lecturer can open only the classes they are assigned to.
- Online application: a student applies to an open class; the registrar approves or rejects it in the approvals inbox.
- Approval enrols the student and gives them a student number (TIME-year-0001). A full class cannot take another student.
- Students see their classes and can ask to withdraw or defer; the registrar decides.
- An administrator can set a new password for a person, which signs them out everywhere.
- The registrar sees only applications and enrolment requests in the inbox; administrators and leadership see everything.
- Every one of these actions is in the activity log.

### Step 3. Teaching and learning — built
- Lessons: a lecturer writes a course's modules and lessons, each marked online or practical. Every class of the course shares them.
- Review before publishing: drafts are sent to academic leadership, who read them and approve or reject with a reason. Students see only published lessons. A published lesson is taken back to draft to change it.
- Students open their class, read lessons and mark online lessons complete. Progress is shown split into online and practical.
- Practical work is signed off by the lecturer or study centre facilitator, with their name recorded.
- Sessions: live online classes (with a meeting link) and in-person practicals. Staff take attendance; students see coming sessions and their attendance.
- Announcements from the lecturer to the class.
- A facilitator can take attendance and sign off practicals, but cannot write lessons or post announcements.
- An administrator can open the teaching view of any class to step in.
- Still to come: uploading files to lessons (needs file storage; a lesson can link to notes or audio for now), class discussion (step 7) and saving lessons for offline study (step 8).

### Step 4. Assessment — built
- Three kinds of assessment: written work handed in online, multiple-choice quizzes marked automatically, and exams or practicals taken on paper or in person where the lecturer enters the marks.
- Each assessment counts toward one of the four parts of the grade. The gradebook applies the 30 / 20 / 20 / 30 split and the pass mark of 70.
- Quizzes: one attempt, an optional time limit that starts on the server, and two minutes' allowance for a slow connection. A late hand-in gets no marks. Students never receive the correct answers.
- The lecturer can let a student take an assessment again, with a reason that is recorded.
- Marking: marks cannot exceed the maximum, and changing a mark that was already given needs a reason. Every mark and change is in the activity log.
- Results: the lecturer sends a class's results to academic leadership. Marks are locked while they wait. Rejected results come back with a reason. Students see a result only after it is approved.
- Appeals: a student can appeal a published result. If leadership approves, only that student's result is reopened for re-marking and sent again.
- Still to come: uploading files with written work (needs file storage; students can paste a link for now), question banks with random selection, and exports of results.

### Step 5. Fees — built
- Students pay by **Mobile Money or bank transfer**. The finance office sets the details students see.
- Enrolment charges the course's tuition automatically. Finance can add other charges (registration, examination, other).
- A student pays, then enters the amount, the transaction ID or bank reference, and the date. It does not count until a finance officer finds it on the statement and confirms it.
- Confirming issues a numbered receipt the student can open. One transaction can be used only once.
- Finance can reject a reported payment with a reason, and can record a payment the student did not report.
- A class opens when the first payment is confirmed. The balance is due 8 weeks after that payment. If it is unpaid, access pauses automatically and returns the moment the balance is paid.
- A student can ask for more time; the finance office decides in the approvals inbox.
- Students are warned on their home page 14 days before the balance is due.
- Finance sees payments to confirm, balances due soon, paused students and totals. Leadership can look but not change. Finance cannot see marks or lessons.
- Still to come: reminders by SMS or email (step 7), refunds, and amounts in Liberian dollars.

### Step 6. Completion and certificates — built
- **The administration decides when a class has ended.** The registrar or an administrator ends it (and can reopen it).
- A student can then **request their certificate** if three things are true: the class has ended, their published result is a pass, and their fees are cleared. The page shows each of the three with a tick or a cross.
- **Two checks before it is issued:** the registrar checks the record, then academic leadership approves and issues. Either can reject with a reason, and the student can ask again. An administrator can do either step.
- If the student stops qualifying while the request is waiting (for example a new charge), it cannot be approved until that is put right.
- **The certificate follows TIME's paper certificate:** the heading and address, the award title, the holder's name in blackletter, TIME's wording, the award date and place, and "ID NO". It prints on one landscape page.
- The "C" Certificate programs award a **Teaching Certificate in Elementary Education** with the Bureau of Teacher Education wording and three signature lines (Executive Director, Assistant Minister, County Education Office). Other programs award a Diploma, Professional Certificate or Certificate, with TIME's wording only and the Executive Director's line.
- **Signature lines are blank, to be signed by hand.** The platform does not print the Ministry's seal or any signature.
- **Numbering continues from paper:** the registrar enters the last number already issued on paper for each kind (TC, DP, PC, CT), and the platform uses the next one.
- **Anyone can check a certificate** on a public page with its ID number and the code printed on it. An ID alone reveals nothing.
- Leadership or an administrator can **revoke** a certificate with a reason; it then shows as revoked to everyone.
- Still to come: transcripts, and requests for a replacement certificate.

### Step 7. Communication and support — built, except email and SMS
- **Notifications inside the platform.** People are told when a request of theirs is approved or rejected, a payment is confirmed or rejected, results are published, an announcement or a new assessment is posted, and when someone replies to them. The header shows how many are unread.
- **Class discussion.** Students and staff of a class ask and answer questions. Only the class can read it. The lecturer can remove a post; the text is kept in the activity log.
- **Help desk.** Anyone can ask the TIME office for help. Fee questions go to the finance office; everything else goes to the registrar. Only the person who asked and the staff who handle that kind of request can read it.
- **Sponsors.** The registrar records sponsors and the students they sponsor. A progress report can include a student only after that student agrees, on the platform or by a signed form the registrar records. The student can withdraw at any time. The report is a summary only: enrolment, attendance, work handed in, overall result, standing and completion. It never includes individual work, feedback, messages or fees. Each report produced is logged.
- **Still to come: email and SMS or WhatsApp.** Every notification goes through one function (`src/lib/notify.ts`), so sending by email and SMS is added there once TIME has chosen providers. Fee reminders 14 and 3 days before the due date will be sent the same way; today the student sees them on their home page. Course evaluations are also still to come.

### Step 8. Launch readiness and pilot — partly built
Built:
- **Installable app.** The platform can be added to a phone's home screen and opens like an app.
- **Offline lessons.** Every lesson a student opens is kept on their phone, and **Save lessons for offline** on the class page keeps the whole class. With no connection, saved lessons open as usual and other pages explain that a connection is needed. With a connection the server is always asked first, so permission and fee checks still apply. Assessments, fees, certificates and staff pages are never kept. Saved lessons are removed when the student signs out.
- **Guides** for students, lecturers and facilitators, the registrar, Finance, academic leadership and administrators, in [`guides/`](guides/README.md).
- **Going-live checklist** in [GOING-LIVE.md](GOING-LIVE.md), and a health check address (`/api/health`) for monitoring.
- **One-step deployment.** On the live host the build checks its settings, creates the tables, loads the catalogue and creates the first administrator. Steps for Neon and Vercel are in [DEPLOY.md](DEPLOY.md).
- **Approving applications together.** The Registrar ticks several applications, or all of them, and approves them at once. Each is still checked on its own, so a full class is never over-filled. Only applications can be approved this way.
- **Refunds and cancelled balances.** Finance asks, academic leadership approves, Finance sends the money and records the reference. A refund can never exceed what the student has paid and not had back. Refunds appear on the student's fees page, the statement and a Refunds report.
- **Your account.** Everyone can change their own password (other devices are signed out; five wrong current passwords lock changes for ten minutes) and their phone number. Names are corrected by the Registrar because they appear on certificates.
- **Transcripts.** A student opens and prints their own transcript of published results. The Registrar, leadership and administrators can open any student's, to sign and stamp it.
- **Reports.** Enrolment and results (Registrar, leadership, administrators) and confirmed payments (Finance, leadership, administrators) download as spreadsheets, for one intake or all. Every download is in the activity log.
- **Course evaluations.** Students rate the teaching, materials, support and the course overall, with optional comments, once the class has ended or their result is published. Answers are stored with no link to the student. The lecturer and academic leadership see a summary once three students have answered.
- **Draft terms of use and privacy notice** in [`legal/`](legal/README.md), waiting for TIME's review. Acceptance at sign-up is added once they are approved.

Still to come (each waits on a decision or account from TIME):
- Self-service password reset, email verification, sign-in by phone number.
- Terms and privacy acceptance; data retention; account deletion requests.
- Backups tested by restoring; monitoring and alerts; security review; load test.
- Old portal accounts moved across (if TIME decides to keep them).
- Staff training. Pilot with one cohort of about 50 students.

### Later
Android app from the store. Research and thesis management, when TIME runs postgraduate programs.

## Decisions still needed from TIME

1. Hosting: Vercel or Cloudflare. The app runs on either.
2. The platform's web address.
3. The old portal's accounts: move, keep or delete.
4. An email service for password reset and notifications, and an SMS or WhatsApp provider.
5. Brand: the platform uses the current olive and red. Say if this should change.
6. File storage for lesson files and submitted work (Cloudflare R2 is planned).
7. The pilot cohort and its start date.
8. Certificate wording, layout and signatures.
