import Link from "next/link";
import { notFound } from "next/navigation";
import { markAction } from "@/app/assessment-actions";
import { LessonBody } from "@/components/learning";
import { Notices } from "@/components/notice";
import { requireClassStaff } from "@/lib/class-access";
import { prisma } from "@/lib/db";

export const metadata = { title: "Mark work" };

export default async function Mark({ params, searchParams }: { params: Promise<{ id: string; aid: string; enrolmentId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id, aid, enrolmentId } = await params;
  await requireClassStaff(id, "assessments.manage");
  const [a, enrolment] = await Promise.all([
    prisma.assessment.findFirst({ where: { id: aid, classId: id, kind: { not: "QUIZ" } } }),
    prisma.enrolment.findFirst({ where: { id: enrolmentId, classId: id, status: "ACTIVE" }, include: { user: true } }),
  ]);
  if (!a || !enrolment) notFound();
  const sub = await prisma.submission.findUnique({ where: { assessmentId_enrolmentId: { assessmentId: aid, enrolmentId } } });
  const marked = sub?.score !== null && sub?.score !== undefined;
  return (
    <div className="stack lg" style={{ maxWidth: 760 }}>
      <div className="stack">
        <p className="small"><Link href={`/teach/${id}/assessments/${aid}`}>{a.title}</Link></p>
        <h1>{enrolment.user.name}</h1>
        <p className="muted">{enrolment.user.studentNumber ?? ""} · {a.title} · out of {a.maxScore}</p>
        <Notices params={await searchParams} />
      </div>
      {a.kind === "WRITTEN" && (
        <section className="card stack" aria-labelledby="answer-h">
          <h2 id="answer-h">The student's answer</h2>
          {sub?.text ? <LessonBody text={sub.text} /> : <p className="muted">Nothing has been handed in.</p>}
          {sub?.link && <p className="small">Link from the student: <a href={sub.link} target="_blank" rel="noopener noreferrer">{sub.link}</a></p>}
        </section>
      )}
      <form className="card form" action={markAction}>
        <input type="hidden" name="classId" value={id} /><input type="hidden" name="assessmentId" value={aid} /><input type="hidden" name="enrolmentId" value={enrolmentId} />
        <div className="field"><label htmlFor="score">Marks out of {a.maxScore}</label><input id="score" name="score" type="text" inputMode="decimal" required maxLength={6} defaultValue={marked ? String(sub!.score) : ""} /></div>
        <div className="field"><label htmlFor="feedback">Feedback for the student <span className="muted">(optional)</span></label><textarea id="feedback" name="feedback" maxLength={2000} defaultValue={sub?.feedback ?? ""} /></div>
        {marked && <div className="field"><label htmlFor="reason">Reason for changing the mark</label><input id="reason" name="reason" type="text" maxLength={500} aria-describedby="reason-hint" /><span className="hint" id="reason-hint">Needed if the mark changes. It is recorded in the activity log.</span></div>}
        <div><button className="btn" type="submit">Save mark</button></div>
      </form>
    </div>
  );
}
