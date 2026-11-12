import Link from "next/link";
import { createAssessmentAction } from "@/app/assessment-actions";
import { TeachNav } from "@/components/learning";
import { Notices } from "@/components/notice";
import { requireClassStaff } from "@/lib/class-access";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { CATEGORIES, CATEGORY_LABEL, WEIGHTS } from "@/lib/grading";

export const metadata = { title: "Assessments" };

const KIND = { WRITTEN: "Written work", QUIZ: "Quiz", OFFLINE: "On paper or in person" } as const;
const STATUS = { DRAFT: ["plain", "Draft"], OPEN: ["ok", "Open"], CLOSED: ["bad", "Closed"] } as const;

export default async function Assessments({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const { access, cls } = await requireClassStaff(id, "assessments.manage");
  const assessments = await prisma.assessment.findMany({ where: { classId: id }, orderBy: { createdAt: "asc" }, include: { submissions: true } });
  return (
    <div className="stack lg">
      <div className="stack">
        <p className="small"><Link href={`/teach/${id}`}>{cls.course.title}</Link></p>
        <h1>Assessments</h1>
        <p className="muted">Each assessment counts toward one part of the grade. A part's points are shared across all the assessments in it.</p>
        <TeachNav classId={id} access={access} />
        <Notices params={await searchParams} />
      </div>
      {CATEGORIES.map((c) => {
        const items = assessments.filter((a) => a.category === c);
        return (
          <section className="stack" key={c} aria-label={CATEGORY_LABEL[c]}>
            <h2>{CATEGORY_LABEL[c]} <span className="muted small">· {WEIGHTS[c]} points</span></h2>
            <div className="table-wrap"><table>
              <thead><tr><th>Assessment</th><th>How</th><th>Out of</th><th>Due</th><th>Handed in</th><th>Status</th></tr></thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id}>
                    <td><Link href={`/teach/${id}/assessments/${a.id}`}><strong>{a.title}</strong></Link></td>
                    <td>{KIND[a.kind]}{a.timeLimitMinutes ? ` · ${a.timeLimitMinutes} min` : ""}</td>
                    <td>{a.maxScore}</td>
                    <td className="nowrap">{a.dueAt ? formatDateTime(a.dueAt) : "—"}</td>
                    <td>{a.submissions.filter((s) => s.submittedAt).length}</td>
                    <td><span className={`pill ${STATUS[a.status][0]}`}>{STATUS[a.status][1]}</span></td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={6}>Nothing set for this part yet.</td></tr>}
              </tbody>
            </table></div>
          </section>
        );
      })}
      <form className="card form" action={createAssessmentAction}>
        <h2>Set an assessment</h2>
        <input type="hidden" name="classId" value={id} />
        <div className="field"><label htmlFor="a-title">Title</label><input id="a-title" name="title" type="text" required maxLength={140} placeholder="Week 2 quiz" /></div>
        <div className="grid">
          <div className="field"><label htmlFor="a-category">Counts toward</label><select id="a-category" name="category" required>{CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]} ({WEIGHTS[c]} points)</option>)}</select></div>
          <div className="field"><label htmlFor="a-kind">How students take it</label><select id="a-kind" name="kind" required>
            <option value="WRITTEN">Written work, handed in online</option>
            <option value="QUIZ">Quiz, marked automatically</option>
            <option value="OFFLINE">On paper or in person; you enter the marks</option>
          </select></div>
          <div className="field"><label htmlFor="a-max">Out of <span className="muted">(not for quizzes)</span></label><input id="a-max" name="maxScore" type="text" inputMode="numeric" maxLength={4} placeholder="100" /></div>
          <div className="field"><label htmlFor="a-due">Due <span className="muted">(optional)</span></label><input id="a-due" name="dueAt" type="datetime-local" /></div>
          <div className="field"><label htmlFor="a-limit">Time limit in minutes <span className="muted">(quizzes, optional)</span></label><input id="a-limit" name="timeLimitMinutes" type="text" inputMode="numeric" maxLength={3} /></div>
        </div>
        <div className="field"><label htmlFor="a-instructions">Instructions for students</label><textarea id="a-instructions" name="instructions" required maxLength={4000} /></div>
        <div><button className="btn" type="submit">Create assessment</button></div>
      </form>
    </div>
  );
}
