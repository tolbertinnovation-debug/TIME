# Guide for the system administrator

You can see everything and step in anywhere. Use that power sparingly: each office should make its own decisions, and every action you take is in the activity log under your name.

## Accounts

- **Accounts:** search by name or email. Change a person's role with **Save**. New accounts are always students; staff ask for their role with **Ask for staff access**, and their request arrives in **Approvals**.
- **Suspend** an account to stop a person signing in. Restore it the same way.
- **New password:** sets a password for someone who has forgotten theirs and signs them out everywhere. Give it to them in person or by phone, never in a group chat.
- The platform always keeps at least one administrator. Keep **two** administrator accounts, held by two different people.

## Oversight

- **Activity:** every sign-in, failed sign-in, application, payment, mark, approval and change, newest first. Filter by person, kind and date.
- **Approvals:** every request waiting anywhere. If an office is unable to decide in time, you can decide in its place. Say why in the note.
- **Administration** home shows accounts by role and the latest activity.

## Stepping in on a class

You can open any class as its lecturer would: lessons, sessions, attendance, assessments and the gradebook. Use this to help a lecturer or to cover an absence.

## Routine checks

| When | Check |
|---|---|
| Daily | **Approvals** has nothing waiting more than two working days. **Help desk** has no unanswered request. |
| Weekly | **Activity**, filtered to failed sign-ins: many failures for one account may mean someone is guessing a password. |
| Each intake | Staff who have left are suspended. Roles still match people's jobs. |
| Monthly | A backup has been restored to a test database and opened (see the going-live checklist). |

## If something goes wrong

- **A person cannot sign in:** check the account is not suspended, then set a new password.
- **A decision was made in error:** it cannot be silently undone. Make the correcting change (for example reopen the class, or revoke the certificate with a reason) so that the log shows both.
- **The platform is down:** open `/api/health` on the platform's address. If it does not answer `{"ok":true}`, contact whoever manages the hosting and the database.
