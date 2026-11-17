import Link from "next/link";
import { postAnnouncementAction } from "@/app/teaching-actions";
import { TeachNav } from "@/components/learning";
import { Notices } from "@/components/notice";
import { MODE_LABEL, TRACK_LABEL } from "@/lib/academics";
import { requireClassStaff } from "@/lib/class-access";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { attentionReasons, LESSON_GRACE_DAYS } from "@/lib/attention";
import { classCan } from "@/lib/permissions";
import { attendancePercent, summarise } from "@/lib/progress";

export const metadata = { title: "Class" };

export default async function TeachClass({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const { access, cls } = await requireClassStaff(id);
  const [enrolments, lessons, announcements, overdue] = await Promise.all([
    prisma.enrolment.findMany({ where: { classId: id, status: "ACTIVE" }, include: { user: true, progress: true, attendance: true }, orderBy: { user: { name: "asc" } } }),
    prisma.lesson.findMany({ where: { status: "PUBLISHED", module: { courseId: cls.courseId } }, orderBy: [{ module: { sort: "asc" } }, { sort: "asc" }] }),
    prisma.announcement.findMany({ where: { classId: id }, orderBy: { createdAt: "desc" }, take: 10, include: { author: true } }),
    // Work students hand in themselves whose due date has passed (not paper exams the lecturer enters).
    prisma.assessment.findMany({ where: { classId: id, status: { not: "DRAFT" }, kind: { not: "OFFLINE" }, dueAt: { lt: new Date() } }, select: { submissions: { where: { OR: [{ submittedAt: { not: null } }, { score: { not: null } }] }, select: { enrolmentId: true } } } }),
  ]);
  // Lessons published at least a week ago are the ones a student should have done by now.
  const cutoff = new Date(Date.now() - LESSON_GRACE_DAYS * 24 * 60 * 60 * 1000);
  const expected = new Set(lessons.filter((l) => l.kind === "ONLINE" && l.publishedAt && l.publishedAt <= cutoff).map((l) => l.id));
  const reasons = new Map(enrolments.map((e) => [e.id, attentionReasons({
    attendance: e.attendance.map((a) => a.status),
    lessonsExpected: expected.size,
    lessonsDone: e.progress.filter((x) => expected.has(x.lessonId)).length,
    missedWork: overdue.filter((a) => !a.submissions.some((s) => s.enrolmentId === e.id)).length,
  })]));
  const flagged = enrolments.filter((e) => reasons.get(e.id)!.length > 0).length;
  const practicals = lessons.filter((l) => l.kind === "PRACTICAL");
  return (
    <div className="stack lg">
      <div className="stack">
        <p className="small"><Link href={access === "ADMIN" ? `/admin/classes/${id}` : "/teach"}>{access === "ADMIN" ? "Class administration" : "My classes"}</Link></p>
        <h1>{cls.course.title}</h1>
        <p className="muted">{cls.intake.name} · {TRACK_LABEL[cls.track]} · {MODE_LABEL[cls.mode]}{cls.studyCentre ? ` · ${cls.studyCentre.name}` : ""}</p>
        <TeachNav classId={id} access={access} />
        <Notices params={await searchParams} />
      </div>

      <section className="stack" aria-labelledby="roster-h">
        <h2 id="roster-h">Students ({enrolments.length})</h2>
        {enrolments.length > 0 && (flagged > 0
          ? <p className="notice info" role="status">{flagged} {flagged === 1 ? "student needs" : "students need"} your attention. The last column says why.</p>
          : <p className="small muted">No student is flagged for low attendance, falling behind on lessons or missed work.</p>)}
        <div className="table-wrap"><table>
          <thead><tr><th>Student</th><th>Student number</th><th>Phone</th><th>Online lessons</th><th>Practical</th><th>Attendance</th><th>Needs attention</th></tr></thead>
          <tbody>
            {enrolments.map((e) => {
              const p = summarise(lessons, new Set(e.progress.map((x) => x.lessonId)));
              const att = attendancePercent(e.attendance.map((a) => a.status));
              return (
                <tr key={e.id}>
                  <td>{e.user.name}</td>
                  <td className="nowrap">{e.user.studentNumber ?? "—"}</td>
                  <td className="nowrap">{e.user.phone ?? "—"}</td>
                  <td className="nowrap">{p.onlineDone} of {p.onlineTotal}</td>
                  <td className="nowrap">{p.practicalDone} of {p.practicalTotal}</td>
                  <td className="nowrap">{att === null ? "—" : `${att}%`}</td>
                  <td>{reasons.get(e.id)!.length ? <span className="stack" style={{ gap: 4, alignItems: "flex-start" }}>{reasons.get(e.id)!.map((r) => <span className="pill bad" key={r}>{r}</span>)}</span> : <span className="muted">—</span>}</td>
                </tr>
              );
            })}
            {enrolments.length === 0 && <tr><td colSpan={7}>No students are enrolled yet.</td></tr>}
          </tbody>
        </table></div>
      </section>

      {practicals.length > 0 && (
        <section className="stack" aria-labelledby="practical-h">
          <h2 id="practical-h">Practical work to sign off</h2>
          <ul className="card lesson-list">
            {practicals.map((l) => (
              <li key={l.id}><span>{l.title}</span><Link className="btn ghost sm" href={`/teach/${id}/practical/${l.id}`}>Sign off students</Link></li>
            ))}
          </ul>
        </section>
      )}

      <section className="stack" aria-labelledby="ann-h">
        <h2 id="ann-h">Announcements</h2>
        {announcements.map((a) => (
          <article className="card stack" key={a.id} style={{ gap: 6 }}>
            <h3>{a.title}</h3><p style={{ whiteSpace: "pre-line" }}>{a.body}</p>
            <p className="small muted">{a.author?.name ?? "A removed account"} · {formatDateTime(a.createdAt)}</p>
          </article>
        ))}
        {announcements.length === 0 && <p className="muted">Nothing has been posted to this class yet.</p>}
        {classCan(access, "announcements.post") && (
          <form className="card form" action={postAnnouncementAction}>
            <input type="hidden" name="classId" value={id} />
            <div className="field"><label htmlFor="ann-title">Title</label><input id="ann-title" name="title" type="text" required maxLength={120} /></div>
            <div className="field"><label htmlFor="ann-body">Message to the class</label><textarea id="ann-body" name="body" required maxLength={2000} /></div>
            <div><button className="btn" type="submit">Post announcement</button></div>
          </form>
        )}
      </section>
    </div>
  );
}
