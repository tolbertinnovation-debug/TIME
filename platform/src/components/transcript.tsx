import { ENROLMENT_LABEL, TRACK_LABEL } from "@/lib/academics";
import { ADDRESS, INSTITUTION } from "@/lib/certificate";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { PASS_MARK, WEIGHTS } from "@/lib/grading";

// A student's academic record: every class they enrolled in, with results that have been published.
// Results still in review are never shown. Returns null when the person is not a student with a record.
export async function Transcript({ userId }: { userId: string }) {
  const student = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, studentNumber: true, county: true } });
  if (!student) return null;
  const enrolments = await prisma.enrolment.findMany({
    where: { userId },
    orderBy: { enrolledAt: "asc" },
    include: { class: { include: { course: { include: { program: true } }, intake: true } }, result: true, certificate: true },
  });
  const rows = enrolments.map((e) => ({ e, result: e.result?.status === "PUBLISHED" ? e.result : null, cert: e.certificate && !e.certificate.revokedAt ? e.certificate : null }));
  const passed = rows.filter((r) => r.result?.passed).length;
  return (
    <article className="card stack transcript">
      <header className="stack" style={{ gap: 4, textAlign: "center" }}>
        <h1 style={{ fontSize: "1.25rem" }}>{INSTITUTION}</h1>
        <p className="small muted">{ADDRESS}</p>
        <h2 style={{ marginTop: 8 }}>Academic transcript</h2>
      </header>
      <div className="table-wrap"><table><tbody>
        <tr><th scope="row">Student</th><td><strong>{student.name}</strong></td></tr>
        <tr><th scope="row">Student number</th><td>{student.studentNumber ?? "Not yet given"}</td></tr>
        {student.county && <tr><th scope="row">County</th><td>{student.county}</td></tr>}
        <tr><th scope="row">Date produced</th><td>{formatDate(new Date())}</td></tr>
      </tbody></table></div>
      {rows.length === 0 ? <p>No classes are on record for this student.</p> : (
        <div className="table-wrap"><table>
          <thead><tr>
            <th>Course</th><th>Intake</th><th>Status</th>
            <th title="Continuous assessment">CA /{WEIGHTS.CONTINUOUS}</th><th title="Assignments and practical activities">A&amp;P /{WEIGHTS.ASSIGNMENT}</th>
            <th>Midterm /{WEIGHTS.MIDTERM}</th><th>Final /{WEIGHTS.FINAL}</th><th>Total /100</th><th>Outcome</th><th>Certificate</th>
          </tr></thead>
          <tbody>
            {rows.map(({ e, result, cert }) => (
              <tr key={e.id}>
                <td><strong>{e.class.course.title}</strong><br /><span className="small muted">{e.class.course.program.title}</span></td>
                <td>{e.class.intake.name}<br /><span className="small muted">{TRACK_LABEL[e.class.track]}</span></td>
                <td>{ENROLMENT_LABEL[e.status]}</td>
                {result ? (
                  <><td>{result.continuous}</td><td>{result.assignments}</td><td>{result.midterm}</td><td>{result.final}</td><td><strong>{result.total}</strong></td><td>{result.passed ? "Pass" : "Not passed"}</td></>
                ) : <td colSpan={6} className="muted">No published result</td>}
                <td>{cert ? `${cert.number}, ${formatDate(cert.awardedOn)}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
      <p className="small">
        Courses passed: <strong>{passed}</strong> of {rows.length}. Each course is marked out of 100 points: continuous assessment (CA) {WEIGHTS.CONTINUOUS},
        assignments and practical activities (A&amp;P) {WEIGHTS.ASSIGNMENT}, midterm {WEIGHTS.MIDTERM}, final {WEIGHTS.FINAL}. The pass mark is {PASS_MARK}.
      </p>
      <p className="small muted">
        This transcript shows only results approved and published by TIME&apos;s academic leadership. It is official only when signed and stamped by the Registrar.
      </p>
      <div className="row between small" style={{ marginTop: 28 }}>
        <span>Registrar: ______________________________</span><span>Date: ______________________</span>
      </div>
    </article>
  );
}
