CREATE TABLE IF NOT EXISTS time_learning.cohorts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL UNIQUE CHECK(length(name) BETWEEN 1 AND 80),
 starts_on date, ends_on date,
 status text NOT NULL DEFAULT 'planned' CHECK(status IN('planned','active','completed','archived')),
 course_ids text[] NOT NULL CHECK(cardinality(course_ids) BETWEEN 1 AND 8),
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
 created_by uuid NOT NULL REFERENCES time_learning.members(user_id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_on IS NULL OR starts_on IS NULL OR ends_on>=starts_on)
);
ALTER TABLE time_learning.enrollments ADD COLUMN IF NOT EXISTS cohort_id uuid REFERENCES time_learning.cohorts(id);
CREATE INDEX IF NOT EXISTS enrollments_cohort_idx ON time_learning.enrollments(cohort_id,user_id);
CREATE INDEX IF NOT EXISTS audit_created_idx ON time_learning.audit(created_at DESC,id DESC);
REVOKE ALL ON time_learning.cohorts FROM PUBLIC;
