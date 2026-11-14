import { applyAction } from "@/app/academic-actions";
import { cancelRequestAction } from "@/app/actions";
import { Notices } from "@/components/notice";
import { RequestStatus } from "@/components/request-status";
import { classLabel, MODE_LABEL, TRACK_LABEL } from "@/lib/academics";
import { prisma } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "Apply" };

export default async function Apply({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireCapability("classes.apply");
  const [open, requests, mine] = await Promise.all([
    prisma.courseClass.findMany({
      where: { status: "OPEN", intake: { status: "OPEN" } },
      orderBy: [{ intake: { startDate: "asc" } }, { course: { sort: "asc" } }],
      include: { course: { include: { program: true } }, intake: true, studyCentre: true },
    }),
    prisma.approvalRequest.findMany({ where: { requestedById: user.id, type: "APPLICATION" }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.enrolment.findMany({ where: { userId: user.id, status: { in: ["ACTIVE", "COMPLETED"] } }, select: { classId: true } }),
  ]);
  const taken = new Set([...mine.map((e) => e.classId), ...requests.filter((r) => r.status === "PENDING").map((r) => String((r.payload as { classId?: unknown }).classId))]);
  const available = open.filter((c) => !taken.has(c.id));
  const applied = await prisma.courseClass.findMany({ where: { id: { in: requests.map((r) => String((r.payload as { classId?: unknown }).classId)) } }, include: { course: true, intake: true } });
  const label = new Map(applied.map((c) => [c.id, classLabel(c)]));
  const programs = [...new Map(available.map((c) => [c.course.program.id, c.course.program.title]))];
  return (
    <div className="stack lg" style={{ maxWidth: 720 }}>
      <div className="stack">
        <h1>Apply to a class</h1>
        <p className="muted">Applying is free. The registrar reviews each application, and you will see the result on this page.</p>
        <Notices params={await searchParams} />
      </div>
      {available.length === 0 ? (
        <p className="card">{open.length === 0 ? "No classes are taking applications right now. Check again soon, or contact the TIME admissions office." : "You have applied to, or are enrolled in, every class that is open."}</p>
      ) : (
        <form className="card form" action={applyAction}>
          <div className="field">
            <label htmlFor="classId">Class</label>
            <select id="classId" name="classId" required defaultValue="">
              <option value="" disabled>Choose a class</option>
              {programs.map(([pid, title]) => (
                <optgroup key={pid} label={title}>
                  {available.filter((c) => c.course.program.id === pid).map((c) => (
                    <option key={c.id} value={c.id}>{c.course.title} · {c.intake.name} · {TRACK_LABEL[c.track]} · {MODE_LABEL[c.mode]}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <span className="hint">Classes start {[...new Set(available.map((c) => `${formatDate(c.intake.startDate)} (${c.intake.name})`))].join(" or ")}.</span>
          </div>
          <div className="field"><label htmlFor="county">County you live in</label><input id="county" name="county" type="text" required maxLength={60} autoComplete="address-level1" placeholder="e.g. Margibi" /></div>
          <div className="field"><label htmlFor="work">Current work <span className="muted">(optional)</span></label><input id="work" name="work" type="text" maxLength={100} placeholder="e.g. Grade 3 teacher" /></div>
          <div className="field"><label htmlFor="note">Anything the registrar should know <span className="muted">(optional)</span></label><textarea id="note" name="note" maxLength={500} /></div>
          <button className="btn" type="submit">Send application</button>
        </form>
      )}
      {requests.length > 0 && (
        <section className="stack" aria-labelledby="apps-h">
          <h2 id="apps-h">Your applications</h2>
          <div className="table-wrap"><table>
            <thead><tr><th>Sent</th><th>Class</th><th>Status</th><th>Registrar's note</th><th></th></tr></thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="nowrap">{formatDateTime(r.createdAt)}</td>
                  <td>{label.get(String((r.payload as { classId?: unknown }).classId)) ?? "A class that was removed"}</td>
                  <td><RequestStatus status={r.status} /></td>
                  <td>{r.decisionNote ?? "—"}</td>
                  <td>{r.status === "PENDING" && <form action={cancelRequestAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="from" value="apply" /><button className="btn ghost sm" type="submit">Cancel</button></form>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </section>
      )}
    </div>
  );
}
