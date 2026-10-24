BEGIN;
ALTER TABLE time_learning.members ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false;
ALTER TABLE time_learning.teaching ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE time_learning.enrollments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved' CHECK(status IN ('pending','approved','declined'));
ALTER TABLE time_learning.enrollments ADD COLUMN IF NOT EXISTS cohort text NOT NULL DEFAULT 'Cohort #1' CHECK(length(cohort) BETWEEN 1 AND 80);
CREATE INDEX IF NOT EXISTS enrollments_status_idx ON time_learning.enrollments(status,joined_at);
COMMIT;
