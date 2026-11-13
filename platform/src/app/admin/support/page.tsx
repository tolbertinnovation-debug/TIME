import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { SUPPORT_LABEL, supportCategoriesFor } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Help desk" };

const STATUS = { OPEN: ["wait", "Waiting for you"], ANSWERED: ["ok", "Answered"], CLOSED: ["plain", "Closed"] } as const;

export default async function SupportDesk({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireUser();
  const categories = supportCategoriesFor(me.role);
  if (!categories.length) redirect("/dashboard?notice=not-allowed");
  const params = await searchParams;
  const closed = params.show === "closed";
  // Each role sees only the kinds of request it answers.
  const tickets = await prisma.supportTicket.findMany({
    where: { category: { in: categories }, status: closed ? "CLOSED" : { not: "CLOSED" } },
    orderBy: [{ status: "asc" }, { updatedAt: "asc" }], take: 100, include: { user: true },
  });
  return (
    <div className="stack lg">
      <div className="stack">
        <h1>Help desk</h1>
        <p className="muted">Requests about: {categories.map((c) => SUPPORT_LABEL[c].toLowerCase()).join("; ")}.</p>
        <nav className="subnav" aria-label="Show">
          <Link href="/admin/support" aria-current={closed ? undefined : "page"}>Open</Link>
          <Link href="/admin/support?show=closed" aria-current={closed ? "page" : undefined}>Closed</Link>
        </nav>
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>Request</th><th>From</th><th>About</th><th>Updated</th><th>Status</th></tr></thead>
        <tbody>
          {tickets.map((t) => (
            <tr key={t.id}>
              <td><Link href={`/help/${t.id}`}><strong>{t.subject}</strong></Link></td>
              <td>{t.user.name}</td><td>{SUPPORT_LABEL[t.category]}</td>
              <td className="nowrap">{formatDateTime(t.updatedAt)}</td>
              <td><span className={`pill ${STATUS[t.status][0]}`}>{STATUS[t.status][1]}</span></td>
            </tr>
          ))}
          {tickets.length === 0 && <tr><td colSpan={5}>{closed ? "No closed requests." : "No requests are open."}</td></tr>}
        </tbody>
      </table></div>
    </div>
  );
}
