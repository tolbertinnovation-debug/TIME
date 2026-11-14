import Link from "next/link";
import { Notices } from "@/components/notice";
import { prisma } from "@/lib/db";
import { formatUsd, WARN_DAYS } from "@/lib/fees";
import { feeStatuses } from "@/lib/fees-data";
import { can, ROLE_LABEL, visibleApprovalTypes } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Home" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const params = await searchParams;
  const types = visibleApprovalTypes(user.role);
  const teaches = user.role === "LECTURER" || user.role === "FACILITATOR";
  const [myRequest, pendingCount, courseCount, myEnrolments, myTeaching, unread] = await Promise.all([
    prisma.approvalRequest.findFirst({ where: { requestedById: user.id, status: "PENDING", type: "STAFF_ACCESS" } }),
    types.length ? prisma.approvalRequest.count({ where: { status: "PENDING", type: { in: types } } }) : Promise.resolve(0),
    prisma.course.count({ where: { active: true } }),
    can(user.role, "classes.apply") ? prisma.enrolment.count({ where: { userId: user.id, status: "ACTIVE" } }) : Promise.resolve(0),
    teaches ? prisma.classStaff.count({ where: { userId: user.id } }) : Promise.resolve(0),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  // Warn a student whose balance is due soon, or whose access is paused.
  const mine = can(user.role, "classes.apply") ? await prisma.enrolment.findMany({ where: { userId: user.id, status: "ACTIVE" }, select: { id: true } }) : [];
  const fees = [...(await feeStatuses(mine.map((e) => e.id))).values()];
  const paused = fees.filter((f) => !f.hasAccess);
  const dueSoon = fees.filter((f) => f.state === "OWING" && f.daysLeft !== null && f.daysLeft <= WARN_DAYS);
  return (
    <div className="stack lg">
      <div className="stack">
        <h1>Welcome, {user.name.split(" ")[0]}</h1>
        <p className="muted">You are signed in as <strong>{ROLE_LABEL[user.role]}</strong>.</p>
        {params.notice === "not-allowed" && <p className="notice error" role="alert">Your role does not allow you to open that page.</p>}
        <Notices params={params} />
        {paused.length > 0 && <p className="notice error" role="alert">You owe {formatUsd(paused.reduce((n, f) => n + f.balanceCents, 0))} and cannot open {paused.length === 1 ? "a class" : "some classes"} yet. <Link href="/fees">See your fees</Link>.</p>}
        {dueSoon.map((f, i) => <p className="notice info" role="status" key={i}>Your balance of {formatUsd(f.balanceCents)} is due in {f.daysLeft} {f.daysLeft === 1 ? "day" : "days"}. <Link href="/fees">Pay and tell Finance</Link>.</p>)}
        {unread > 0 && <p className="notice info" role="status">You have {unread} unread {unread === 1 ? "notification" : "notifications"}. <Link href="/notifications">Read {unread === 1 ? "it" : "them"}</Link>.</p>}
        {myRequest && <p className="notice info" role="status">Your staff access request is waiting for an administrator's decision.</p>}
      </div>
      <div className="grid">
        {can(user.role, "classes.apply") && (myEnrolments > 0
          ? <Link className="tile" href="/my-classes"><b>{myEnrolments}</b><span>{myEnrolments === 1 ? "class" : "classes"} you are enrolled in</span></Link>
          : <Link className="tile" href="/apply"><b>Apply</b><span>to join a class in the next intake</span></Link>)}
        {teaches && <Link className="tile" href="/teach"><b>{myTeaching}</b><span>{myTeaching === 1 ? "class" : "classes"} assigned to you</span></Link>}
        <Link className="tile" href="/catalogue"><b>{courseCount}</b><span>courses across TIME's schools and programs</span></Link>
        {types.length > 0 && <Link className="tile" href="/admin/approvals"><b>{pendingCount}</b><span>{pendingCount === 1 ? "request is" : "requests are"} waiting for a decision</span></Link>}
        {can(user.role, "admin.area") && <Link className="tile" href="/admin"><b>Administration</b><span>accounts, approvals and the activity log</span></Link>}
      </div>
      <section className="card stack" aria-labelledby="account-h">
        <h2 id="account-h">Your account</h2>
        <p>{user.name}<br /><span className="muted">{user.email}{user.phone ? ` · ${user.phone}` : ""}</span></p>
        <p className="small"><Link href="/account/settings">Change your password or phone number</Link></p>
        {user.role === "STUDENT" && <p className="small">Do you teach or work at TIME? <Link href="/account/staff-access">Ask for staff access</Link>.</p>}
      </section>
    </div>
  );
}
