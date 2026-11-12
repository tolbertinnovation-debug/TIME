# TIME Learning: complete plan

Updated 11 November 2026. This replaces the earlier plan. Steps 1 to 3 are built; the rest follow in order.

## What the earlier plan was missing

| Missing | Now in |
|---|---|
| **Certificate requests.** A student who has finished asks for their certificate; the platform checks they qualify; staff approve; the certificate is issued. | Step 6 |
| **One approvals inbox.** Every decision that needs sign-off in one place, with an administrator able to step in on any of them. | Step 1 (built), extended in every step |
| **A full activity view.** Everything every person does, searchable, for administrators. | Step 1 (built), extended in every step |
| Academic setup: intakes, classes (cohorts), study centres, lecturer assignments | Step 2 (built) |
| Course building tools for lecturers, with review before lessons are published | Step 3 (built) |
| Announcements and class sessions (step 3, built); class discussions (step 7) | Steps 3 and 7 |
| Grade appeals, resits, withdrawals and deferrals | Steps 4 and 2 |
| Refunds, payment arrangements and finance reports | Step 5 |
| Transcripts, results slips and replacement certificates | Step 6 |
| Notifications by app, email and SMS/WhatsApp | Step 7 |
| Help desk, course evaluations, sponsor progress reports | Step 7 |
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
- **Fees:** Mobile Money, confirmed by a finance officer. The balance is due 8 weeks after the first payment; access pauses if it is unpaid and returns on payment or an approved arrangement.
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

### Step 4. Assessment
- Assignments with file upload, quizzes, timed tests with question banks.
- Gradebook with the 30 / 20 / 20 / 30 split and the pass mark of 70.
- Grade approval: lecturer → coordinator → Dean (approval), then published to students.
- Grade appeals and resits (approval). Results slips. Exports for leadership.

### Step 5. Fees
- Invoices per student; installments; Mobile Money transaction ID entered by the student.
- Finance confirmation queue; receipts.
- The 8-week rule: reminders, automatic pause, restore on payment.
- Payment arrangements and refunds (approval). Finance reports.

### Step 6. Completion and certificates
- The platform works out when a student has completed a program: every course passed, every required assessment done, fees cleared.
- **Certificate request:** the student presses "Request my certificate". The request shows what has been checked.
- Registrar verifies → Dean approves → Executive Director signs (approval, three steps; an administrator can see every step and step in if necessary).
- The certificate is issued with a code, as a PDF the student can download.
- A public page lets an employer check the code.
- Transcripts, and requests for a replacement certificate (approval).

### Step 7. Communication and support
- Notifications in the app, by email and by SMS or WhatsApp.
- Class discussions. Help desk for students; course evaluations; sponsor progress reports.

### Step 8. Launch readiness and pilot
- Installable app with offline support. Self-service password reset, email verification, sign-in by phone number.
- Terms and privacy acceptance; data retention; account deletion requests.
- Backups tested by restoring; monitoring and alerts; security review; load test.
- Old portal accounts moved across (if TIME decides to keep them).
- Staff training and user guides. Pilot with one cohort of about 50 students.

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
