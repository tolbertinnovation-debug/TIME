CREATE TABLE IF NOT EXISTS time_learning.attendance (
 session_id uuid NOT NULL REFERENCES time_learning.sessions(id),
 student_id uuid NOT NULL REFERENCES time_learning.members(user_id),
 status text NOT NULL CHECK(status IN('present','late','absent','excused','unrecorded')),
 note text NOT NULL DEFAULT '' CHECK(length(note)<=1000),
 recorded_by uuid NOT NULL REFERENCES time_learning.members(user_id),
 updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(session_id,student_id)
);
CREATE INDEX IF NOT EXISTS attendance_student_idx ON time_learning.attendance(student_id,updated_at DESC);
REVOKE ALL ON time_learning.attendance FROM PUBLIC;
