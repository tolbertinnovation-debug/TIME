BEGIN;
CREATE SCHEMA IF NOT EXISTS time_learning;
CREATE TABLE IF NOT EXISTS time_learning.members (
 user_id uuid PRIMARY KEY REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
 role text NOT NULL DEFAULT 'student' CHECK(role IN ('student','lecturer','admin')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS time_learning.enrollments (
 user_id uuid NOT NULL REFERENCES time_learning.members(user_id),
 course_id text NOT NULL,
 joined_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,course_id)
);
CREATE TABLE IF NOT EXISTS time_learning.teaching (
 user_id uuid NOT NULL REFERENCES time_learning.members(user_id), course_id text NOT NULL,
 PRIMARY KEY(user_id,course_id)
);
CREATE TABLE IF NOT EXISTS time_learning.assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), course_id text NOT NULL,
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
 instructions text NOT NULL CHECK(length(instructions) BETWEEN 1 AND 12000),
 due_at timestamptz, published boolean NOT NULL DEFAULT false,
 created_by uuid NOT NULL REFERENCES time_learning.members(user_id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assignments_course_idx ON time_learning.assignments(course_id,published,created_at);
CREATE TABLE IF NOT EXISTS time_learning.submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), assignment_id uuid NOT NULL REFERENCES time_learning.assignments(id),
 student_id uuid NOT NULL REFERENCES time_learning.members(user_id),
 body text NOT NULL DEFAULT '' CHECK(length(body)<=30000),
 file_name text, file_type text, file_data bytea CHECK(octet_length(file_data)<=2097152),
 submitted_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 score numeric CHECK(score>=0 AND score<=100), feedback text CHECK(length(feedback)<=12000),
 graded_by uuid REFERENCES time_learning.members(user_id), graded_at timestamptz,
 UNIQUE(assignment_id,student_id)
);
CREATE INDEX IF NOT EXISTS submissions_student_idx ON time_learning.submissions(student_id);
CREATE TABLE IF NOT EXISTS time_learning.sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), course_id text NOT NULL,
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160), starts_at timestamptz NOT NULL,
 mode text NOT NULL CHECK(mode IN('online','in-person')), location text NOT NULL CHECK(length(location)<=1000),
 created_by uuid NOT NULL REFERENCES time_learning.members(user_id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_course_idx ON time_learning.sessions(course_id,starts_at);
CREATE TABLE IF NOT EXISTS time_learning.workspace (
 user_id uuid PRIMARY KEY REFERENCES time_learning.members(user_id), data jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(), CHECK(octet_length(data::text)<=600000)
);
CREATE TABLE IF NOT EXISTS time_learning.quotas (
 user_id uuid NOT NULL, minute timestamptz NOT NULL, requests integer NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id,minute)
);
CREATE TABLE IF NOT EXISTS time_learning.audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor uuid NOT NULL,
 action text NOT NULL, resource_id text, created_at timestamptz NOT NULL DEFAULT now()
);
-- No browser-facing database role is used. All access is checked in the API.
REVOKE ALL ON SCHEMA time_learning FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA time_learning FROM PUBLIC;
COMMIT;
