import Link from "next/link";
import { notFound } from "next/navigation";
import { Notices } from "@/components/notice";
import { classLabel, ENROLMENT_LABEL } from "@/lib/academics";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { PASS_MARK } from "@/lib/grading";
import { attendancePercent } from "@/lib/progress";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "Sponsor progress report" };

// A summary only. Students who have not agreed are named but nothing about them is shown.
export default async function SponsorReport({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireCapability("sponsors.manage");
  const { id } = await params;
  const sponsor = await prisma.sponsor.findUnique({
    where: { id },
    include: { sponsorships: { orderBy: { createdAt: "asc" }, include: { enrolment: { include: {
      user: true, result: true, certificate: true, attendance: true, submissions: { where: { submittedAt: { not: null } }, select: { assessmentId: true } },
      class: { include: { course: true, intake: true, assessments: { where: { status: { not: "DRAFT" } }, select: { id: true } } } },
    } } } } },
  });
  if (!sponsor) notFound();
  const agreed = sponsor.sponsorships.filter((s) => s.consentAt);
  const withheld = sponsor.sponsorships.filter((s) => !s.consentAt);
  return (
    <div className="stack lg">
      <div className="stack no-print">
        <p className="small"><Link href={`/admin/sponsors/${sponsor.id}`}>{sponsor.name}</Link></p>
        <Notices params={await searchParams} />
      </div>
      <article className="stack lg">
        <div className="stack">
          <h1>Sponsored student progress report</h1>
          <p>Technical Institute for Many Empowerment (TIME) Inc.</p>
          <p><strong>Sponsor:</strong> {sponsor.name} &nbsp;·&nbsp; <strong>Date:</strong> {formatDate(new Date())} &nbsp;·&nbsp; <strong>Prepared by:</strong> {me.name}</p>
        </div>
        {agreed.map(({ enrolment: e, id: sid }) => {
          const published = e.result?.status === "PUBLISHED" ? e.result : null;
          const att = attendancePercent(e.attendance.map((a) => a.status));
          const handedIn = new Set(e.submissions.map((s) => s.assessmentId)).size;
          const cert = e.certificate && !e.certificate.revokedAt ? e.certificate : null;
          return (
            <section className="card stack" key={sid} aria-label={e.user.name}>
              <h2>{e.user.name} <span className="muted small">· {e.user.studentNumber ?? "no student number"}</span></h2>
              <p className="muted">{classLabel(e.class)}</p>
              <div className="table-wrap"><table><tbody>
                <tr><th scope="row">Enrolment</th><td>{ENROLMENT_LABEL[e.status]}</td></tr>
                <tr><th scope="row">Attendance</th><td>{att === null ? "Not recorded yet" : `${att}% of sessions`}</td></tr>
                <tr><th scope="row">Assessments handed in</th><td>{handedIn} of {e.class.assessments.length}</td></tr>
                <tr><th scope="row">Overall result</th><td>{published ? `${published.total} of 100 (pass mark ${PASS_MARK})` : "Not published yet"}</td></tr>
                <tr><th scope="row">Academic standing</th><td>{published ? (published.passed ? "Good standing: passed" : "Below the pass mark") : "In progress"}</td></tr>
                <tr><th scope="row">Completion</th><td>{cert ? `Completed. ${cert.title} ${cert.number}, awarded ${formatDate(cert.awardedOn)}` : e.class.status === "ENDED" ? "The class has ended; no certificate has been issued" : "In progress"}</td></tr>
              </tbody></table></div>
            </section>
          );
        })}
        {agreed.length === 0 && <p className="card">No student has agreed to share their progress with this sponsor.</p>}
        {withheld.length > 0 && <p className="small muted">Not included, because consent has not been given: {withheld.map((s) => s.enrolment.user.name).join(", ")}.</p>}
        <p className="small muted">This is a summary shared with each student's consent. It does not include individual pieces of work, feedback, messages or financial details.</p>
      </article>
    </div>
  );
}
