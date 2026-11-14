import Link from "next/link";
import { markRefundPaidAction } from "@/app/finance-actions";
import { Notices } from "@/components/notice";
import { classLabel } from "@/lib/academics";
import { prisma } from "@/lib/db";
import { formatUsd, METHOD_LABEL } from "@/lib/fees";
import { formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "Refunds" };

// Approved refunds waiting to be sent, and the latest ones sent.
export default async function Refunds({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireCapability("finance.view");
  const manage = can(me.role, "finance.manage");
  const include = { paidBy: true, enrolment: { include: { user: true, class: { include: { course: true, intake: true } } } } } as const;
  const [toSend, sent] = await Promise.all([
    prisma.refund.findMany({ where: { status: "APPROVED" }, orderBy: { createdAt: "asc" }, include }),
    prisma.refund.findMany({ where: { status: "PAID" }, orderBy: { paidOn: "desc" }, take: 50, include }),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="stack lg">
      <div className="stack">
        <h1>Refunds</h1>
        <p className="muted">To ask for a refund, open the student&apos;s statement under Student balances. Academic leadership approves it; it then appears here for you to send and record.</p>
        <Notices params={await searchParams} />
      </div>

      <section className="stack" aria-labelledby="send-h">
        <h2 id="send-h">Approved, to send ({toSend.length})</h2>
        {toSend.length === 0 && <p className="card">No approved refunds are waiting to be sent.</p>}
        {toSend.map((r) => (
          <article className="card stack" key={r.id}>
            <div className="row between">
              <h3>{formatUsd(r.amountCents)} to <Link href={`/finance/students/${r.enrolmentId}`}>{r.enrolment.user.name}</Link></h3>
              <span className="pill wait">To send</span>
            </div>
            <p className="small muted">{r.enrolment.user.studentNumber ?? "No student number"} · {classLabel(r.enrolment.class)}{r.enrolment.user.phone ? ` · ${r.enrolment.user.phone}` : ""}</p>
            <p>{r.reason}</p>
            <p className="small muted">Approved by {r.approvedByName} on {formatDate(r.createdAt)}.</p>
            {manage && (
              <form className="form" action={markRefundPaidAction}>
                <input type="hidden" name="refundId" value={r.id} />
                <div className="grid">
                  <div className="field"><label htmlFor={`m-${r.id}`}>How it was sent</label><select id={`m-${r.id}`} name="method" required><option value="MOBILE_MONEY">Mobile Money</option><option value="BANK_TRANSFER">Bank transfer</option></select></div>
                  <div className="field"><label htmlFor={`ref-${r.id}`}>Transaction ID or bank reference</label><input id={`ref-${r.id}`} name="reference" type="text" required minLength={4} maxLength={60} autoComplete="off" /></div>
                  <div className="field"><label htmlFor={`d-${r.id}`}>Date sent</label><input id={`d-${r.id}`} name="paidOn" type="date" required max={today} defaultValue={today} /></div>
                </div>
                <div><button className="btn" type="submit">Record as sent</button></div>
              </form>
            )}
          </article>
        ))}
      </section>

      <section className="stack" aria-labelledby="sent-h">
        <h2 id="sent-h">Sent</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>Sent on</th><th>Student</th><th>Amount</th><th>How</th><th>Reason</th><th>Approved by</th><th>Sent by</th></tr></thead>
          <tbody>
            {sent.map((r) => (
              <tr key={r.id}>
                <td className="nowrap">{r.paidOn ? formatDate(r.paidOn) : ""}</td>
                <td><Link href={`/finance/students/${r.enrolmentId}`}>{r.enrolment.user.name}</Link></td>
                <td className="nowrap">{formatUsd(r.amountCents)}</td>
                <td>{r.method ? `${METHOD_LABEL[r.method]}, ${r.reference}` : ""}</td>
                <td>{r.reason}</td><td>{r.approvedByName}</td><td>{r.paidBy?.name ?? ""}</td>
              </tr>
            ))}
            {sent.length === 0 && <tr><td colSpan={7}>No refunds have been sent yet.</td></tr>}
          </tbody>
        </table></div>
      </section>
    </div>
  );
}
