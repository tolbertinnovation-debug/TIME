CREATE TABLE IF NOT EXISTS time_learning.lessons (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 course_id text NOT NULL,
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
 content text NOT NULL CHECK(length(content) BETWEEN 1 AND 40000),
 resources jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(resources)='array' AND jsonb_array_length(resources)<=10),
 published boolean NOT NULL DEFAULT false,
 file_name text,file_type text,file_data bytea CHECK(octet_length(file_data)<=2097152),
 created_by uuid NOT NULL REFERENCES time_learning.members(user_id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lessons_course_published_idx ON time_learning.lessons(course_id,published,created_at);
REVOKE ALL ON time_learning.lessons FROM PUBLIC;
