import { PASS_MARK, WEIGHTS } from "@/lib/grading";
import type { Marks } from "@/lib/grading";

type Row = { enrolmentId: string; name: string; studentNumber: string | null; marks: Marks; status: "IN_REVIEW" | "PUBLISHED" | null };

const STATE = { IN_REVIEW: ["wait", "Waiting for approval"], PUBLISHED: ["ok", "Published"] } as const;

// The class gradebook: the four parts of the grade, the total out of 100, and pass or below the pass mark.
export function GradebookTable({ rows }: { rows: Row[] }) {
  return (
    <div className="table-wrap"><table>
      <thead><tr>
        <th>Student</th>
        <th>Continuous /{WEIGHTS.CONTINUOUS}</th><th>Assignments &amp; practical /{WEIGHTS.ASSIGNMENT}</th><th>Midterm /{WEIGHTS.MIDTERM}</th><th>Final /{WEIGHTS.FINAL}</th>
        <th>Total /100</th><th>Result</th><th>Status</th>
      </tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.enrolmentId}>
            <td>{r.name}<br /><span className="muted small">{r.studentNumber ?? ""}</span></td>
            <td>{r.marks.continuous}</td><td>{r.marks.assignments}</td><td>{r.marks.midterm}</td><td>{r.marks.final}</td>
            <td><strong>{r.marks.total}</strong></td>
            <td><span className={`pill ${r.marks.passed ? "ok" : "bad"}`}>{r.marks.passed ? "Pass" : `Below ${PASS_MARK}`}</span></td>
            <td>{r.status ? <span className={`pill ${STATE[r.status][0]}`}>{STATE[r.status][1]}</span> : <span className="pill plain">Not sent</span>}</td>
          </tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={8}>No students are enrolled yet.</td></tr>}
      </tbody>
    </table></div>
  );
}
