import Link from "next/link";
import { notFound } from "next/navigation";
import { addQuestionAction, deleteQuestionAction, resetAttemptAction, setAssessmentStatusAction } from "@/app/assessment-actions";
import { Notices } from "@/components/notice";
import { requireClassStaff } from "@/lib/class-access";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { CATEGORY_LABEL } from "@/lib/grading";

export const metadata = { title: "Assessment" };

const STATUS = { DRAFT: ["plain", "Draft"], OPEN: ["ok", "Open"], CLOSED: ["bad", "Closed"] } as const;

export default async function AssessmentPage({ params, searchParams }: { params: Promise<{ id: string; aid: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id, aid } = await params;
  await requireClassStaff(id, "assessments.manage");
  const a = await prisma.assessment.findFirst({ where: { id: aid, classId: id }, include: { questions: { orderBy: { sort: "asc" } }, submissions: true } });
  if (!a) notFound();
  const enrolments = await prisma.enrolment.findMany({ where: { classId: id, status: "ACTIVE" }, include: { user: true }, orderBy: { user: { name: "asc" } } });
  const subs = new Map(a.submissions.map((s) => [s.enrolmentId, s]));
  const hidden = <><input type="hidden" name="classId" value={id} /><input type="hidden" name="assessmentId" value={aid} /></>;
  return (
    <div className="stack lg">
      <div className="stack">
        <p className="small"><Link href={`/teach/${id}/assessments`}>Assessments</Link></p>
        <div className="row between"><h1>{a.title}</h1><span className={`pill ${STATUS[a.status][0]}`}>{STATUS[a.status][1]}</span></div>
        <p className="muted">{CATEGORY_LABEL[a.category]} · out of {a.maxScore}{a.timeLimitMinutes ? ` · ${a.timeLimitMinutes} minute limit` : ""}{a.dueAt ? ` · due ${formatDateTime(a.dueAt)}` : ""}</p>
        <Notices params={await searchParams} />
        <p style={{ whiteSpace: "pre-line" }}>{a.instructions}</p>
        <div className="row">
          {a.status !== "OPEN" && <form action={setAssessmentStatusAction}>{hidden}<input type="hidden" name="status" value="OPEN" /><button className="btn sm" type="submit">{a.status === "DRAFT" ? "Open to students" : "Open again"}</button></form>}
          {a.status === "OPEN" && <form action={setAssessmentStatusAction}>{hidden}<input type="hidden" name="status" value="CLOSED" /><button className="btn ghost sm" type="submit">Close</button></form>}
        </div>
      </div>

      {a.kind === "QUIZ" && (
        <section className="stack" aria-labelledby="questions-h">
          <h2 id="questions-h">Questions ({a.questions.length})</h2>
          {a.questions.map((q, i) => (
            <div className="card stack" key={q.id} style={{ gap: 6 }}>
              <div className="row between"><h3>{i + 1}. {q.text}</h3><span className="muted small">{q.points} {q.points === 1 ? "mark" : "marks"}</span></div>
              <ol style={{ margin: 0, paddingLeft: 22 }}>{q.options.map((o, n) => <li key={n}>{o}{n === q.correctIndex && <span className="pill ok" style={{ marginLeft: 8 }}>Correct</span>}</li>)}</ol>
              {a.status === "DRAFT" && <form action={deleteQuestionAction}>{hidden}<input type="hidden" name="questionId" value={q.id} /><button className="btn ghost sm" type="submit">Remove question</button></form>}
            </div>
          ))}
          {a.status === "DRAFT" ? (
            <form className="card form" action={addQuestionAction}>
              <h3>Add a question</h3>
              {hidden}
              <div className="field"><label htmlFor="q-text">Question</label><textarea id="q-text" name="text" required maxLength={1000} style={{ minHeight: 60 }} /></div>
              <div className="field"><label htmlFor="q-options">Answers, one per line</label><textarea id="q-options" name="options" required rows={4} aria-describedby="q-options-hint" /><span className="hint" id="q-options-hint">Between two and six answers.</span></div>
              <div className="grid">
                <div className="field"><label htmlFor="q-correct">Number of the correct answer</label><input id="q-correct" name="correct" type="text" inputMode="numeric" required maxLength={1} placeholder="1" /></div>
                <div className="field"><label htmlFor="q-points">Marks</label><input id="q-points" name="points" type="text" inputMode="numeric" required maxLength={3} defaultValue="1" /></div>
              </div>
              <div><button className="btn ghost" type="submit">Add question</button></div>
            </form>
          ) : <p className="muted small">Questions cannot be changed once the quiz has been opened.</p>}
        </section>
      )}

      <section className="stack" aria-labelledby="work-h">
        <h2 id="work-h">Students' work</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>Student</th><th>Handed in</th><th>Mark</th><th></th></tr></thead>
          <tbody>
            {enrolments.map((e) => {
              const s = subs.get(e.id);
              return (
                <tr key={e.id}>
                  <td>{e.user.name}<br /><span className="muted small">{e.user.studentNumber ?? ""}</span></td>
                  <td className="nowrap">{s?.submittedAt ? formatDateTime(s.submittedAt) : s ? "Started, not handed in" : "—"}</td>
                  <td className="nowrap">{s?.score !== null && s?.score !== undefined ? `${s.score} of ${a.maxScore}` : s?.submittedAt ? <span className="pill wait">To mark</span> : "—"}</td>
                  <td>
                    <div className="row">
                      {a.kind !== "QUIZ" && (a.kind === "OFFLINE" || s?.submittedAt) && <Link className="btn ghost sm" href={`/teach/${id}/assessments/${aid}/mark/${e.id}`}>{s?.score !== null && s?.score !== undefined ? "Change mark" : "Mark"}</Link>}
                      {s && a.kind !== "OFFLINE" && (
                        <details>
                          <summary className="small">Let them take it again</summary>
                          <form className="inline-form" action={resetAttemptAction} style={{ marginTop: 6 }}>
                            {hidden}<input type="hidden" name="enrolmentId" value={e.id} />
                            <label className="skip" htmlFor={`reason-${e.id}`}>Reason</label>
                            <input id={`reason-${e.id}`} name="reason" type="text" required minLength={5} maxLength={500} placeholder="Reason" />
                            <button className="btn ghost sm" type="submit">Reset attempt</button>
                          </form>
                        </details>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {enrolments.length === 0 && <tr><td colSpan={4}>No students are enrolled yet.</td></tr>}
          </tbody>
        </table></div>
      </section>
    </div>
  );
}
