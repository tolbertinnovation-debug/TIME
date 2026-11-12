import Link from "next/link";
import { notFound } from "next/navigation";
import { GradebookTable } from "@/components/gradebook";
import { classLabel } from "@/lib/academics";
import { prisma } from "@/lib/db";
import { loadGradebook } from "@/lib/gradebook";
import { CATEGORY_LABEL } from "@/lib/grading";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "Review results" };

// Academic leadership reads a class's results here before deciding in the approvals inbox.
export default async function ReviewResults({ params }: { params: Promise<{ classId: string }> }) {
  await requireCapability("results.review");
  const { classId } = await params;
  const cls = await prisma.courseClass.findUnique({ where: { id: classId }, include: { course: true, intake: true } });
  if (!cls) notFound();
  const book = await loadGradebook(classId);
  return (
    <div className="stack lg">
      <div className="stack">
        <p className="small"><Link href="/admin/approvals">Approvals</Link></p>
        <h1>Results: {classLabel(cls)}</h1>
        <p className="muted">Check the results, then approve or reject them in the approvals inbox.</p>
      </div>
      <GradebookTable rows={book.rows} />
      <section className="stack" aria-labelledby="set-h">
        <h2 id="set-h">What the class was assessed on</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>Assessment</th><th>Part of the grade</th><th>Out of</th><th>Marked</th></tr></thead>
          <tbody>{book.assessments.map((a) => <tr key={a.id}><td>{a.title}</td><td>{CATEGORY_LABEL[a.category]}</td><td>{a.maxScore}</td><td>{a.submissions.filter((s) => s.score !== null).length}</td></tr>)}</tbody>
        </table></div>
      </section>
    </div>
  );
}
