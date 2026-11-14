import Link from "next/link";
import { notFound } from "next/navigation";
import { Checklist } from "@/components/certificate";
import { classLabel } from "@/lib/academics";
import { certificateKind } from "@/lib/certificate";
import { certificateStanding } from "@/lib/certificate-data";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "Student record" };

// What the registrar and academic leadership check before a certificate is issued.
export default async function CertificateRecord({ params }: { params: Promise<{ enrolmentId: string }> }) {
  await requireCapability("certificates.view");
  const { enrolmentId } = await params;
  const standing = await certificateStanding(enrolmentId);
  if (!standing) notFound();
  const { enrolment, checks, eligible } = standing;
  const kind = certificateKind(enrolment.class.course.programId);
  return (
    <div className="stack lg" style={{ maxWidth: 680 }}>
      <div className="stack">
        <p className="small"><Link href="/admin/approvals">Approvals</Link></p>
        <h1>{enrolment.user.name}</h1>
        <p className="muted">{enrolment.user.studentNumber ?? "No student number"} · {classLabel(enrolment.class)}</p>
      </div>
      <section className="card stack" aria-labelledby="checks-h">
        <div className="row between"><h2 id="checks-h">Record for the certificate</h2><span className={`pill ${eligible ? "ok" : "bad"}`}>{eligible ? "Qualifies" : "Does not qualify yet"}</span></div>
        <Checklist checks={checks.map((c) => ({ ...c, label: c.label.replace("You passed", "Passed").replace("Your fees are cleared", "Fees are cleared"), detail: c.detail.replace(/^Your result/, "The result").replace("You still owe", "Still owes") }))} />
      </section>
      <section className="card stack" aria-labelledby="award-h">
        <h2 id="award-h">What will be issued</h2>
        <p>{kind.title}, {kind.field(enrolment.class.course.title)}, in the name <strong>{enrolment.user.name}</strong>. The name is printed exactly as it is on the account, so check its spelling.</p>
        {enrolment.certificate && <p className="notice ok">Already issued: <Link href={`/certificates/${enrolment.certificate.id}`}>{enrolment.certificate.number}</Link></p>}
      </section>
    </div>
  );
}
