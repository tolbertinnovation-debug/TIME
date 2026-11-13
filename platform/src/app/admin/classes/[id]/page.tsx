import Link from "next/link";
import { notFound } from "next/navigation";
import { assignStaffAction, removeStaffAction, setClassStatusAction } from "@/app/academic-actions";
import { endClassAction } from "@/app/certificate-actions";
import { formatDate } from "@/lib/format";
import { Notices } from "@/components/notice";
import { Roster } from "@/components/roster";
import { MODE_LABEL, TRACK_LABEL } from "@/lib/academics";
import { prisma } from "@/lib/db";
import { can, ROLE_LABEL } from "@/lib/permissions";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "Class" };

export default async function ClassPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireCapability("enrolments.view");
  const { id } = await params;
  const cls = await prisma.courseClass.findUnique({
    where: { id },
    include: { course: true, intake: true, studyCentre: true, staff: { include: { user: true }, orderBy: { role: "desc" } }, enrolments: { include: { user: true }, orderBy: { enrolledAt: "asc" } } },
  });
  if (!cls) notFound();
  const manage = can(me.role, "setup.manage");
  const assigned = new Set(cls.staff.map((s) => s.userId));
  const candidates = manage ? (await prisma.user.findMany({ where: { role: { in: ["LECTURER", "FACILITATOR"] }, status: "ACTIVE" }, orderBy: { name: "asc" } })).filter((u) => !assigned.has(u.id)) : [];
  const active = cls.enrolments.filter((e) => e.status === "ACTIVE").length;
  return (
    <div className="stack lg">
      <div className="stack">
        <p className="small"><Link href="/admin/classes">All classes</Link></p>
        <h1>{cls.course.title}</h1>
        <p className="muted">{cls.intake.name} · {TRACK_LABEL[cls.track]} · {MODE_LABEL[cls.mode]}{cls.studyCentre ? ` · ${cls.studyCentre.name}` : ""} · {active}{cls.capacity ? ` of ${cls.capacity}` : ""} enrolled</p>
        <Notices params={await searchParams} />
        {me.role === "ADMIN" && <p className="small"><Link href={`/teach/${cls.id}`}>Open the teaching view</Link> (lessons, sessions, attendance)</p>}
        {cls.status === "ENDED" && <p className="notice ok">This class ended on {cls.endedAt ? formatDate(cls.endedAt) : "an earlier date"}. Students who passed and have cleared their fees can request their certificate.</p>}
        {manage && cls.status !== "ENDED" && (
          <div className="row">
            <form action={setClassStatusAction}>
              <input type="hidden" name="id" value={cls.id} /><input type="hidden" name="status" value={cls.status === "OPEN" ? "CLOSED" : "OPEN"} />
              <button className="btn ghost sm" type="submit">{cls.status === "OPEN" ? "Stop taking applications" : "Take applications again"}</button>
            </form>
            <form action={endClassAction}><input type="hidden" name="id" value={cls.id} /><button className="btn sm" type="submit">End this class</button></form>
          </div>
        )}
        {manage && cls.status === "ENDED" && (
          <form action={endClassAction}><input type="hidden" name="id" value={cls.id} /><input type="hidden" name="reopen" value="yes" /><button className="btn ghost sm" type="submit">Reopen this class</button></form>
        )}
      </div>

      <section className="stack" aria-labelledby="staff-h">
        <h2 id="staff-h">Lecturer and facilitators</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>Name</th><th>Role</th><th>Email</th>{manage && <th></th>}</tr></thead>
          <tbody>
            {cls.staff.map((s) => (
              <tr key={s.userId}>
                <td>{s.user.name}</td><td>{ROLE_LABEL[s.role]}</td><td>{s.user.email}</td>
                {manage && <td><form action={removeStaffAction}><input type="hidden" name="classId" value={cls.id} /><input type="hidden" name="userId" value={s.userId} /><button className="btn ghost sm" type="submit">Remove</button></form></td>}
              </tr>
            ))}
            {cls.staff.length === 0 && <tr><td colSpan={manage ? 4 : 3}>Nobody is assigned yet.</td></tr>}
          </tbody>
        </table></div>
        {manage && (candidates.length > 0 ? (
          <form className="inline-form" action={assignStaffAction}>
            <input type="hidden" name="classId" value={cls.id} />
            <label className="skip" htmlFor="staff-user">Person to assign</label>
            <select id="staff-user" name="userId" required defaultValue="">
              <option value="" disabled>Choose a lecturer or facilitator</option>
              {candidates.map((u) => <option key={u.id} value={u.id}>{u.name} · {ROLE_LABEL[u.role]}</option>)}
            </select>
            <button className="btn sm" type="submit">Assign</button>
          </form>
        ) : <p className="muted small">Every active lecturer and facilitator is already assigned. People get those roles by asking for staff access.</p>)}
      </section>

      <section className="stack" aria-labelledby="roster-h">
        <h2 id="roster-h">Students</h2>
        <Roster enrolments={cls.enrolments} />
      </section>
    </div>
  );
}
