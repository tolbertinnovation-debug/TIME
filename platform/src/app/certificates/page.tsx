import Link from "next/link";
import { requestCertificateAction } from "@/app/certificate-actions";
import { Checklist } from "@/components/certificate";
import { Notices } from "@/components/notice";
import { classLabel } from "@/lib/academics";
import { certificateStanding } from "@/lib/certificate-data";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "Certificates" };

const STAGE = { CERTIFICATE_VERIFY: "The registrar is checking your record.", CERTIFICATE_ISSUE: "Your record has been checked. Academic leadership is approving your certificate." } as const;

export default async function Certificates({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireCapability("classes.apply");
  const enrolments = await prisma.enrolment.findMany({ where: { userId: user.id, status: { in: ["ACTIVE", "COMPLETED"] } }, orderBy: { enrolledAt: "desc" }, select: { id: true } });
  const [standings, requests] = await Promise.all([
    Promise.all(enrolments.map((e) => certificateStanding(e.id))),
    prisma.approvalRequest.findMany({ where: { requestedById: user.id, type: { in: ["CERTIFICATE_VERIFY", "CERTIFICATE_ISSUE"] } }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <div className="stack lg">
      <div className="stack">
        <h1>Certificates</h1>
        <p className="muted">When a class has ended, you have passed and your fees are cleared, you can request your certificate here.</p>
        <Notices params={await searchParams} />
      </div>
      {standings.length === 0 && <p className="card">You are not enrolled in a class yet. <Link href="/apply">Apply to a class</Link>.</p>}
      {standings.map((s) => {
        if (!s) return null;
        const { enrolment, checks, eligible } = s;
        const mine = requests.filter((r) => (r.payload as { enrolmentId?: unknown }).enrolmentId === enrolment.id);
        const pending = mine.find((r) => r.status === "PENDING");
        const rejected = !pending && mine[0]?.status === "REJECTED" ? mine[0] : null;
        const cert = enrolment.certificate;
        return (
          <article className="card stack" key={enrolment.id}>
            <div className="row between">
              <h2>{classLabel(enrolment.class)}</h2>
              {cert ? <span className={`pill ${cert.revokedAt ? "bad" : "ok"}`}>{cert.revokedAt ? "Revoked" : "Issued"}</span> : pending ? <span className="pill wait">Requested</span> : null}
            </div>
            {cert ? (
              <>
                <p>{cert.title}, {cert.field}. ID NO {cert.number}, awarded {formatDate(cert.awardedOn)}.{cert.revokedAt ? ` This certificate was revoked: ${cert.revokeReason}` : ""}</p>
                <div><Link className="btn" href={`/certificates/${cert.id}`}>Open my certificate</Link></div>
              </>
            ) : (
              <>
                <Checklist checks={checks} />
                {pending && <p className="notice info" role="status">{STAGE[pending.type as keyof typeof STAGE]}</p>}
                {rejected && <p className="notice error">Your last request was not approved: {rejected.decisionNote}</p>}
                {!pending && eligible && (
                  <form action={requestCertificateAction}><input type="hidden" name="enrolmentId" value={enrolment.id} /><button className="btn" type="submit">Request my certificate</button></form>
                )}
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}
