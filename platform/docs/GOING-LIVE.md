# Going-live checklist

What has to be done, in order, before students use TIME Learning. Items marked **TIME** need a decision or an account from TIME. Items marked **Build** are development work that waits on those decisions.

## 1. Decisions and accounts (TIME)

| # | Needed | Notes |
|---|---|---|
| 1 | **Hosting account** | Vercel or Cloudflare. The app runs on either. |
| 2 | **Web address** | For example `learn.` followed by TIME's domain. Needs access to the domain's DNS settings. |
| 3 | **Database** | A PostgreSQL database (Neon is planned). Use a new one: do not share the old portal's database. |
| 4 | **Email service** | For password reset, email verification and notifications. |
| 5 | **SMS or WhatsApp provider** | For fee reminders and urgent notices to students without regular email. |
| 6 | **File storage** | For lesson files and work students upload (Cloudflare R2 is planned). |
| 7 | **Old portal accounts** | Move them, keep them only as a record, or delete them. |
| 8 | **Certificates** | Wording and signature lines for diplomas and professional certificates; the last number issued on paper for each kind. |
| 9 | **Terms and privacy notice** | The text students accept when they create an account, and how long records are kept. |
| 10 | **Pilot class** | Which class of about 50 students goes first, and its start date. |

## 2. Build that follows those decisions

- [ ] Self-service password reset and email verification (needs 4)
- [ ] Notifications and fee reminders by email and SMS or WhatsApp (needs 4, 5)
- [ ] File uploads for lessons and submitted work (needs 6)
- [ ] Terms and privacy acceptance at sign-up; account deletion requests (needs 9)
- [ ] Old accounts moved across, if TIME decides to keep them (needs 7)

## 3. Setting up the live platform

- [ ] Create the production database and set `DATABASE_URL`.
- [ ] Set `BETTER_AUTH_SECRET` to a new random value (`openssl rand -base64 32`). Never reuse the test value. Store it only in the host's settings.
- [ ] Set `BETTER_AUTH_URL` to the platform's real address, starting with `https://`.
- [ ] Run `npm run db:deploy` to create the tables, then `npm run db:seed` to load TIME's schools, programs, courses and intakes.
- [ ] Create the first administrator with `npm run create-admin`. Then create a second administrator account for a different person.
- [ ] Open the address and confirm the padlock (HTTPS) shows. The installable app and offline lessons only work over HTTPS.
- [ ] Open `/api/health` and confirm it answers `{"ok":true}`.

## 4. Before the first student

- [ ] **Finance:** enter the Mobile Money and bank details under Finance, Payment details. Have a second person check every digit.
- [ ] **Registrar:** enter the last paper certificate number for each kind under Administration, Certificates.
- [ ] **Registrar:** add the intake, study centres and classes, and assign lecturers.
- [ ] **Lecturers:** write the first weeks of lessons and have leadership approve them.
- [ ] Every member of staff has signed in, asked for staff access and been approved.
- [ ] Each office has read its guide in `docs/guides/`.

## 5. Safety checks

- [ ] **Backups:** daily automatic database backups are switched on. One backup has been restored into a separate test database and opened. Repeat this monthly.
- [ ] **Monitoring:** an uptime monitor checks `/api/health` every few minutes and alerts two people by email or SMS.
- [ ] **Error alerts:** the host's error log is watched, or an error reporting service is connected.
- [ ] **Security review:** an independent pass over sign-in, permissions, payments and certificates before real money and real records are entered.
- [ ] **Load test:** 50 students signed in at once, each opening lessons and handing in a quiz, without errors.
- [ ] **Phones:** the platform has been used from start to finish on a low-cost Android phone on a mobile connection, including saving lessons and reading them with no connection.

## 6. Pilot

1. One class, about 50 students, for one full course.
2. A named person in each office answers the help desk within one working day.
3. Review weekly: sign-in problems, payments waiting, lessons not opened, attendance not taken.
4. At the end: issue the certificates through the platform, collect feedback from students and staff, and fix what was found before opening to all classes.

## What is already built and tested

Accounts and roles; approvals inbox; activity log; intakes, classes and enrolment; lessons with review; sessions and attendance; assessments and results; fees with receipts and the eight-week rule; certificates with public checking; notifications; class discussions; help desk; sponsor reports with consent; installable app with offline lessons. See [PLAN.md](PLAN.md).
