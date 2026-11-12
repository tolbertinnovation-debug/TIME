import Link from "next/link";
import { notFound } from "next/navigation";
import { saveAttendanceAction } from "@/app/teaching-actions";
import { Notices } from "@/components/notice";
import { requireClassStaff } from "@/lib/class-access";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Attendance" };

const CHOICES = [["PRESENT", "Present"], ["ABSENT", "Absent"], ["EXCUSED", "Excused"]] as const;

export default async function TakeAttendance({ params, searchParams }: { params: Promise<{ id: string; sessionId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id, sessionId } = await params;
  await requireClassStaff(id, "sessions.manage");
  const session = await prisma.classSession.findFirst({ where: { id: sessionId, classId: id }, include: { attendance: true } });
  if (!session) notFound();
  const enrolments = await prisma.enrolment.findMany({ where: { classId: id, status: "ACTIVE" }, include: { user: true }, orderBy: { user: { name: "asc" } } });
  const marked = new Map(session.attendance.map((a) => [a.enrolmentId, a.status]));
  return (
    <div className="stack lg" style={{ maxWidth: 760 }}>
      <div className="stack">
        <p className="small"><Link href={`/teach/${id}/sessions`}>Sessions</Link></p>
        <h1>Attendance: {session.title}</h1>
        <p className="muted">{formatDateTime(session.startsAt)}</p>
        <Notices params={await searchParams} />
      </div>
      {enrolments.length === 0 ? <p className="card">No students are enrolled in this class yet.</p> : (
        <form className="form" action={saveAttendanceAction}>
          <input type="hidden" name="classId" value={id} /><input type="hidden" name="sessionId" value={sessionId} />
          <div className="table-wrap"><table>
            <thead><tr><th>Student</th><th>Attendance</th></tr></thead>
            <tbody>
              {enrolments.map((e) => (
                <tr key={e.id}>
                  <td>{e.user.name}<br /><span className="muted small">{e.user.studentNumber ?? ""}</span></td>
                  <td>
                    <fieldset className="radio-row" style={{ border: 0, padding: 0, margin: 0 }}>
                      <legend className="skip">Attendance for {e.user.name}</legend>
                      {CHOICES.map(([value, label]) => (
                        <label key={value}><input type="radio" name={`status-${e.id}`} value={value} defaultChecked={marked.get(e.id) === value} /> {label}</label>
                      ))}
                    </fieldset>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <div><button className="btn" type="submit">Save attendance</button></div>
        </form>
      )}
    </div>
  );
}
