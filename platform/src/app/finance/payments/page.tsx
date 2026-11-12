import Link from "next/link";
import { confirmPaymentAction, rejectPaymentAction } from "@/app/finance-actions";
import { PAYMENT_STATE } from "@/components/fees";
import { Notices } from "@/components/notice";
import { classLabel } from "@/lib/academics";
import { prisma } from "@/lib/db";
import { formatUsd, METHOD_LABEL } from "@/lib/fees";
import { formatDate, formatDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "Payments" };

export default async function Payments({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireCapability("finance.view");
  const params = await searchParams;
  const decided = params.show === "decided";
  const payments = await prisma.payment.findMany({
    where: { status: decided ? { not: "SUBMITTED" } : "SUBMITTED" },
    orderBy: { createdAt: decided ? "desc" : "asc" }, take: 100,
    include: { decidedBy: true, enrolment: { include: { user: true, class: { include: { course: true, intake: true } } } } },
  });
  const manage = can(me.role, "finance.manage");
  return (
    <div className="stack lg">
      <div className="stack">
        <h1>Payments</h1>
        <p className="muted">Find each transaction on the Mobile Money or bank statement before you confirm it. Check the amount and the date. A student's message or screenshot is not proof.</p>
        <Notices params={params} />
        <nav className="subnav" aria-label="Show">
          <Link href="/finance/payments" aria-current={decided ? undefined : "page"}>To confirm</Link>
          <Link href="/finance/payments?show=decided" aria-current={decided ? "page" : undefined}>Confirmed and rejected</Link>
        </nav>
      </div>
      {payments.length === 0 && <p className="card">{decided ? "No payments have been confirmed or rejected yet." : "No payments are waiting."}</p>}
      {payments.map((p) => (
        <article className="card stack" key={p.id}>
          <div className="row between">
            <h2>{formatUsd(p.amountCents)} <span className="muted small">· {METHOD_LABEL[p.method]}</span></h2>
            <span className={`pill ${PAYMENT_STATE[p.status][0]}`}>{PAYMENT_STATE[p.status][1]}</span>
          </div>
          <p><strong>Reference: {p.reference}</strong> · paid on {formatDate(p.paidOn)}</p>
          <p><Link href={`/finance/students/${p.enrolmentId}`}>{p.enrolment.user.name}</Link>{p.enrolment.user.studentNumber ? ` (${p.enrolment.user.studentNumber})` : ""} · {classLabel(p.enrolment.class)} <span className="muted small">· reported {formatDateTime(p.createdAt)}</span></p>
          {p.status !== "SUBMITTED" && <p className="small muted">{PAYMENT_STATE[p.status][1]} by {p.decidedBy?.name ?? "a removed account"}{p.decidedAt ? ` on ${formatDateTime(p.decidedAt)}` : ""}{p.receiptNumber ? ` · receipt ${p.receiptNumber}` : ""}{p.rejectReason ? `: "${p.rejectReason}"` : ""}</p>}
          {p.status === "SUBMITTED" && manage && (
            <div className="row" style={{ alignItems: "flex-end" }}>
              <form action={confirmPaymentAction}><input type="hidden" name="paymentId" value={p.id} /><button className="btn" type="submit">Confirm payment</button></form>
              <form className="inline-form" action={rejectPaymentAction}>
                <input type="hidden" name="paymentId" value={p.id} />
                <label className="skip" htmlFor={`reason-${p.id}`}>Reason for rejecting</label>
                <input id={`reason-${p.id}`} name="reason" type="text" required minLength={5} maxLength={500} placeholder="Reason for rejecting" />
                <button className="btn danger" type="submit">Reject</button>
              </form>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
