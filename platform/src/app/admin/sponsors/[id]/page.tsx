import Link from "next/link";
import { notFound } from "next/navigation";
import { addSponsorshipAction, logSponsorReportAction, recordConsentAction, removeSponsorshipAction } from "@/app/community-actions";
import { Notices } from "@/components/notice";
import { classLabel } from "@/lib/academics";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "Sponsor" };

export default async function SponsorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireCapability("sponsors.manage");
  const { id } = await params;
  const sponsor = await prisma.sponsor.findUnique({
    where: { id },
    include: { sponsorships: { orderBy: { createdAt: "asc" }, include: { enrolment: { include: { user: true, class: { include: { course: true, intake: true } } } } } } },
  });
  if (!sponsor) notFound();
  // Students who are enrolled and do not yet have a sponsor for that class.
  const free = await prisma.enrolment.findMany({ where: { status: "ACTIVE", sponsorship: null }, include: { user: true, class: { include: { course: true, intake: true } } }, orderBy: { user: { name: "asc" } }, take: 500 });
  const agreed = sponsor.sponsorships.filter((s) => s.consentAt).length;
  return (
    <div className="stack lg">
      <div className="stack">
        <p className="small"><Link href="/admin/sponsors">Sponsors</Link></p>
        <h1>{sponsor.name}</h1>
        <p className="muted">{sponsor.contact ?? "No contact details"}{sponsor.notes ? ` · ${sponsor.notes}` : ""}</p>
        <Notices params={await searchParams} />
      </div>
      <section className="stack" aria-labelledby="students-h">
        <h2 id="students-h">Sponsored students</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>Student</th><th>Class</th><th>Consent to share progress</th><th></th></tr></thead>
          <tbody>
            {sponsor.sponsorships.map((s) => (
              <tr key={s.id}>
                <td>{s.enrolment.user.name}<br /><span className="muted small">{s.enrolment.user.studentNumber ?? ""}</span></td>
                <td>{classLabel(s.enrolment.class)}</td>
                <td>
                  {s.consentAt ? <><span className="pill ok">Agreed</span><br /><span className="small muted">{formatDate(s.consentAt)} · {s.consentBy === "student" ? "given by the student on the platform" : `signed form recorded by ${s.consentBy}`}</span></> : (
                    <>
                      <span className="pill wait">Not given</span>
                      <form className="inline-form" action={recordConsentAction} style={{ marginTop: 6 }}>
                        <input type="hidden" name="sponsorId" value={sponsor.id} /><input type="hidden" name="sponsorshipId" value={s.id} />
                        <label className="small" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="signed" /> I hold the student's signed consent form</label>
                        <button className="btn ghost sm" type="submit">Record consent</button>
                      </form>
                    </>
                  )}
                </td>
                <td><form action={removeSponsorshipAction}><input type="hidden" name="sponsorId" value={sponsor.id} /><input type="hidden" name="sponsorshipId" value={s.id} /><button className="btn ghost sm" type="submit">Remove</button></form></td>
              </tr>
            ))}
            {sponsor.sponsorships.length === 0 && <tr><td colSpan={4}>No students linked yet.</td></tr>}
          </tbody>
        </table></div>
        {free.length > 0 && (
          <form className="inline-form" action={addSponsorshipAction}>
            <input type="hidden" name="sponsorId" value={sponsor.id} />
            <label className="skip" htmlFor="enrolmentId">Student to link</label>
            <select id="enrolmentId" name="enrolmentId" required defaultValue="">
              <option value="" disabled>Choose a student</option>
              {free.map((e) => <option key={e.id} value={e.id}>{e.user.name} · {classLabel(e.class)}</option>)}
            </select>
            <button className="btn sm" type="submit">Link student</button>
          </form>
        )}
      </section>
      <section className="card stack" aria-labelledby="report-h">
        <h2 id="report-h">Progress report</h2>
        <p>The report gives a summary for each student who has agreed: enrolment, attendance, work handed in, overall result, standing and completion. It never includes individual pieces of work, feedback, messages or fees.</p>
        {agreed > 0 ? (
          <form action={logSponsorReportAction}><input type="hidden" name="sponsorId" value={sponsor.id} /><button className="btn" type="submit">Produce report for {agreed} {agreed === 1 ? "student" : "students"}</button></form>
        ) : <p className="notice info">No student has agreed yet, so no report can be produced.</p>}
      </section>
    </div>
  );
}
