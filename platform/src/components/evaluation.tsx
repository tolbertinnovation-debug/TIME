import { prisma } from "@/lib/db";
import { MIN_RESPONSES, QUESTIONS, summarise } from "@/lib/evaluation";

// The summary of a class's evaluations, the same for the lecturer and for academic leadership.
// It never shows who answered, and shows nothing until enough students have answered.
export async function EvaluationSummary({ classId }: { classId: string }) {
  const [rows, enrolled] = await Promise.all([
    prisma.courseEvaluation.findMany({ where: { classId } }),
    prisma.enrolment.count({ where: { classId, status: { in: ["ACTIVE", "COMPLETED"] } } }),
  ]);
  const s = summarise(rows);
  if (!s.ready) {
    return (
      <p className="card">
        {s.responses === 0 ? "No student has evaluated this class yet." : `${s.responses} of ${enrolled} ${enrolled === 1 ? "student has" : "students have"} answered.`}{" "}
        To keep answers anonymous, results appear once at least {MIN_RESPONSES} students have answered.
      </p>
    );
  }
  return (
    <div className="stack lg">
      <p className="muted">{s.responses} of {enrolled} students answered. Answers are anonymous: nobody at TIME can see who wrote what.</p>
      <div className="table-wrap"><table>
        <thead><tr><th>Question</th><th>Average out of 5</th><th>Very good</th><th>Good</th><th>Fair</th><th>Poor</th><th>Very poor</th></tr></thead>
        <tbody>
          {QUESTIONS.map((q) => (
            <tr key={q.key}>
              <th scope="row">{q.label}</th><td><strong>{s.averages[q.key].toFixed(1)}</strong></td>
              {[4, 3, 2, 1, 0].map((i) => <td key={i}>{s.counts[q.key][i]}</td>)}
            </tr>
          ))}
        </tbody>
      </table></div>
      {([["What went well", s.wentWell], ["What should be improved", s.improve]] as const).map(([title, list]) => (
        <section className="stack" key={title}>
          <h2>{title}</h2>
          {list.length === 0 ? <p className="muted">No comments.</p> : <ul className="card stack" style={{ margin: 0, paddingLeft: 34, gap: 8 }}>{list.map((c, i) => <li key={i} style={{ whiteSpace: "pre-line" }}>{c}</li>)}</ul>}
        </section>
      ))}
    </div>
  );
}
