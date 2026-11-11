CREATE TABLE IF NOT EXISTS time_learning.announcements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),course_id text NOT NULL,
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
 content text NOT NULL CHECK(length(content) BETWEEN 1 AND 8000),
 published boolean NOT NULL DEFAULT false,
 created_by uuid NOT NULL REFERENCES time_learning.members(user_id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS announcements_course_published_idx ON time_learning.announcements(course_id,published,updated_at DESC);
REVOKE ALL ON time_learning.announcements FROM PUBLIC;
