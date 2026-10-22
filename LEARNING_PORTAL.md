# TIME Learning: first release

Public, buildless portal at learning.html. Eight courses, 48 draft study guides, 48 practice questions, per-browser notes/progress, assignment draft downloads, and JSON backup/restore.

## Content and release status
All study guides, practice questions, suggested tasks, and the ten-week plan are newly drafted and require lecturer review. Lecturer names, course titles, ten-week duration, the 60/40 format, and the general master’s-to-PhD qualifications statement were supplied by TIME. No individual credentials or meeting dates are invented.

## Storage and privacy
State uses browser localStorage key time-learning-v1; no account, server submission, or cross-device synchronization. Browser profiles share local state. User text is escaped before rendering; imports are validated and bounded. JSON exports contain notes and drafts, so users must keep backups private. Assignment emails only request submission instructions and never automatically send work.

## What must be connected next
1. Choose a backend with student/lecturer roles, verified login, enrolment, private storage, access controls, and backup/retention settings.
2. Have lecturers approve or replace draft guides; supply readings/videos and official tasks/rubrics.
3. Confirm contact hours, calendar dates, live meeting provider/links, and campus sessions.
4. Implement private assignment uploads, lecturer feedback, assessed grades, and verified attendance.
5. Add certificate issuance only against TIME-approved completion rules.

No credentials, authentication simulation, private uploads, official assessment results, or certificates are included in this release. Keep future private learner data out of this public Git repository.
