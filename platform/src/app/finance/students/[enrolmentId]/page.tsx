import Link from "next/link";
import { notFound } from "next/navigation";
import { addChargeAction, recordPaymentAction, requestRefundAction } from "@/app/finance-actions";
import { FeePill, feeSentence, PAYMENT_STATE } from "@/components/fees";
import { Notices } from "@/components/notice";
import { classLabel } from "@/lib/academics";
import { prisma } from "@/lib/db";
import { CHARGE_LABEL, formatUsd, MANUAL_CHARGE_KINDS, METHOD_LABEL, refundableCents } from "@/lib/fees";
import { feeStatusOf, refundFigures } from "@/lib/fees-data";
import { formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "Student statement" };

export default async function Statement({ params, searchParams }: { params: Promise<{ enrolmentId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireCapability("finance.view");
  const { enrolmentId } = await params;
  const e = await prisma.enrolment.findUnique({
    where: { id: enrolmentId },
    include: { user: true, class: { include: { course: true, intake: true } }, charges: { orderBy: { createdAt: "asc" } }, payments: { orderBy: { createdAt: "desc" } }, refunds: { orderBy: { createdAt: "desc" } } },
  });
  if (!e) notFound();
  const [status, figures] = await Promise.all([feeStatusOf(e.id), refundFigures(prisma, e.id)]);
  const refundable = refundableCents(figures);
  const manage = can(me.role, "finance.manage");
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="stack lg">
      <div className="stack">
        <p className="small"><Link href="/finance/students">Student balances</Link></p>
        <div className="row between"><h1>{e.user.name}</h1><FeePill status={status} /></div>
        <p className="muted">{e.user.studentNumber ?? "No student number"} · {classLabel(e.class)}{e.user.phone ? ` · ${e.user.phone}` : ""}</p>
        <Notices params={await searchParams} />
        <p>{feeSentence(status, e.arrangementUntil, "student")}</p>
      </div>
      <div className="grid">
        <div className="tile"><b>{formatUsd(status.chargedCents)}</b><span>charged</span></div>
        <div className="tile"><b>{formatUsd(status.paidCents)}</b><span>paid and confirmed{figures.refundedCents > 0 ? ", less refunds" : ""}</span></div>
        <div className="tile"><b>{formatUsd(status.balanceCents)}</b><span>balance</span></div>
      </div>

      <section className="stack" aria-labelledby="charges-h">
        <h2 id="charges-h">Charges</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>Date</th><th>Charge</th><th>Amount</th></tr></thead>
          <tbody>
            {e.charges.map((c) => <tr key={c.id}><td className="nowrap">{formatDate(c.createdAt)}</td><td>{CHARGE_LABEL[c.kind]}: {c.description}</td><td className="nowrap">{formatUsd(c.amountCents)}</td></tr>)}
            {e.charges.length === 0 && <tr><td colSpan={3}>Nothing has been charged.</td></tr>}
          </tbody>
        </table></div>
        {manage && (
          <form className="card form" action={addChargeAction}>
            <h3>Add a charge</h3>
            <input type="hidden" name="enrolmentId" value={e.id} />
            <div className="grid">
              <div className="field"><label htmlFor="c-kind">Kind</label><select id="c-kind" name="kind" required>{MANUAL_CHARGE_KINDS.map((k) => <option key={k} value={k}>{CHARGE_LABEL[k]}</option>)}</select></div>
              <div className="field"><label htmlFor="c-desc">Description</label><input id="c-desc" name="description" type="text" required maxLength={140} /></div>
              <div className="field"><label htmlFor="c-amount">Amount in US dollars</label><input id="c-amount" name="amount" type="text" inputMode="decimal" required maxLength={12} /></div>
            </div>
            <div><button className="btn ghost" type="submit">Add charge</button></div>
          </form>
        )}
      </section>

      <section className="stack" aria-labelledby="payments-h">
        <h2 id="payments-h">Payments</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>Paid on</th><th>Amount</th><th>How</th><th>Reference</th><th>Status</th><th>Receipt</th></tr></thead>
          <tbody>
            {e.payments.map((p) => (
              <tr key={p.id}>
                <td className="nowrap">{formatDate(p.paidOn)}</td><td className="nowrap">{formatUsd(p.amountCents)}</td><td>{METHOD_LABEL[p.method]}</td><td>{p.reference}</td>
                <td><span className={`pill ${PAYMENT_STATE[p.status][0]}`}>{PAYMENT_STATE[p.status][1]}</span></td>
                <td>{p.receiptNumber ? <Link href={`/fees/receipt/${p.id}`}>{p.receiptNumber}</Link> : "—"}</td>
              </tr>
            ))}
            {e.payments.length === 0 && <tr><td colSpan={6}>No payments yet.</td></tr>}
          </tbody>
        </table></div>
        {manage && (
          <form className="card form" action={recordPaymentAction}>
            <h3>Record a payment you have seen on the statement</h3>
            <p className="muted small">Use this when the student has not reported the payment themselves. It is confirmed at once and a receipt is issued.</p>
            <input type="hidden" name="enrolmentId" value={e.id} />
            <div className="grid">
              <div className="field"><label htmlFor="p-amount">Amount in US dollars</label><input id="p-amount" name="amount" type="text" inputMode="decimal" required maxLength={12} /></div>
              <div className="field"><label htmlFor="p-method">How it was paid</label><select id="p-method" name="method" required><option value="MOBILE_MONEY">Mobile Money</option><option value="BANK_TRANSFER">Bank transfer</option></select></div>
              <div className="field"><label htmlFor="p-ref">Transaction ID or bank reference</label><input id="p-ref" name="reference" type="text" required minLength={4} maxLength={60} autoComplete="off" /></div>
              <div className="field"><label htmlFor="p-date">Date paid</label><input id="p-date" name="paidOn" type="date" required max={today} defaultValue={today} /></div>
            </div>
            <div><button className="btn" type="submit">Record payment</button></div>
          </form>
        )}
      </section>

      <section className="stack" aria-labelledby="refunds-h">
        <h2 id="refunds-h">Refunds</h2>
        {figures.pendingRequests > 0 && <p className="notice info" role="status">A refund request is waiting for approval by academic leadership.</p>}
        {e.refunds.length > 0 ? (
          <div className="table-wrap"><table>
            <thead><tr><th>Approved</th><th>Amount</th><th>Reason</th><th>Status</th><th>Sent</th></tr></thead>
            <tbody>
              {e.refunds.map((r) => (
                <tr key={r.id}>
                  <td className="nowrap">{formatDate(r.createdAt)}<br /><span className="small muted">by {r.approvedByName}</span></td>
                  <td className="nowrap">{formatUsd(r.amountCents)}</td><td>{r.reason}</td>
                  <td><span className={`pill ${r.status === "PAID" ? "ok" : "wait"}`}>{r.status === "PAID" ? "Sent" : "To send"}</span></td>
                  <td>{r.status === "PAID" && r.method ? `${METHOD_LABEL[r.method]}, ${r.reference}, ${r.paidOn ? formatDate(r.paidOn) : ""}` : <Link href="/finance/refunds">Record it</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : !figures.pendingRequests && <p className="muted">No refunds.</p>}
        {manage && figures.pendingRequests === 0 && (refundable > 0 || status.balanceCents > 0) && (
          <form className="card form" action={requestRefundAction}>
            <h3>Ask for a refund or to cancel the balance</h3>
            <p className="muted small">Academic leadership approves it first. Nothing changes until then. At most {formatUsd(refundable)} can be refunded: what this student has paid and has not had back.</p>
            <input type="hidden" name="enrolmentId" value={e.id} />
            <div className="field"><label htmlFor="r-amount">Amount to refund, in US dollars</label><input id="r-amount" name="amount" type="text" inputMode="decimal" maxLength={12} placeholder="0" /><p className="small muted">Leave empty to cancel the balance without a refund.</p></div>
            {status.balanceCents > 0 && (
              <label className="row" style={{ gap: 8 }}><input type="checkbox" name="cancelBalance" value="yes" style={{ width: "auto", minHeight: 0 }} /> Also cancel the {formatUsd(status.balanceCents)} still to pay (for example, the student has withdrawn)</label>
            )}
            <div className="field"><label htmlFor="r-reason">Reason</label><textarea id="r-reason" name="reason" required minLength={10} maxLength={500} /></div>
            <div><button className="btn ghost" type="submit">Send for approval</button></div>
          </form>
        )}
      </section>
    </div>
  );
}
