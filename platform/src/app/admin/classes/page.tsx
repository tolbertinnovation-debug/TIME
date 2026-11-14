import Link from "next/link";
import { createClassAction } from "@/app/academic-actions";
import { Notices } from "@/components/notice";
import { MODE_LABEL, TRACK_LABEL } from "@/lib/academics";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "Classes" };

export default async function Classes({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireCapability("enrolments.view");
  const params = await searchParams;
  const manage = can(me.role, "setup.manage");
  const [classes, intakes, programs, centres] = await Promise.all([
    prisma.courseClass.findMany({
      orderBy: [{ intake: { startDate: "asc" } }, { course: { sort: "asc" } }],
      include: { course: true, intake: true, studyCentre: true, staff: { include: { user: true } }, _count: { select: { enrolments: { where: { status: "ACTIVE" } } } } },
    }),
    manage ? prisma.intake.findMany({ where: { status: { not: "CLOSED" } }, orderBy: { startDate: "asc" } }) : [],
    manage ? prisma.program.findMany({ orderBy: { sort: "asc" }, include: { courses: { where: { active: true }, orderBy: { sort: "asc" } } } }) : [],
    manage ? prisma.studyCentre.findMany({ where: { active: true }, orderBy: { name: "asc" } }) : [],
  ]);
  return (
    <div className="stack lg">
      <div className="stack">
        <h1>Classes</h1>
        <p className="muted">A class is one running of a course: an intake, a schedule, and online or blended study.</p>
        <Notices params={params} />
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>Course</th><th>Intake</th><th>Schedule</th><th>Study</th><th>Lecturer</th><th>Enrolled</th><th>Applications</th></tr></thead>
        <tbody>
          {classes.map((c) => (
            <tr key={c.id}>
              <td><Link href={`/admin/classes/${c.id}`}><strong>{c.course.title}</strong></Link></td>
              <td>{c.intake.name}</td>
              <td>{TRACK_LABEL[c.track]}</td>
              <td>{MODE_LABEL[c.mode]}{c.studyCentre ? ` · ${c.studyCentre.name}` : ""}</td>
              <td>{c.staff.filter((s) => s.role === "LECTURER").map((s) => s.user.name).join(", ") || <span className="pill wait">Not assigned</span>}</td>
              <td>{c._count.enrolments}{c.capacity ? ` of ${c.capacity}` : ""}</td>
              <td><span className={`pill ${c.status === "OPEN" && c.intake.status === "OPEN" ? "ok" : "plain"}`}>{c.status === "OPEN" && c.intake.status === "OPEN" ? "Open" : "Closed"}</span></td>
            </tr>
          ))}
          {classes.length === 0 && <tr><td colSpan={7}>No classes yet.</td></tr>}
        </tbody>
      </table></div>
      {manage && (
        <form className="card form" action={createClassAction}>
          <h2>Add a class</h2>
          <div className="grid">
            <div className="field">
              <label htmlFor="courseId">Course</label>
              <select id="courseId" name="courseId" required defaultValue="">
                <option value="" disabled>Choose a course</option>
                {programs.map((p) => <optgroup key={p.id} label={p.title}>{p.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</optgroup>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="intakeId">Intake</label>
              <select id="intakeId" name="intakeId" required defaultValue="">
                <option value="" disabled>Choose an intake</option>
                {intakes.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="track">Schedule</label><select id="track" name="track" required>{Object.entries(TRACK_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div className="field"><label htmlFor="mode">Study</label><select id="mode" name="mode" required><option value="BLENDED">Blended</option><option value="ONLINE">Online</option></select></div>
            <div className="field">
              <label htmlFor="studyCentreId">Study centre <span className="muted">(needed for blended)</span></label>
              <select id="studyCentreId" name="studyCentreId" defaultValue=""><option value="">None</option>{centres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </div>
            <div className="field"><label htmlFor="capacity">Places <span className="muted">(optional)</span></label><input id="capacity" name="capacity" type="text" inputMode="numeric" maxLength={4} /></div>
          </div>
          <div><button className="btn" type="submit">Add class</button></div>
        </form>
      )}
    </div>
  );
}
