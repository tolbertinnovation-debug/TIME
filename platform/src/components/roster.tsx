import { ENROLMENT_LABEL } from "@/lib/academics";
import { formatDate } from "@/lib/format";

const PILL = { ACTIVE: "ok", WITHDRAWN: "bad", DEFERRED: "wait", COMPLETED: "" } as const;

type Row = { id: string; status: keyof typeof PILL; enrolledAt: Date; user: { name: string; studentNumber: string | null; phone: string | null; county: string | null } };

// The list of students in a class, shown to staff.
export function Roster({ enrolments }: { enrolments: Row[] }) {
  return (
    <div className="table-wrap"><table>
      <thead><tr><th>Student</th><th>Student number</th><th>County</th><th>Phone</th><th>Enrolled</th><th>Status</th></tr></thead>
      <tbody>
        {enrolments.map((e) => (
          <tr key={e.id}>
            <td>{e.user.name}</td>
            <td className="nowrap">{e.user.studentNumber ?? "—"}</td>
            <td>{e.user.county ?? "—"}</td>
            <td className="nowrap">{e.user.phone ?? "—"}</td>
            <td className="nowrap">{formatDate(e.enrolledAt)}</td>
            <td><span className={`pill ${PILL[e.status]}`}>{ENROLMENT_LABEL[e.status]}</span></td>
          </tr>
        ))}
        {enrolments.length === 0 && <tr><td colSpan={6}>No students are enrolled yet.</td></tr>}
      </tbody>
    </table></div>
  );
}
