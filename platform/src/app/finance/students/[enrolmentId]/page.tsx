import Link from "next/link";
import { notFound } from "next/navigation";
import { addChargeAction, recordPaymentAction } from "@/app/finance-actions";
import { FeePill, feeSentence, PAYMENT_STATE } from "@/components/fees";
import { Notices } from "@/components/notice";
import { classLabel } from "@/lib/academics";
import { prisma } from "@/lib/db";
import { CHARGE_LABEL, formatUsd, METHOD_LABEL } from "@/lib/fees";
import { feeStatusOf } from "@/lib/fees-data";
import { formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "Student statement" };

export default async function Statement({ params, searchParams }: { params: Promise<{ enrolmentId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireCapability("finance.view");
  const { enrolmentId } = await params;
  const e = await prisma.enrolment.findUnique({
    where: { id: enrolmentId },
    include: { user: true, class: { include: { course: true, intake: true } }, charges: { orderBy: { createdAt: "asc" } }, payments: { orderBy: { createdAt: "desc" } } },
  });
  if (!e) notFound();
  const status = await feeStatusOf(e.id);
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
        <div className="tile"><b>{formatUsd(status.paidCents)}</b><span>paid and confirmed</span></div>
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
              <div className="field"><label htmlFor="c-kind">Kind</label><select id="c-kind" name="kind" required>{Object.entries(CHARGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
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
    </div>
  );
}
