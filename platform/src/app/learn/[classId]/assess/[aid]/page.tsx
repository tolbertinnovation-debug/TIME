import Link from "next/link";
import { notFound } from "next/navigation";
import { startQuizAction, submitQuizAction, submitWrittenAction } from "@/app/assessment-actions";
import { Notices } from "@/components/notice";
import { requireEnrolment } from "@/lib/class-access";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { CATEGORY_LABEL, quizDeadline } from "@/lib/grading";

export const metadata = { title: "Assessment" };

export default async function TakeAssessment({ params, searchParams }: { params: Promise<{ classId: string; aid: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { classId, aid } = await params;
  const { enrolment, cls } = await requireEnrolment(classId);
  // Drafts are invisible to students. The correct answers are never selected here.
  const a = await prisma.assessment.findFirst({
    where: { id: aid, classId, status: { not: "DRAFT" } },
    include: { questions: { orderBy: { sort: "asc" }, select: { id: true, text: true, options: true, points: true } } },
  });
  if (!a) notFound();
  const sub = await prisma.submission.findUnique({ where: { assessmentId_enrolmentId: { assessmentId: aid, enrolmentId: enrolment.id } } });
  const open = a.status === "OPEN" && (!a.dueAt || a.dueAt > new Date()) && enrolment.status === "ACTIVE";
  const marked = sub?.score !== null && sub?.score !== undefined;
  const deadline = sub && !sub.submittedAt ? quizDeadline(sub.startedAt, a.timeLimitMinutes) : null;
  const hidden = <><input type="hidden" name="classId" value={classId} /><input type="hidden" name="assessmentId" value={aid} /></>;
  return (
    <div className="stack lg" style={{ maxWidth: 760 }}>
      <div className="stack">
        <p className="small"><Link href={`/learn/${classId}`}>{cls.course.title}</Link></p>
        <h1>{a.title}</h1>
        <p className="muted">{CATEGORY_LABEL[a.category]} · out of {a.maxScore}{a.dueAt ? ` · due ${formatDateTime(a.dueAt)} (Liberia time)` : ""}{a.timeLimitMinutes ? ` · ${a.timeLimitMinutes} minute time limit` : ""}</p>
        <Notices params={await searchParams} />
        <p style={{ whiteSpace: "pre-line" }}>{a.instructions}</p>
      </div>

      {marked && (
        <section className="card stack" aria-labelledby="mark-h">
          <h2 id="mark-h">Your mark: {sub!.score} of {a.maxScore}</h2>
          {sub!.feedback && <p style={{ whiteSpace: "pre-line" }}>{sub!.feedback}</p>}
        </section>
      )}

      {a.kind === "OFFLINE" && !marked && <p className="card">This assessment is taken on paper or in person. Your lecturer enters your mark afterwards.</p>}

      {a.kind === "WRITTEN" && !marked && (open ? (
        <form className="card form" action={submitWrittenAction}>
          {hidden}
          <div className="field"><label htmlFor="text">Your answer</label><textarea id="text" name="text" required minLength={20} maxLength={20000} rows={12} defaultValue={sub?.text ?? ""} /></div>
          <div className="field"><label htmlFor="link">Link to your file <span className="muted">(optional)</span></label><input id="link" name="link" type="text" inputMode="url" maxLength={500} placeholder="https://" defaultValue={sub?.link ?? ""} /></div>
          <div><button className="btn" type="submit">{sub?.submittedAt ? "Hand in again" : "Hand in"}</button></div>
          {sub?.submittedAt && <p className="small muted">Handed in {formatDateTime(sub.submittedAt)}. You can change it until it is marked.</p>}
        </form>
      ) : <p className="card">{sub?.submittedAt ? `You handed this in on ${formatDateTime(sub.submittedAt)}. It is waiting to be marked.` : "This assessment is closed."}</p>)}

      {a.kind === "QUIZ" && !sub && (open ? (
        <form className="card form" action={startQuizAction}>
          {hidden}
          <p>{a.questions.length} {a.questions.length === 1 ? "question" : "questions"}. You can take this quiz once.{a.timeLimitMinutes ? ` When you start, you have ${a.timeLimitMinutes} minutes to hand it in.` : ""}</p>
          <div><button className="btn" type="submit">Start the quiz</button></div>
        </form>
      ) : <p className="card">This quiz is closed.</p>)}

      {a.kind === "QUIZ" && sub && !sub.submittedAt && (
        <form className="form" action={submitQuizAction}>
          {hidden}
          {deadline && <p className="notice info">Hand in by {formatDateTime(deadline)} (Liberia time). Answers handed in late get no marks.</p>}
          {a.questions.map((q, i) => (
            <fieldset className="card stack" key={q.id} style={{ gap: 8 }}>
              <legend className="label">{i + 1}. {q.text} <span className="muted small">({q.points} {q.points === 1 ? "mark" : "marks"})</span></legend>
              {q.options.map((o, n) => (
                <label key={n} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}><input type="radio" name={`q-${q.id}`} value={n} /> <span>{o}</span></label>
              ))}
            </fieldset>
          ))}
          <div><button className="btn" type="submit">Hand in quiz</button></div>
        </form>
      )}
    </div>
  );
}
