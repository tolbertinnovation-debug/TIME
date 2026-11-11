CREATE TABLE IF NOT EXISTS time_learning.courses (
 id text PRIMARY KEY CHECK(length(id) BETWEEN 1 AND 64 AND id ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'),
 code text NOT NULL CHECK(length(code) BETWEEN 1 AND 12),title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
 lecturer text NOT NULL DEFAULT '' CHECK(length(lecturer)<=160),description text NOT NULL DEFAULT '' CHECK(length(description)<=2000),
 archived boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO time_learning.courses(id,code,title,lecturer,description) VALUES
('school-leadership','SLM','School Leadership and Management','Rev. Yekeku','Turn a school vision into practical routines, supportive leadership, and measurable improvement.'),
('administrator-decisions','ADM','Leadership, Policy, and Decision-Making for School Administrators','Dr. Saywrayne, III','Make transparent, evidence-informed administrative decisions and communicate them responsibly.'),
('policy-strategy','LPS','Leadership, Policy, and Strategy','Dr. Saywrayne, III','Connect organizational purpose, policy, strategic choices, and accountable delivery.'),
('project-management','PPM','Project Planning and Management','AB Kekulah','Plan a realistic community or school project from its problem statement to final review.'),
('research-skills','RSD','Research Skills Development','Mr. Gbeh, Jr.','Ask clear questions, assess sources, and present research with integrity.'),
('standard-english','ENG','Standard English: Reading, Writing, and Public Speaking','Dr. Toga','Read critically, write clear paragraphs, and speak confidently for academic and professional purposes.'),
('drug-dispensing','PDD','Principles of Drug Dispensing','Mr. Bee','Study dispensing safety, professional boundaries, recordkeeping, and supervised practice. This guide does not qualify anyone to dispense medicines.'),
('health-care-management','HCM','Health Care Management','Mr. Kollie','Explore service planning, staff coordination, quality improvement, and responsible management of health services.')
ON CONFLICT(id) DO NOTHING;
ALTER TABLE time_learning.lessons ADD COLUMN IF NOT EXISTS cohort_id uuid REFERENCES time_learning.cohorts(id);
ALTER TABLE time_learning.assignments ADD COLUMN IF NOT EXISTS cohort_id uuid REFERENCES time_learning.cohorts(id);
ALTER TABLE time_learning.sessions ADD COLUMN IF NOT EXISTS cohort_id uuid REFERENCES time_learning.cohorts(id);
ALTER TABLE time_learning.announcements ADD COLUMN IF NOT EXISTS cohort_id uuid REFERENCES time_learning.cohorts(id);
CREATE INDEX IF NOT EXISTS lessons_cohort_idx ON time_learning.lessons(cohort_id,course_id);
CREATE INDEX IF NOT EXISTS assignments_cohort_idx ON time_learning.assignments(cohort_id,course_id);
CREATE INDEX IF NOT EXISTS sessions_cohort_idx ON time_learning.sessions(cohort_id,course_id);
CREATE INDEX IF NOT EXISTS announcements_cohort_idx ON time_learning.announcements(cohort_id,course_id);
REVOKE ALL ON time_learning.courses FROM PUBLIC;
