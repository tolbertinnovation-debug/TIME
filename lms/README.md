# TIME Inc. learning platform (Moodle) setup kit

These files help set up the learning platform described in `docs/online-learning-blueprint.md`. Everything is generated from **`assets/data/catalogue.json`**, the same course list shown on `programs.html`.

| File | What it is |
|---|---|
| `build-moodle-csv.mjs` | Script that regenerates the CSVs in `out/` and checks the catalogue still matches `programs.html` |
| `out/categories.csv` | Course categories: School → Program (12 rows) |
| `out/courses.csv` | One hidden **master course** per catalogue course (33 rows) |
| `out/cohorts.csv` | Intake groups, built from each course's `next_cohorts` (empty until intake dates are added) |
| `course-template.md` | The standard 10-week layout every master course follows |

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

Most TIME roles map to Moodle's built-in roles (see blueprint §5.1). Create these four custom roles under *Site administration → Users → Permissions → Define roles*. Start each from the archetype shown, then adjust the capabilities.

| Custom role | Start from | Assign in | Must be able to | Must NOT be able to |
|---|---|---|---|---|
| **Registrar** | Manager | System | Create/update users, manage cohorts and cohort members, enrol and unenrol students, view all grades, issue certificates | Edit course content, change grades, change site settings |
| **Finance** | No archetype | System | View users, change enrolment status (active/suspended) to pause or restore access for unpaid fees, edit the payment profile fields | View course content, grades or messages |
| **Academic leadership** (Dean, Executive Director) | No archetype | System | View all courses, grades and reports; approve final grades and certificates | Delete courses or users |
| **Sponsor** | No archetype | User (the sponsored student) | See the student's course completion and progress | See individual grades, submissions, forum posts or messages |

For the **Sponsor** role, follow Moodle's documented "Parent role" recipe (assigned in the student's user context). Remove anything that exposes grades or posts, and assign it only after the student has given written consent. Test every custom role with a sample account and *Check permissions* before giving it to real staff.

## Recommended plugins

| Plugin | Why |
|---|---|
| Custom certificate (`mod_customcert`) | Certificates with a verification code, for the public "verify a certificate" page |
| Attendance (`mod_attendance`) | Session attendance for the 75% completion rule, usable by hub facilitators |
| Moodle app (official) | Students download lessons and study offline, then sync |

## Payment profile fields

Under *Site administration → Users → User profile fields*, add `installment_1_paid` and `installment_2_paid` (checkbox), plus `payment_reference` and `sponsor_name` (text). Make them visible to the user and editable only by Finance.
