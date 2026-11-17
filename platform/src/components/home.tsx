import Link from "next/link";
import { KindPill, ProgressBar } from "@/components/learning";
import { formatDateTime } from "@/lib/format";
import { CATEGORY_LABEL } from "@/lib/grading";
import type { studentAgenda, teachingAgenda } from "@/lib/home";
import { dayDistance } from "@/lib/progress";
import { meetingService } from "@/lib/video";

type StudentClass = Awaited<ReturnType<typeof studentAgenda>>[number];
type TeachingClass = Awaited<ReturnType<typeof teachingAgenda>>[number];
type Session = StudentClass["sessions"][number];

function Sessions({ sessions, now }: { sessions: Session[]; now: Date }) {
  if (!sessions.length) return null;
  return (
    <div className="agenda-block">
      <h3>Coming sessions</h3>
      <ul className="agenda-list">
        {sessions.map((s) => (
          <li key={s.id}>
            <span><strong>{s.title}</strong><br /><span className="small muted">{formatDateTime(s.startsAt)} · {dayDistance(s.startsAt, now)}</span></span>
            <span className="row"><KindPill kind={s.kind} />{s.meetingUrl && <a className="btn ghost sm" href={s.meetingUrl} target="_blank" rel="noopener noreferrer">Join{meetingService(s.meetingUrl) ? ` on ${meetingService(s.meetingUrl)}` : ""}</a>}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// A student's classes: where they are, what comes next and what is due.
export function StudentHome({ classes }: { classes: StudentClass[] }) {
  const now = new Date();
  return (
    <section className="stack" aria-labelledby="learning-h">
      <h2 id="learning-h">Your learning</h2>
      {classes.map((c) => (
        <article className="card stack agenda" key={c.classId}>
          <div className="row between">
            <h3 className="agenda-title"><Link href={c.hasAccess ? `/learn/${c.classId}` : "/fees"}>{c.title}</Link></h3>
            {c.hasAccess && <strong>{c.progress.percent}%</strong>}
          </div>
          {!c.hasAccess ? (
            <p className="notice info">This class opens when your fees allow it. <Link href="/fees">See your fees</Link>.</p>
          ) : (
            <>
              <ProgressBar progress={c.progress} />
              {c.nextLesson ? (
                <div className="agenda-next">
                  <span><span className="eyebrow">Next lesson</span><br /><strong>{c.nextLesson.title}</strong>{c.nextLesson.minutes ? <span className="muted small"> · {c.nextLesson.minutes} min</span> : null}</span>
                  <Link className="btn" href={`/learn/${c.classId}/${c.nextLesson.id}`}>Continue</Link>
                </div>
              ) : (
                <p className="muted small">{c.lessonCount === 0 ? "Your lecturer has not published lessons yet." : "You have completed every online lesson published so far."}</p>
              )}
              {c.toDo.length > 0 && (
                <div className="agenda-block">
                  <h3>To hand in</h3>
                  <ul className="agenda-list">
                    {c.toDo.map((a) => {
                      const late = a.dueAt !== null && a.dueAt < now;
                      return (
                        <li key={a.id}>
                          <span><Link href={`/learn/${c.classId}/assess/${a.id}`}>{a.title}</Link><br /><span className="small muted">{CATEGORY_LABEL[a.category]}</span></span>
                          {a.dueAt ? <span className={`pill ${late ? "bad" : "wait"}`}>{late ? "Was due" : "Due"} {dayDistance(a.dueAt, now)}</span> : <span className="pill plain">No due date</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              <Sessions sessions={c.sessions} now={now} />
            </>
          )}
        </article>
      ))}
    </section>
  );
}

// A lecturer's or facilitator's classes: work waiting and sessions coming.
export function TeachingHome({ classes, marks }: { classes: TeachingClass[]; marks: boolean }) {
  const now = new Date();
  return (
    <section className="stack" aria-labelledby="teaching-h">
      <h2 id="teaching-h">Your classes</h2>
      {classes.map((c) => (
        <article className="card stack agenda" key={c.classId}>
          <div className="row between">
            <h3 className="agenda-title"><Link href={`/teach/${c.classId}`}>{c.title}</Link></h3>
            <span className="small muted">{c.students} {c.students === 1 ? "student" : "students"}</span>
          </div>
          <p className="small muted" style={{ marginTop: -10 }}>{c.label}</p>
          {marks && (c.toMark > 0 ? (
            <div className="agenda-next">
              <span><span className="eyebrow">To mark</span><br /><strong>{c.toMark} {c.toMark === 1 ? "piece of work is" : "pieces of work are"} waiting for a mark</strong></span>
              <Link className="btn" href={`/teach/${c.classId}/assessments`}>Mark work</Link>
            </div>
          ) : <p className="muted small">No work is waiting to be marked.</p>)}
          <Sessions sessions={c.sessions} now={now} />
          {c.sessions.length === 0 && <p className="muted small">No sessions in the next two weeks. <Link href={`/teach/${c.classId}/sessions`}>Add a session</Link>.</p>}
        </article>
      ))}
    </section>
  );
}
