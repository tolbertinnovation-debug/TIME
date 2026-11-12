import Link from "next/link";
import { KindPill, ProgressBar } from "@/components/learning";
import { Notices } from "@/components/notice";
import { MODE_LABEL, TRACK_LABEL } from "@/lib/academics";
import { requireEnrolment } from "@/lib/class-access";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { attendancePercent, summarise } from "@/lib/progress";

export const metadata = { title: "Class" };

export default async function LearnClass({ params, searchParams }: { params: Promise<{ classId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { classId } = await params;
  const { enrolment, cls } = await requireEnrolment(classId);
  const [modules, progress, sessions, attendance, announcements] = await Promise.all([
    // Students only ever see published lessons.
    prisma.module.findMany({ where: { courseId: cls.courseId }, orderBy: { sort: "asc" }, include: { lessons: { where: { status: "PUBLISHED" }, orderBy: { sort: "asc" } } } }),
    prisma.lessonProgress.findMany({ where: { enrolmentId: enrolment.id } }),
    prisma.classSession.findMany({ where: { classId, startsAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) } }, orderBy: { startsAt: "asc" }, take: 5 }),
    prisma.attendance.findMany({ where: { enrolmentId: enrolment.id } }),
    prisma.announcement.findMany({ where: { classId }, orderBy: { createdAt: "desc" }, take: 5, include: { author: true } }),
  ]);
  const done = new Set(progress.map((p) => p.lessonId));
  const lessons = modules.flatMap((m) => m.lessons);
  const summary = summarise(lessons, done);
  const att = attendancePercent(attendance.map((a) => a.status));
  const next = lessons.find((l) => l.kind === "ONLINE" && !done.has(l.id));
  return (
    <div className="stack lg">
      <div className="stack">
        <p className="small"><Link href="/my-classes">My classes</Link></p>
        <h1>{cls.course.title}</h1>
        <p className="muted">{cls.intake.name} · {TRACK_LABEL[cls.track]} · {MODE_LABEL[cls.mode]}{cls.studyCentre ? ` · ${cls.studyCentre.name}` : ""}</p>
        <Notices params={await searchParams} />
      </div>

      <section className="card stack" aria-labelledby="progress-h">
        <div className="row between"><h2 id="progress-h">Your progress</h2><strong>{summary.percent}%</strong></div>
        <ProgressBar progress={summary} />
        <p className="small muted">Attendance: {att === null ? "not recorded yet" : `${att}% of sessions`}</p>
        {next && <div><Link className="btn" href={`/learn/${classId}/${next.id}`}>Continue: {next.title}</Link></div>}
      </section>

      {announcements.length > 0 && (
        <section className="stack" aria-labelledby="ann-h">
          <h2 id="ann-h">Announcements</h2>
          {announcements.map((a) => (
            <article className="card stack" key={a.id} style={{ gap: 6 }}>
              <h3>{a.title}</h3><p style={{ whiteSpace: "pre-line" }}>{a.body}</p>
              <p className="small muted">{a.author?.name ?? "TIME"} · {formatDateTime(a.createdAt)}</p>
            </article>
          ))}
        </section>
      )}

      {sessions.length > 0 && (
        <section className="stack" aria-labelledby="sessions-h">
          <h2 id="sessions-h">Coming sessions</h2>
          <ul className="card lesson-list">
            {sessions.map((s) => (
              <li key={s.id}>
                <span><strong>{s.title}</strong><br /><span className="muted small">{formatDateTime(s.startsAt)} (Liberia time)</span></span>
                <span className="row"><KindPill kind={s.kind} />{s.meetingUrl && <a className="btn ghost sm" href={s.meetingUrl} target="_blank" rel="noopener noreferrer">Join</a>}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="stack" aria-labelledby="lessons-h">
        <h2 id="lessons-h">Lessons</h2>
        {lessons.length === 0 && <p className="card">Your lecturer has not published lessons yet. They will appear here.</p>}
        {modules.filter((m) => m.lessons.length > 0).map((m) => (
          <div className="card stack" key={m.id} style={{ gap: 4 }}>
            <h3>{m.title}</h3>
            <ul className="lesson-list">
              {m.lessons.map((l) => (
                <li key={l.id}>
                  <Link href={`/learn/${classId}/${l.id}`}>{l.title}</Link>
                  <span className="row">{l.minutes ? <span className="muted small">{l.minutes} min</span> : null}<KindPill kind={l.kind} />{done.has(l.id) ? <span className="done">Done</span> : <span className="muted small">To do</span>}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
