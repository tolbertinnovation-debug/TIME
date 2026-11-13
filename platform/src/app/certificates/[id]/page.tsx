import Link from "next/link";
import { notFound } from "next/navigation";
import { CertificateView } from "@/components/certificate";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Certificate" };

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const cert = await prisma.certificate.findUnique({ where: { id } });
  // Shown only to its holder and to staff who manage certificates.
  if (!cert || (cert.userId !== user.id && !can(user.role, "certificates.view"))) notFound();
  return (
    <div className="stack lg">
      <div className="stack no-print">
        <p className="small"><Link href={cert.userId === user.id ? "/certificates" : "/admin/certificates"}>Certificates</Link></p>
        <h1>{cert.title}: {cert.number}</h1>
        <p className="muted">To print, use your browser's Print option and choose landscape. The certificate is signed by hand after printing. Anyone can check it at the Check a certificate page with the ID and code printed on it.</p>
        {cert.revokedAt && <p className="notice error" role="alert">This certificate was revoked: {cert.revokeReason}</p>}
      </div>
      <CertificateView cert={cert} />
    </div>
  );
}
