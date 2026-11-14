import Link from "next/link";
import { notFound } from "next/navigation";
import { replyTicketAction } from "@/app/community-actions";
import { Notices } from "@/components/notice";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABEL, SUPPORT_LABEL, supportCategoriesFor } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Help request" };

const STATUS = { OPEN: ["wait", "Waiting for TIME"], ANSWERED: ["ok", "Answered"], CLOSED: ["plain", "Closed"] } as const;

export default async function Ticket({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const { id } = await params;
  const ticket = await prisma.supportTicket.findUnique({ where: { id }, include: { user: true, messages: { orderBy: { createdAt: "asc" }, include: { author: true } } } });
  // Only the person who asked, and the staff who handle that kind of request, can open it.
  const staff = !!ticket && supportCategoriesFor(user.role).includes(ticket.category) && ticket.userId !== user.id;
  if (!ticket || (ticket.userId !== user.id && !staff)) notFound();
  return (
    <div className="stack lg" style={{ maxWidth: 720 }}>
      <div className="stack">
        <p className="small"><Link href={staff ? "/admin/support" : "/help"}>{staff ? "Help desk" : "Help"}</Link></p>
        <div className="row between"><h1>{ticket.subject}</h1><span className={`pill ${STATUS[ticket.status][0]}`}>{STATUS[ticket.status][1]}</span></div>
        <p className="muted">{SUPPORT_LABEL[ticket.category]}{staff ? ` · from ${ticket.user.name} (${ROLE_LABEL[ticket.user.role]}), ${ticket.user.email}${ticket.user.phone ? `, ${ticket.user.phone}` : ""}` : ""}</p>
        <Notices params={await searchParams} />
      </div>
      {ticket.messages.map((m) => (
        <article className="card stack" key={m.id} style={{ gap: 4 }}>
          <p className="small muted"><strong>{m.authorId === ticket.userId ? ticket.user.name : `${m.author?.name ?? "TIME staff"} (TIME office)`}</strong> · {formatDateTime(m.createdAt)}</p>
          <p style={{ whiteSpace: "pre-line" }}>{m.body}</p>
        </article>
      ))}
      <form className="card form" action={replyTicketAction}>
        <input type="hidden" name="ticketId" value={ticket.id} />
        <div className="field"><label htmlFor="reply">{ticket.status === "CLOSED" ? "Write again to reopen this request" : "Your reply"}</label><textarea id="reply" name="body" maxLength={3000} /></div>
        <div className="row">
          <button className="btn" type="submit">Send reply</button>
          {ticket.status !== "CLOSED" && <button className="btn ghost" type="submit" name="close" value="yes">{staff ? "Close request" : "This is solved: close it"}</button>}
        </div>
      </form>
    </div>
  );
}
