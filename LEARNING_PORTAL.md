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
