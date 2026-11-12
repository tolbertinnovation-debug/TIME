import Link from "next/link";
import { notFound } from "next/navigation";
import { classLabel } from "@/lib/academics";
import { prisma } from "@/lib/db";
import { formatUsd, METHOD_LABEL } from "@/lib/fees";
import { formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Receipt" };

export default async function Receipt({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const p = await prisma.payment.findUnique({ where: { id }, include: { decidedBy: true, enrolment: { include: { user: true, class: { include: { course: true, intake: true } } } } } });
  // A receipt is shown only to the student it belongs to, and to finance staff.
  if (!p || p.status !== "CONFIRMED" || (p.enrolment.userId !== user.id && !can(user.role, "finance.view"))) notFound();
  return (
    <div className="stack lg" style={{ maxWidth: 560 }}>
      <p className="small"><Link href={p.enrolment.userId === user.id ? "/fees" : `/finance/students/${p.enrolmentId}`}>Back to fees</Link></p>
      <article className="card stack">
        <div className="row between"><h1 style={{ fontSize: "1.4rem" }}>Receipt {p.receiptNumber}</h1><span className="pill ok">Payment confirmed</span></div>
        <p className="muted">Technical Institute for Many Empowerment (TIME) Inc.</p>
        <div className="table-wrap"><table><tbody>
          <tr><th scope="row">Received from</th><td>{p.enrolment.user.name}{p.enrolment.user.studentNumber ? ` (${p.enrolment.user.studentNumber})` : ""}</td></tr>
          <tr><th scope="row">For</th><td>{classLabel(p.enrolment.class)}</td></tr>
          <tr><th scope="row">Amount</th><td><strong>{formatUsd(p.amountCents)}</strong></td></tr>
          <tr><th scope="row">Paid by</th><td>{METHOD_LABEL[p.method]}, reference {p.reference}</td></tr>
          <tr><th scope="row">Paid on</th><td>{formatDate(p.paidOn)}</td></tr>
          <tr><th scope="row">Confirmed</th><td>{p.decidedAt ? formatDate(p.decidedAt) : ""} by {p.decidedBy?.name ?? "the finance office"}</td></tr>
        </tbody></table></div>
        <p className="small muted">Keep this receipt. Use your browser's print or save option if you need a copy.</p>
      </article>
    </div>
  );
}
