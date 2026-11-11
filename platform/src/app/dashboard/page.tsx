import Link from "next/link";
import { Notices } from "@/components/notice";
import { prisma } from "@/lib/db";
import { can, ROLE_LABEL } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Home" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const params = await searchParams;
  const [myRequest, pendingCount, courseCount] = await Promise.all([
    prisma.approvalRequest.findFirst({ where: { requestedById: user.id, status: "PENDING" } }),
    can(user.role, "approvals.view") ? prisma.approvalRequest.count({ where: { status: "PENDING" } }) : Promise.resolve(0),
    prisma.course.count({ where: { active: true } }),
  ]);
  return (
    <div className="stack lg">
      <div className="stack">
        <h1>Welcome, {user.name.split(" ")[0]}</h1>
        <p className="muted">You are signed in as <strong>{ROLE_LABEL[user.role]}</strong>.</p>
        {params.notice === "not-allowed" && <p className="notice error" role="alert">Your role does not allow you to open that page.</p>}
        <Notices params={params} />
        {myRequest && <p className="notice info" role="status">Your staff access request is waiting for an administrator's decision.</p>}
      </div>
      <div className="grid">
        <Link className="tile" href="/catalogue"><b>{courseCount}</b><span>courses across TIME's schools and programs</span></Link>
        {can(user.role, "approvals.view") && <Link className="tile" href="/admin/approvals"><b>{pendingCount}</b><span>{pendingCount === 1 ? "request is" : "requests are"} waiting for a decision</span></Link>}
        {can(user.role, "admin.area") && <Link className="tile" href="/admin"><b>Administration</b><span>accounts, approvals and the activity log</span></Link>}
      </div>
      <section className="card stack" aria-labelledby="account-h">
        <h2 id="account-h">Your account</h2>
        <p>{user.name}<br /><span className="muted">{user.email}{user.phone ? ` · ${user.phone}` : ""}</span></p>
        {user.role === "STUDENT" && <p className="small">Do you teach or work at TIME? <Link href="/account/staff-access">Ask for staff access</Link>.</p>}
      </section>
    </div>
  );
}
