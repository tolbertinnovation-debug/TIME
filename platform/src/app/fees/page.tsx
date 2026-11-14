import Link from "next/link";
import { cancelRequestAction } from "@/app/actions";
import { reportPaymentAction, requestArrangementAction } from "@/app/finance-actions";
import { FeePill, feeSentence, PAYMENT_STATE } from "@/components/fees";
import { Notices } from "@/components/notice";
import { classLabel } from "@/lib/academics";
import { prisma } from "@/lib/db";
import { CHARGE_LABEL, formatUsd, METHOD_LABEL } from "@/lib/fees";
import { feeStatuses, paymentDetails } from "@/lib/fees-data";
import { formatDate } from "@/lib/format";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "Fees" };

export default async function Fees({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireCapability("classes.apply");
  const params = await searchParams;
  const enrolments = await prisma.enrolment.findMany({
    where: { userId: user.id }, orderBy: { enrolledAt: "desc" },
    include: { class: { include: { course: true, intake: true } }, charges: { orderBy: { createdAt: "asc" } }, payments: { orderBy: { createdAt: "desc" } }, refunds: { where: { status: "PAID" }, orderBy: { createdAt: "asc" } } },
  });
  const [statuses, details, pending] = await Promise.all([
    feeStatuses(enrolments.map((e) => e.id)),
    paymentDetails(),
    prisma.approvalRequest.findMany({ where: { requestedById: user.id, type: "PAYMENT_ARRANGEMENT", status: "PENDING" } }),
  ]);
  const waiting = new Map(pending.map((r) => [String((r.payload as { enrolmentId?: unknown }).enrolmentId), r]));
  const owing = enrolments.filter((e) => (statuses.get(e.id)?.balanceCents ?? 0) > 0);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="stack lg">
      <div className="stack">
        <h1>Fees</h1>
        {params.notice === "paused" && <p className="notice error" role="alert">You cannot open that class yet. See what is owed below.</p>}
        <Notices params={params} />
      </div>
      {enrolments.length === 0 && <p className="card">You have no fees because you are not enrolled in a class yet. <Link href="/apply">Apply to a class</Link>.</p>}

      {enrolments.map((e) => {
        const status = statuses.get(e.id)!;
        const request = waiting.get(e.id);
        return (
          <article className="card stack" key={e.id}>
            <div className="row between"><h2>{classLabel(e.class)}</h2><FeePill status={status} /></div>
            <p>{feeSentence(status, e.arrangementUntil)}</p>
            <div className="table-wrap"><table>
              <thead><tr><th>Charged</th><th>Amount</th></tr></thead>
              <tbody>
                {e.charges.map((c) => <tr key={c.id}><td>{CHARGE_LABEL[c.kind]}<br /><span className="muted small">{c.description}</span></td><td className="nowrap">{formatUsd(c.amountCents)}</td></tr>)}
                {e.refunds.map((r) => <tr key={r.id}><td>Refund sent to you{r.paidOn ? ` on ${formatDate(r.paidOn)}` : ""}<br /><span className="muted small">{r.reason}{r.method ? ` · ${METHOD_LABEL[r.method]}, ${r.reference}` : ""}</span></td><td className="nowrap">{formatUsd(r.amountCents)}</td></tr>)}
                <tr><td><strong>Paid and confirmed{e.refunds.length ? ", less refunds" : ""}</strong></td><td className="nowrap">{formatUsd(status.paidCents)}</td></tr>
                <tr><td><strong>Balance</strong></td><td className="nowrap"><strong>{formatUsd(status.balanceCents)}</strong></td></tr>
              </tbody>
            </table></div>
            {e.payments.length > 0 && (
              <div className="table-wrap"><table>
                <thead><tr><th>Paid on</th><th>Amount</th><th>How</th><th>Reference</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {e.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="nowrap">{formatDate(p.paidOn)}</td>
                      <td className="nowrap">{formatUsd(p.amountCents)}</td>
                      <td>{METHOD_LABEL[p.method]}</td>
                      <td>{p.reference}</td>
                      <td><span className={`pill ${PAYMENT_STATE[p.status][0]}`}>{PAYMENT_STATE[p.status][1]}</span>{p.rejectReason ? <><br /><span className="small">{p.rejectReason}</span></> : null}</td>
                      <td>{p.status === "CONFIRMED" && <Link className="btn ghost sm" href={`/fees/receipt/${p.id}`}>Receipt {p.receiptNumber}</Link>}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
            {request ? (
              <div className="row">
                <span className="notice info">Your request for more time is waiting with the finance office.</span>
                <form action={cancelRequestAction}><input type="hidden" name="id" value={request.id} /><input type="hidden" name="from" value="fees" /><button className="btn ghost sm" type="submit">Cancel request</button></form>
              </div>
            ) : status.balanceCents > 0 && status.state !== "AWAITING_FIRST" && (
              <details>
                <summary className="small">Ask for more time to pay</summary>
                <form className="form" action={requestArrangementAction} style={{ marginTop: 12 }}>
                  <input type="hidden" name="enrolmentId" value={e.id} />
                  <div className="field"><label htmlFor={`until-${e.id}`}>Date you can pay by</label><input id={`until-${e.id}`} name="until" type="date" required min={today} /></div>
                  <div className="field"><label htmlFor={`why-${e.id}`}>Why you need more time</label><textarea id={`why-${e.id}`} name="note" required minLength={20} maxLength={1000} /></div>
                  <div><button className="btn ghost" type="submit">Send request</button></div>
                </form>
              </details>
            )}
          </article>
        );
      })}

      {owing.length > 0 && (
        <section className="stack" aria-labelledby="pay-h">
          <h2 id="pay-h">How to pay</h2>
          <div className="grid">
            <div className="card stack"><h3>Mobile Money</h3><p style={{ whiteSpace: "pre-line" }}>{details.mobileMoney || "Ask the TIME finance office for the Mobile Money number."}</p></div>
            <div className="card stack"><h3>Bank transfer</h3><p style={{ whiteSpace: "pre-line" }}>{details.bank || "Ask the TIME finance office for the bank account details."}</p></div>
          </div>
          <form className="card form" action={reportPaymentAction}>
            <h3>Tell us about a payment you made</h3>
            <p className="muted small">Pay first, then enter the details here. The finance office checks every payment against the Mobile Money or bank statement before it counts.</p>
            <div className="grid">
              <div className="field"><label htmlFor="enrolmentId">Class</label><select id="enrolmentId" name="enrolmentId" required>{owing.map((e) => <option key={e.id} value={e.id}>{classLabel(e.class)}</option>)}</select></div>
              <div className="field"><label htmlFor="amount">Amount in US dollars</label><input id="amount" name="amount" type="text" inputMode="decimal" required maxLength={12} placeholder="87.50" /></div>
              <div className="field"><label htmlFor="method">How you paid</label><select id="method" name="method" required><option value="MOBILE_MONEY">Mobile Money</option><option value="BANK_TRANSFER">Bank transfer</option></select></div>
              <div className="field"><label htmlFor="reference">Transaction ID or bank reference</label><input id="reference" name="reference" type="text" required minLength={4} maxLength={60} autoComplete="off" /></div>
              <div className="field"><label htmlFor="paidOn">Date you paid</label><input id="paidOn" name="paidOn" type="date" required max={today} defaultValue={today} /></div>
            </div>
            <div><button className="btn" type="submit">Send to Finance</button></div>
          </form>
        </section>
      )}
    </div>
  );
}
