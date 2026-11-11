import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { can, ROLE_LABEL, ROLES, visibleApprovalTypes } from "@/lib/permissions";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "Administration" };

export default async function AdminOverview() {
  const user = await requireCapability("admin.area");
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const seeActivity = can(user.role, "activity.view"), types = visibleApprovalTypes(user.role), seeApprovals = types.length > 0;
  const [byRole, suspended, pending, activity24h, recent, classCount, enrolled] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: true }),
    prisma.user.count({ where: { status: "SUSPENDED" } }),
    seeApprovals ? prisma.approvalRequest.count({ where: { status: "PENDING", type: { in: types } } }) : Promise.resolve(0),
    seeActivity ? prisma.auditLog.count({ where: { createdAt: { gte: since } } }) : Promise.resolve(0),
    seeActivity ? prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }) : Promise.resolve([]),
    prisma.courseClass.count(),
    prisma.enrolment.count({ where: { status: "ACTIVE" } }),
  ]);
  const count = new Map(byRole.map((r) => [r.role, r._count]));
  const total = byRole.reduce((n, r) => n + r._count, 0);
  return (
    <div className="stack lg">
      <h1>Administration</h1>
      <div className="grid">
        <Link className="tile" href="/admin/users"><b>{total}</b><span>accounts{suspended ? ` · ${suspended} suspended` : ""}</span></Link>
        {seeApprovals && <Link className="tile" href="/admin/approvals"><b>{pending}</b><span>{pending === 1 ? "approval" : "approvals"} waiting</span></Link>}
        {can(user.role, "enrolments.view") && <Link className="tile" href="/admin/classes"><b>{enrolled}</b><span>students enrolled in {classCount} {classCount === 1 ? "class" : "classes"}</span></Link>}
        {seeActivity && <Link className="tile" href="/admin/activity"><b>{activity24h}</b><span>actions recorded in the last 24 hours</span></Link>}
      </div>
      <section className="stack" aria-labelledby="roles-h">
        <h2 id="roles-h">Accounts by role</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>Role</th><th>Accounts</th></tr></thead>
          <tbody>{ROLES.map((r) => <tr key={r}><td>{ROLE_LABEL[r]}</td><td>{count.get(r) ?? 0}</td></tr>)}</tbody>
        </table></div>
      </section>
      {seeActivity && (
        <section className="stack" aria-labelledby="recent-h">
          <div className="row between"><h2 id="recent-h">Latest activity</h2><Link href="/admin/activity">See all activity</Link></div>
          <div className="table-wrap"><table>
            <thead><tr><th>When</th><th>What happened</th></tr></thead>
            <tbody>{recent.map((a) => <tr key={a.id}><td className="nowrap">{formatDateTime(a.createdAt)}</td><td>{a.summary}</td></tr>)}</tbody>
          </table></div>
        </section>
      )}
    </div>
  );
}
