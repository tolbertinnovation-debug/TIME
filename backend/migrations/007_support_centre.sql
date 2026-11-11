CREATE TABLE IF NOT EXISTS time_learning.support_tickets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 requester_id uuid NOT NULL REFERENCES time_learning.members(user_id),
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
 category text NOT NULL CHECK(category IN('account','coursework','classes','technical','other')),
 course_id text,
 status text NOT NULL DEFAULT 'open' CHECK(status IN('open','in-progress','resolved')),
 assigned_to uuid REFERENCES time_learning.members(user_id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS time_learning.support_messages (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 ticket_id uuid NOT NULL REFERENCES time_learning.support_tickets(id),
 author_id uuid NOT NULL REFERENCES time_learning.members(user_id),
 staff_reply boolean NOT NULL DEFAULT false,
 content text NOT NULL CHECK(length(content) BETWEEN 1 AND 4000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_requester_idx ON time_learning.support_tickets(requester_id,updated_at DESC,id);
CREATE INDEX IF NOT EXISTS support_status_idx ON time_learning.support_tickets(status,updated_at DESC,id);
CREATE INDEX IF NOT EXISTS support_thread_idx ON time_learning.support_messages(ticket_id,id);
REVOKE ALL ON time_learning.support_tickets,time_learning.support_messages FROM PUBLIC;
