import Link from "next/link";
import { openTicketAction } from "@/app/community-actions";
import { Notices } from "@/components/notice";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { SUPPORT_CATEGORIES, SUPPORT_LABEL } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Help" };

const TICKET_STATUS = { OPEN: ["wait", "Waiting for TIME"], ANSWERED: ["ok", "Answered"], CLOSED: ["plain", "Closed"] } as const;

export default async function Help({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const tickets = await prisma.supportTicket.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 30 });
  return (
    <div className="stack lg" style={{ maxWidth: 720 }}>
      <div className="stack">
        <h1>Help</h1>
        <p className="muted">Ask the TIME office for help. Questions about fees go to the finance office; everything else goes to the registrar.</p>
        <Notices params={await searchParams} />
      </div>
      <form className="card form" action={openTicketAction}>
        <h2>Ask for help</h2>
        <div className="field"><label htmlFor="category">What is it about?</label><select id="category" name="category" required>{SUPPORT_CATEGORIES.map((c) => <option key={c} value={c}>{SUPPORT_LABEL[c]}</option>)}</select></div>
        <div className="field"><label htmlFor="subject">Short title</label><input id="subject" name="subject" type="text" required maxLength={140} /></div>
        <div className="field"><label htmlFor="body">What do you need?</label><textarea id="body" name="body" required minLength={10} maxLength={3000} /></div>
        <div><button className="btn" type="submit">Send request</button></div>
      </form>
      {tickets.length > 0 && (
        <section className="stack" aria-labelledby="mine-h">
          <h2 id="mine-h">Your requests</h2>
          <div className="table-wrap"><table>
            <thead><tr><th>Request</th><th>About</th><th>Updated</th><th>Status</th></tr></thead>
            <tbody>{tickets.map((t) => (
              <tr key={t.id}><td><Link href={`/help/${t.id}`}><strong>{t.subject}</strong></Link></td><td>{SUPPORT_LABEL[t.category]}</td><td className="nowrap">{formatDateTime(t.updatedAt)}</td><td><span className={`pill ${TICKET_STATUS[t.status][0]}`}>{TICKET_STATUS[t.status][1]}</span></td></tr>
            ))}</tbody>
          </table></div>
        </section>
      )}
    </div>
  );
}
