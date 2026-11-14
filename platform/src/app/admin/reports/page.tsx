import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { REPORT_KINDS, REPORTS } from "@/lib/reports";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "Reports" };

export default async function Reports() {
  const user = await requireCapability("admin.area");
  const kinds = REPORT_KINDS.filter((k) => can(user.role, REPORTS[k].capability));
  const intakes = await prisma.intake.findMany({ orderBy: { startDate: "desc" } });
  return (
    <div className="stack lg">
      <div className="stack">
        <h1>Reports</h1>
        <p className="muted">Each report downloads as a file that opens in Excel or Google Sheets. Every download is recorded in the activity log.</p>
      </div>
      {kinds.length === 0 && <p className="card">There are no reports for your role.</p>}
      {kinds.map((k) => (
        <section className="card stack" key={k} aria-labelledby={`r-${k}`}>
          <h2 id={`r-${k}`}>{REPORTS[k].title}</h2>
          <p>{REPORTS[k].about}</p>
          {/* A plain link-style form: the browser downloads the file. */}
          <form className="row" method="get" action={`/api/reports/${k}`}>
            <label className="skip" htmlFor={`intake-${k}`}>Intake for the {REPORTS[k].title.toLowerCase()} report</label>
            <select id={`intake-${k}`} name="intake" defaultValue="" style={{ width: "auto" }}>
              <option value="">All intakes</option>
              {intakes.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <button className="btn" type="submit">Download {REPORTS[k].title.toLowerCase()} report</button>
          </form>
        </section>
      ))}
      <p className="small muted">These files hold students&apos; personal information. Keep them on TIME&apos;s computers, share them only with those who need them, and delete copies you no longer need.</p>
    </div>
  );
}
