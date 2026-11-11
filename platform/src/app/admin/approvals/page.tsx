import Link from "next/link";
import { decideApprovalAction } from "@/app/actions";
import { Notices } from "@/components/notice";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { APPROVAL_LABEL, canDecide, isRole, ROLE_LABEL, type ApprovalType } from "@/lib/permissions";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "Approvals" };

const STATUS = { PENDING: ["wait", "Waiting"], APPROVED: ["ok", "Approved"], REJECTED: ["bad", "Rejected"], CANCELLED: ["plain", "Cancelled"] } as const;

// What the request asks for, in plain words.
function describe(type: ApprovalType, payload: unknown): string {
  if (type === "STAFF_ACCESS") {
    const role = (payload as { role?: unknown }).role;
    return isRole(role) ? `Asks for the ${ROLE_LABEL[role]} role` : "Asks for a staff role";
  }
  return APPROVAL_LABEL[type];
}

export default async function Approvals({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireCapability("approvals.view");
  const params = await searchParams;
  const decided = params.show === "decided";
  const requests = await prisma.approvalRequest.findMany({
    where: decided ? { status: { not: "PENDING" } } : { status: "PENDING" },
    orderBy: { createdAt: decided ? "desc" : "asc" },
    include: { requestedBy: true, decidedBy: true },
    take: 100,
  });
  return (
    <div className="stack lg">
      <div className="stack">
        <h1>Approvals</h1>
        <p className="muted">Every request that needs sign-off appears here. Each decision is recorded in the activity log with the name of the person who made it.</p>
        <Notices params={params} />
        <nav className="subnav" aria-label="Show">
          <Link href="/admin/approvals" aria-current={decided ? undefined : "page"}>Waiting</Link>
          <Link href="/admin/approvals?show=decided" aria-current={decided ? "page" : undefined}>Decided</Link>
        </nav>
      </div>
      {requests.length === 0 && <p className="card">{decided ? "No decisions yet." : "Nothing is waiting for a decision."}</p>}
      {requests.map((r) => {
        const type = r.type as ApprovalType;
        const [cls, label] = STATUS[r.status];
        const mine = r.requestedById === me.id;
        return (
          <article className="card stack" key={r.id}>
            <div className="row between">
              <h2>{r.requestedBy.name} <span className="muted small">· {r.requestedBy.email}</span></h2>
              <span className={`pill ${cls}`}>{label}</span>
            </div>
            <p><span className="pill plain">{APPROVAL_LABEL[type]}</span> {describe(type, r.payload)} <span className="muted small">· sent {formatDateTime(r.createdAt)}</span></p>
            {r.note && <p>"{r.note}"</p>}
            {r.status !== "PENDING" && r.status !== "CANCELLED" && (
              <p className="small muted">{label} by {r.decidedBy?.name ?? "a removed account"}{r.decidedAt ? ` on ${formatDateTime(r.decidedAt)}` : ""}{r.decisionNote ? `: "${r.decisionNote}"` : ""}</p>
            )}
            {r.status === "PENDING" && canDecide(me.role, type) && !mine && (
              <form className="form" action={decideApprovalAction}>
                <input type="hidden" name="id" value={r.id} />
                <div className="field">
                  <label htmlFor={`note-${r.id}`}>Note <span className="muted">(needed when rejecting)</span></label>
                  <input id={`note-${r.id}`} name="note" type="text" maxLength={500} />
                </div>
                <div className="row">
                  <button className="btn" type="submit" name="decision" value="APPROVED">Approve</button>
                  <button className="btn danger" type="submit" name="decision" value="REJECTED">Reject</button>
                </div>
              </form>
            )}
            {r.status === "PENDING" && mine && <p className="small muted">This is your own request, so another administrator must decide it.</p>}
            {r.status === "PENDING" && !canDecide(me.role, type) && <p className="small muted">You can see this request, but a system administrator decides it.</p>}
          </article>
        );
      })}
    </div>
  );
}
