ALTER TABLE time_learning.lessons ADD COLUMN IF NOT EXISTS week_number integer NOT NULL DEFAULT 1 CHECK(week_number BETWEEN 1 AND 52);
ALTER TABLE time_learning.lessons ADD COLUMN IF NOT EXISTS lesson_order integer NOT NULL DEFAULT 1 CHECK(lesson_order BETWEEN 1 AND 999);
ALTER TABLE time_learning.lessons ADD COLUMN IF NOT EXISTS require_previous boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS time_learning.lesson_completions (
 lesson_id uuid NOT NULL REFERENCES time_learning.lessons(id),student_id uuid NOT NULL REFERENCES time_learning.members(user_id),completed_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(lesson_id,student_id)
);
CREATE INDEX IF NOT EXISTS lesson_completions_student_idx ON time_learning.lesson_completions(student_id,lesson_id);
CREATE TABLE IF NOT EXISTS time_learning.assessments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),course_id text NOT NULL REFERENCES time_learning.courses(id),cohort_id uuid REFERENCES time_learning.cohorts(id),
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),instructions text NOT NULL DEFAULT '' CHECK(length(instructions)<=8000),
 kind text NOT NULL CHECK(kind IN('quiz','test')),week_number integer NOT NULL CHECK(week_number BETWEEN 1 AND 52),
 questions jsonb NOT NULL CHECK(jsonb_typeof(questions)='array' AND jsonb_array_length(questions) BETWEEN 1 AND 40),
 pass_mark integer NOT NULL CHECK(pass_mark BETWEEN 0 AND 100),duration_minutes integer NOT NULL CHECK(duration_minutes BETWEEN 0 AND 180),max_attempts integer NOT NULL CHECK(max_attempts BETWEEN 1 AND 10),
 opens_at timestamptz,closes_at timestamptz,required_lesson_id uuid REFERENCES time_learning.lessons(id),published boolean NOT NULL DEFAULT false,
 created_by uuid NOT NULL REFERENCES time_learning.members(user_id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(closes_at IS NULL OR opens_at IS NULL OR closes_at>opens_at),CHECK(kind<>'test' OR duration_minutes>0)
);
CREATE INDEX IF NOT EXISTS assessments_course_idx ON time_learning.assessments(course_id,cohort_id,published);
CREATE TABLE IF NOT EXISTS time_learning.assessment_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),assessment_id uuid NOT NULL REFERENCES time_learning.assessments(id),student_id uuid NOT NULL REFERENCES time_learning.members(user_id),
 attempt_number integer NOT NULL CHECK(attempt_number BETWEEN 1 AND 10),question_snapshot jsonb NOT NULL,pass_mark integer NOT NULL CHECK(pass_mark BETWEEN 0 AND 100),
 answers jsonb NOT NULL DEFAULT '[]'::jsonb,answer_revision integer NOT NULL DEFAULT 0,started_at timestamptz NOT NULL DEFAULT now(),deadline_at timestamptz,submitted_at timestamptz,
 score numeric,passed boolean,timed_out boolean NOT NULL DEFAULT false,
 UNIQUE(assessment_id,student_id,attempt_number),CHECK(score IS NULL OR score BETWEEN 0 AND 100)
);
CREATE UNIQUE INDEX IF NOT EXISTS assessment_active_attempt_idx ON time_learning.assessment_attempts(assessment_id,student_id) WHERE submitted_at IS NULL;
CREATE INDEX IF NOT EXISTS assessment_attempt_student_idx ON time_learning.assessment_attempts(student_id,assessment_id);
REVOKE ALL ON time_learning.lesson_completions,time_learning.assessments,time_learning.assessment_attempts FROM PUBLIC;
