# Security review

Reviewed on 14 November 2026, by the developer who built the platform, before real students and money arrive. This is **not** an independent review: one is still recommended (see [GOING-LIVE.md](GOING-LIVE.md), section 5).

## What was checked

| Area | What was looked for | Result |
|---|---|---|
| Every action that changes data (69 server actions) | Each one confirms who is signed in and that their role allows the action, on the server | All do |
| Actions that name a class and an item (assessment, lesson, session, student, post) | The item really belongs to that class, so a lecturer of one class cannot change another's | All do |
| Actions on a person's own records (payments, enrolment, certificates, consent, help requests) | The record belongs to the person asking | All do |
| Pages that open one record by its address (certificates, receipts, help requests, statements, transcripts, sponsor reports) | Someone else's record answers "not found" | All do |
| Approvals | Nobody decides their own request; a request is decided once; money needs two people | All hold |
| Database queries | No query is built by joining text, so nothing typed in can change a query | None found |
| Links people type (lesson resources, meeting links, students' work) | Only `https://` links are accepted, so a link cannot run code when clicked | All checked |
| Displayed text | Nothing typed in is shown as raw HTML | None found |
| Reports | Only the roles allowed can download; each download is logged | Holds |

## Found and fixed

1. **The sign-in system's raw web addresses (`/api/auth/...`) were open.** The platform never used them, but through them a student could rename themselves (names appear on certificates and are kept by the Registrar), sign up past the form's checks, and try passwords without the platform's five-attempt lock. Roles could not be changed that way. The addresses are now closed.
2. **Security headers were missing.** Pages now tell the browser to load nothing from other websites, never to show the platform inside another site, always to use HTTPS, and to keep the camera, microphone and location switched off.

Both fixes have browser tests.

## Known limits

- **Inline scripts are allowed** by the content policy, because the framework needs them to start a page. Outside scripts are not.
- **Saved lessons on shared phones:** lessons saved for offline reading stay on the phone until the student signs out. The guides tell students to sign out on shared phones.
- **Rate limits on sign-up** are not set. Anyone can create a student account, which can do nothing until the Registrar approves an application.
- **No email verification yet** (it needs an email service), so the email on an account is not proven to belong to the person.
