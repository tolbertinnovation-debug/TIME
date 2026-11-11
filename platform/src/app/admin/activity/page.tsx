import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { requireCapability } from "@/lib/session";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Activity" };
const PAGE = 50;

// Groups of actions, matched on the first part of the action name.
const GROUPS = { auth: "Sign-ins", account: "New accounts", user: "Account changes", approval: "Approvals" } as const;

export default async function Activity({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireCapability("activity.view");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const group = typeof params.group === "string" && params.group in GROUPS ? (params.group as keyof typeof GROUPS) : null;
  const page = Math.max(1, Number(params.page) || 1);
  const where: Prisma.AuditLogWhereInput = {
    ...(q ? { OR: [{ summary: { contains: q, mode: "insensitive" } }, { actorLabel: { contains: q, mode: "insensitive" } }] } : {}),
    ...(group ? { action: { startsWith: `${group}.` } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    prisma.auditLog.count({ where }),
  ]);
  const link = (p: number) => `/admin/activity?${new URLSearchParams({ ...(q ? { q } : {}), ...(group ? { group } : {}), page: String(p) })}`;
  return (
    <div className="stack lg">
      <div className="stack">
        <h1>Activity</h1>
        <p className="muted">Everything that happens on the platform is recorded here: sign-ins, new accounts, role changes, suspensions and every approval decision. Entries cannot be edited or removed.</p>
        <form className="inline-form" method="get" role="search">
          <label className="skip" htmlFor="q">Search by person or words</label>
          <input id="q" name="q" type="search" placeholder="Person or words" defaultValue={q} />
          <label className="skip" htmlFor="group">Kind of activity</label>
          <select id="group" name="group" defaultValue={group ?? ""}>
            <option value="">All activity</option>
            {Object.entries(GROUPS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="btn sm" type="submit">Filter</button>
        </form>
        <p className="muted small">{total} {total === 1 ? "entry" : "entries"}</p>
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>When</th><th>Who</th><th>What happened</th><th>Kind</th></tr></thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td className="nowrap">{formatDateTime(a.createdAt)}</td>
              <td>{a.actorLabel}</td>
              <td>{a.summary}</td>
              <td><code>{a.action}</code></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4}>No activity matches.</td></tr>}
        </tbody>
      </table></div>
      {total > PAGE && (
        <div className="pager">
          {page > 1 ? <a className="btn ghost sm" href={link(page - 1)}>Newer</a> : <span />}
          <span className="muted small">Page {page} of {Math.ceil(total / PAGE)}</span>
          {page * PAGE < total ? <a className="btn ghost sm" href={link(page + 1)}>Older</a> : <span />}
        </div>
      )}
    </div>
  );
}
