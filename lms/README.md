# TIME Inc. learning platform (Moodle) setup kit

These files help set up the learning platform described in `docs/online-learning-blueprint.md`. Everything is generated from **`assets/data/catalogue.json`**, the same course list shown on `programs.html`.

| File | What it is |
|---|---|
| `build-moodle-csv.mjs` | Script that regenerates the CSVs in `out/` and checks the catalogue still matches `programs.html` |
| `out/categories.csv` | Course categories: School → Program (12 rows) |
| `out/courses.csv` | One hidden **master course** per catalogue course (33 rows) |
| `out/cohorts.csv` | Intake groups, built from each course's `next_cohorts` (empty until intake dates are added) |
| `course-template.md` | The standard 10-week layout and 100-point gradebook every master course follows |
| `sponsor-report-template.md` | Student consent form and the termly sponsor progress report |

> **Before importing:** TIME leadership still has to approve the school grouping and delivery modes (`"status": "proposed"` in `catalogue.json`). Changing a course's `school_id` and re-running the script updates every CSV.

## Regenerate the CSVs

```sh
node lms/build-moodle-csv.mjs
```

This needs Node 18 or later and has no dependencies. If it stops with "Not found on programs.html", a course title in the catalogue no longer matches the public site. Fix whichever one is wrong, then run it again.

## Import order (Moodle 4.x, as site administrator)

1. **Categories.** Create the 4 schools, then the programs inside them, exactly as listed in `out/categories.csv` (` / ` separates parent and child). Do this by hand under *Site administration → Courses → Manage courses and categories*, or install the *Upload course categories* plugin (`tool_uploadcoursecategory`) and upload the file.
2. **Master courses.** Go to *Site administration → Courses → Upload courses*, choose `out/courses.csv` and select "Create new courses only, skip existing ones". The masters are hidden (`visible = 0`). Instructors build content in them following `course-template.md`.
3. **Cohorts.** Go to *Site administration → Users → Accounts → Upload cohorts* and choose `out/cohorts.csv`.
4. **Running a cohort.** For each intake, copy the master course (*Course → More → Copy course*), name it e.g. `QuickBooks · 2027-01 · Saturday`, set its start date, then link the cohort with the *Cohort sync* enrolment method so enrolled students join automatically.

Check every step on a test site, or with one row, before importing the full files. Upload screens differ slightly between Moodle versions.

## Roles to create

Most TIME roles map to Moodle's built-in roles (see blueprint §5.1). Create these three custom roles under *Site administration → Users → Permissions → Define roles*. Start each from the archetype shown, then adjust the capabilities.

| Custom role | Start from | Assign in | Must be able to | Must NOT be able to |
|---|---|---|---|---|
| **Registrar** | Manager | System | Create/update users, manage cohorts and cohort members, enrol and unenrol students, view all grades, issue certificates | Edit course content, change grades, change site settings |
| **Finance** | No archetype | System | View users, change enrolment status (active/suspended) to pause or restore access for unpaid fees, edit the payment profile fields | View course content, grades or messages |
| **Academic leadership** (Dean, Executive Director) | No archetype | System | View all courses, grades and reports; approve final grades and certificates | Delete courses or users |

Sponsors don't get Moodle accounts (decided 31 Oct 2026). With the student's consent, the Registrar sends a summarized report each term using `sponsor-report-template.md`.

Test every custom role with a sample account and *Check permissions* before giving it to real staff.

## Recommended plugins

| Plugin | Why |
|---|---|
| Custom certificate (`mod_customcert`) | Certificates with a verification code, for the public "verify a certificate" page |
| Attendance (`mod_attendance`) | Session attendance for continuous assessment and sponsor reports, usable by study centre facilitators |
| Moodle app (official) | Students download lessons and study offline, then sync |

## Payment profile fields

Under *Site administration → Users → User profile fields*, add these fields, visible to the student and editable only by Finance:

| Field | Type | Use |
|---|---|---|
| `installment_1_date` | Date | Date of the first payment |
| `installment_2_due` | Date | `installment_1_date` + 8 weeks; tell the student this date in writing at registration |
| `installment_2_paid` | Checkbox | Balance cleared |
| `payment_arrangement` | Text | Details and approver of any authorized payment arrangement |
| `payment_reference` | Text | Mobile money / bank / receipt reference |
| `sponsor_name` | Text | Sponsor, if any |
| `sponsor_report_consent` | Checkbox | Student's informed consent to sponsor reports (keep the signed form on file) |

## Unpaid balance procedure (decided 31 Oct 2026)

1. **2 weeks and 3 days before `installment_2_due`:** send the student a reminder by SMS/WhatsApp and Moodle message.
2. **After the due date, if it's still unpaid and there's no approved arrangement:** Finance sets the student's enrolment to **Suspended** in each of their courses (*Participants → edit enrolment → Status: Suspended*). Their work and grades are kept.
3. **When the balance is paid, or an arrangement is approved:** Finance sets the enrolment back to **Active**, and access returns immediately.
4. Publish this policy at registration and apply it the same way to every student.
