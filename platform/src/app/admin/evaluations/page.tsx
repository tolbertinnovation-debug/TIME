import Link from "next/link";
import { classLabel } from "@/lib/academics";
import { prisma } from "@/lib/db";
import { MIN_RESPONSES } from "@/lib/evaluation";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "Course evaluations" };

export default async function Evaluations() {
  await requireCapability("results.review");
  const [classes, averages] = await Promise.all([
    prisma.courseClass.findMany({
      orderBy: [{ intake: { startDate: "desc" } }, { course: { title: "asc" } }],
      include: { course: true, intake: true, staff: { where: { role: "LECTURER" }, include: { user: true } }, _count: { select: { evaluations: true, enrolments: { where: { status: { in: ["ACTIVE", "COMPLETED"] } } } } } },
    }),
    prisma.courseEvaluation.groupBy({ by: ["classId"], _avg: { overall: true } }),
  ]);
  const overall = new Map(averages.map((a) => [a.classId, a._avg.overall]));
  return (
    <div className="stack lg">
      <div className="stack">
        <h1>Course evaluations</h1>
        <p className="muted">What students said about each class. Answers are anonymous, and a class&apos;s results appear once at least {MIN_RESPONSES} students have answered.</p>
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>Class</th><th>Lecturer</th><th>Answered</th><th>Overall, out of 5</th></tr></thead>
        <tbody>
          {classes.map((c) => {
            const ready = c._count.evaluations >= MIN_RESPONSES, avg = overall.get(c.id);
            return (
              <tr key={c.id}>
                <td>{ready ? <Link href={`/admin/evaluations/${c.id}`}>{classLabel(c)}</Link> : classLabel(c)}</td>
                <td>{c.staff.map((s) => s.user.name).join(", ") || "Not assigned"}</td>
                <td>{c._count.evaluations} of {c._count.enrolments}</td>
                <td>{ready && avg != null ? <strong>{avg.toFixed(1)}</strong> : <span className="muted">Not yet</span>}</td>
              </tr>
            );
          })}
          {classes.length === 0 && <tr><td colSpan={4}>There are no classes yet.</td></tr>}
        </tbody>
      </table></div>
    </div>
  );
}
