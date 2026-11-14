import { createCentreAction, createIntakeAction, setIntakeStatusAction } from "@/app/academic-actions";
import { Notices } from "@/components/notice";
import { INTAKE_LABEL } from "@/lib/academics";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "Intakes and centres" };

const PILL = { PLANNED: "plain", OPEN: "ok", CLOSED: "bad" } as const;
const NEXT = { PLANNED: [["OPEN", "Open for applications"]], OPEN: [["CLOSED", "Close applications"]], CLOSED: [["OPEN", "Reopen"]] } as const;

export default async function Setup({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireCapability("setup.manage");
  const [intakes, centres] = await Promise.all([
    prisma.intake.findMany({ orderBy: { startDate: "asc" }, include: { _count: { select: { classes: true } } } }),
    prisma.studyCentre.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { classes: true } } } }),
  ]);
  return (
    <div className="stack lg">
      <div className="stack"><h1>Intakes and study centres</h1><Notices params={await searchParams} /></div>

      <section className="stack" aria-labelledby="intakes-h">
        <h2 id="intakes-h">Intakes</h2>
        <p className="muted">Students can apply only to classes in an intake that is open.</p>
        <div className="table-wrap"><table>
          <thead><tr><th>Intake</th><th>Classes start</th><th>Register by</th><th>Classes</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {intakes.map((i) => (
              <tr key={i.id}>
                <td><strong>{i.name}</strong></td>
                <td className="nowrap">{formatDate(i.startDate)}</td>
                <td className="nowrap">{i.registerBy ? formatDate(i.registerBy) : "—"}</td>
                <td>{i._count.classes}</td>
                <td><span className={`pill ${PILL[i.status]}`}>{INTAKE_LABEL[i.status]}</span></td>
                <td>
                  {NEXT[i.status].map(([status, label]) => (
                    <form key={status} action={setIntakeStatusAction}>
                      <input type="hidden" name="id" value={i.id} /><input type="hidden" name="status" value={status} />
                      <button className="btn ghost sm" type="submit">{label}</button>
                    </form>
                  ))}
                </td>
              </tr>
            ))}
            {intakes.length === 0 && <tr><td colSpan={6}>No intakes yet.</td></tr>}
          </tbody>
        </table></div>
        <form className="card form" action={createIntakeAction}>
          <h3>Add an intake</h3>
          <div className="grid">
            <div className="field"><label htmlFor="intake-name">Name</label><input id="intake-name" name="name" type="text" required maxLength={60} placeholder="March 2028" /></div>
            <div className="field"><label htmlFor="intake-start">Classes start</label><input id="intake-start" name="startDate" type="date" required /></div>
            <div className="field"><label htmlFor="intake-register">Register by <span className="muted">(optional)</span></label><input id="intake-register" name="registerBy" type="date" /></div>
          </div>
          <div><button className="btn" type="submit">Add intake</button></div>
        </form>
      </section>

      <section className="stack" aria-labelledby="centres-h">
        <h2 id="centres-h">Study centres</h2>
        <p className="muted">Where blended classes meet in person.</p>
        <div className="table-wrap"><table>
          <thead><tr><th>Centre</th><th>County</th><th>Address</th><th>Classes</th></tr></thead>
          <tbody>
            {centres.map((c) => <tr key={c.id}><td><strong>{c.name}</strong></td><td>{c.county}</td><td>{c.address ?? "—"}</td><td>{c._count.classes}</td></tr>)}
            {centres.length === 0 && <tr><td colSpan={4}>No study centres yet. Add the Margibi campus first.</td></tr>}
          </tbody>
        </table></div>
        <form className="card form" action={createCentreAction}>
          <h3>Add a study centre</h3>
          <div className="grid">
            <div className="field"><label htmlFor="centre-name">Name</label><input id="centre-name" name="name" type="text" required maxLength={80} placeholder="Margibi campus" /></div>
            <div className="field"><label htmlFor="centre-county">County</label><input id="centre-county" name="county" type="text" required maxLength={60} /></div>
            <div className="field"><label htmlFor="centre-address">Address <span className="muted">(optional)</span></label><input id="centre-address" name="address" type="text" maxLength={200} /></div>
          </div>
          <div><button className="btn" type="submit">Add study centre</button></div>
        </form>
      </section>
    </div>
  );
}
