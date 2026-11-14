import Link from "next/link";
import { notFound } from "next/navigation";
import { submitEvaluationAction } from "@/app/learning-actions";
import { Notices } from "@/components/notice";
import { classLabel } from "@/lib/academics";
import { prisma } from "@/lib/db";
import { canEvaluate, QUESTIONS, SCALE } from "@/lib/evaluation";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Evaluate this course" };

export default async function Evaluate({ params, searchParams }: { params: Promise<{ classId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const { classId } = await params;
  const enrolment = await prisma.enrolment.findUnique({ where: { userId_classId: { userId: user.id, classId } }, include: { result: true, class: { include: { course: true, intake: true } } } });
  if (!enrolment || (enrolment.status !== "ACTIVE" && enrolment.status !== "COMPLETED")) notFound();
  const open = canEvaluate(enrolment.class.status, enrolment.result?.status === "PUBLISHED");
  return (
    <div className="stack lg" style={{ maxWidth: 680 }}>
      <div className="stack">
        <p className="small"><Link href="/my-classes">My classes</Link></p>
        <h1>Evaluate this course</h1>
        <p className="muted">{classLabel(enrolment.class)}</p>
        <Notices params={await searchParams} />
      </div>
      {enrolment.evaluatedAt ? (
        <p className="notice ok">Thank you. Your evaluation has been handed in. It was stored without your name.</p>
      ) : !open ? (
        <p className="card">You can evaluate this course when the class has ended or your result has been published.</p>
      ) : (
        <form className="form card stack" action={submitEvaluationAction}>
          <input type="hidden" name="classId" value={classId} />
          <p><strong>Your answers are anonymous.</strong> They are stored without your name, and your lecturer sees only a summary once at least three students have answered. Please be honest: it helps TIME teach the next class better. You can hand in one evaluation, and it cannot be changed afterwards.</p>
          {QUESTIONS.map((q) => (
            <fieldset key={q.key} style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontWeight: 700, padding: 0 }}>{q.label}</legend>
              {q.hint && <p className="small muted">{q.hint}</p>}
              <div className="row" style={{ marginTop: 6 }}>
                {SCALE.map((o) => (
                  <label key={o.value} className="row" style={{ gap: 6, minHeight: 44 }}>
                    <input type="radio" name={q.key} value={o.value} required style={{ width: "auto", minHeight: 0 }} /> {o.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="field"><label htmlFor="wentWell">What went well? (optional)</label><textarea id="wentWell" name="wentWell" maxLength={1000} /></div>
          <div className="field"><label htmlFor="improve">What should be improved? (optional)</label><textarea id="improve" name="improve" maxLength={1000} /></div>
          <p className="small muted">Do not put your name or anything that identifies you in the comments.</p>
          <div><button className="btn" type="submit">Hand in evaluation</button></div>
        </form>
      )}
    </div>
  );
}
