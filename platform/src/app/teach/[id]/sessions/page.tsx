import Link from "next/link";
import { createSessionAction } from "@/app/teaching-actions";
import { KindPill, TeachNav } from "@/components/learning";
import { Notices } from "@/components/notice";
import { requireClassStaff } from "@/lib/class-access";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Sessions" };

export default async function Sessions({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const { access, cls } = await requireClassStaff(id, "sessions.manage");
  const sessions = await prisma.classSession.findMany({ where: { classId: id }, orderBy: { startsAt: "asc" }, include: { attendance: true } });
  return (
    <div className="stack lg">
      <div className="stack">
        <p className="small"><Link href={`/teach/${id}`}>{cls.course.title}</Link></p>
        <h1>Sessions and attendance</h1>
        <p className="muted">Live online classes and in-person practical sessions. Times are in Liberia time.</p>
        <TeachNav classId={id} access={access} />
        <Notices params={await searchParams} />
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>When</th><th>Session</th><th>Kind</th><th>Attendance</th><th></th></tr></thead>
        <tbody>
          {sessions.map((s) => {
            const present = s.attendance.filter((a) => a.status === "PRESENT").length;
            return (
              <tr key={s.id}>
                <td className="nowrap">{formatDateTime(s.startsAt)}</td>
                <td>{s.title}</td>
                <td><KindPill kind={s.kind} /></td>
                <td className="nowrap">{s.attendance.length ? `${present} of ${s.attendance.length} present` : "Not taken"}</td>
                <td><Link className="btn ghost sm" href={`/teach/${id}/sessions/${s.id}`}>Take attendance</Link></td>
              </tr>
            );
          })}
          {sessions.length === 0 && <tr><td colSpan={5}>No sessions yet.</td></tr>}
        </tbody>
      </table></div>
      <form className="card form" action={createSessionAction}>
        <h2>Add a session</h2>
        <input type="hidden" name="classId" value={id} />
        <div className="grid">
          <div className="field"><label htmlFor="s-title">Title</label><input id="s-title" name="title" type="text" required maxLength={120} placeholder="Week 1 live class" /></div>
          <div className="field"><label htmlFor="s-kind">Kind</label><select id="s-kind" name="kind" required><option value="ONLINE">Online (live class)</option><option value="PRACTICAL">Practical (in person)</option></select></div>
          <div className="field"><label htmlFor="s-when">Date and time</label><input id="s-when" name="startsAt" type="datetime-local" required /></div>
          <div className="field"><label htmlFor="s-url">Meeting link <span className="muted">(needed for online)</span></label><input id="s-url" name="meetingUrl" type="text" inputMode="url" maxLength={500} placeholder="https://meet.jit.si/…" /></div>
        </div>
        <div><button className="btn" type="submit">Add session</button></div>
      </form>
    </div>
  );
}
