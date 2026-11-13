import Link from "next/link";
import { markNotificationsReadAction } from "@/app/community-actions";
import { Notices } from "@/components/notice";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Notifications" };

export default async function Notifications({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const items = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 60 });
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <div className="stack lg" style={{ maxWidth: 720 }}>
      <div className="stack">
        <h1>Notifications</h1>
        <Notices params={await searchParams} />
        {unread > 0 && <form action={markNotificationsReadAction}><button className="btn ghost sm" type="submit">Mark all {unread} as read</button></form>}
      </div>
      {items.length === 0 && <p className="card">Nothing yet. You will see approvals, payments, results and messages from your class here.</p>}
      {items.map((n) => (
        <article className="card stack" key={n.id} style={{ gap: 4, borderColor: n.readAt ? undefined : "var(--olive-deep)" }}>
          <div className="row between"><h2 style={{ fontSize: "1.02rem" }}>{n.title}</h2>{!n.readAt && <span className="pill">New</span>}</div>
          <p style={{ whiteSpace: "pre-line" }}>{n.body}</p>
          <p className="small muted">{formatDateTime(n.createdAt)}{n.href ? <> · <Link href={n.href}>Open</Link></> : null}</p>
        </article>
      ))}
    </div>
  );
}
