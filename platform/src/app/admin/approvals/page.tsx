import Link from "next/link";
import { approveSelectedAction, decideApprovalAction } from "@/app/actions";
import { Notices } from "@/components/notice";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { classLabel } from "@/lib/academics";
import { formatUsd } from "@/lib/fees";
import { APPROVAL_LABEL, BULK_APPROVAL_LIMIT, BULK_APPROVAL_TYPES, canDecide, isRole, ROLE_LABEL, visibleApprovalTypes, type ApprovalType } from "@/lib/permissions";
import { requireApprovalsAccess } from "@/lib/session";

export const metadata = { title: "Approvals" };

const STATUS = { PENDING: ["wait", "Waiting"], APPROVED: ["ok", "Approved"], REJECTED: ["bad", "Rejected"], CANCELLED: ["plain", "Cancelled"] } as const;

// What the request asks for, in plain words.
function describe(type: ApprovalType, payload: unknown, classes: Map<string, string>, courses: Map<string, string>): string {
  const data = (payload ?? {}) as Record<string, unknown>;
  if (type === "STAFF_ACCESS") return isRole(data.role) ? `Asks for the ${ROLE_LABEL[data.role]} role` : "Asks for a staff role";
  const cls = classes.get(String(data.classId)) ?? "a class that was removed";
  if (type === "APPLICATION") {
    const extra = [data.county && `lives in ${data.county}`, data.work && `works as ${data.work}`].filter(Boolean).join(", ");
    return `Applies to ${cls}${extra ? ` (${extra})` : ""}`;
  }
  if (type === "ENROLMENT_CHANGE") return `Asks to ${data.change === "DEFER" ? "defer" : "withdraw from"} ${cls}`;
  if (type === "CERTIFICATE_VERIFY") return `Requests their certificate for ${cls} (result ${data.total} of 100)`;
  if (type === "CERTIFICATE_ISSUE") return `Certificate for ${cls} (result ${data.total} of 100). Record checked by ${data.verifiedBy ?? "the registrar"}`;
  if (type === "PAYMENT_ARRANGEMENT") return `Asks for until ${data.until} to pay a balance of ${formatUsd(Number(data.balanceCents) || 0)} for ${cls}`;
  if (type === "REFUND") {
    const amount = Number(data.amountCents) || 0;
    const what = [amount > 0 && `refund ${formatUsd(amount)} to ${data.studentName}`, data.cancelBalance === true && `cancel what is left to pay`].filter(Boolean).join(" and ");
    return `Asks to ${what || "make a refund"} for ${cls}. Paid and confirmed: ${formatUsd(Number(data.confirmedCents) || 0)}. Reason: ${data.reason}`;
  }
  if (type === "GRADES") return `Asks to publish results for ${data.students} ${data.students === 1 ? "student" : "students"} in ${cls}`;
  if (type === "GRADE_APPEAL") return `Appeals their result of ${data.total} of 100 in ${cls}`;
  if (type === "COURSE_PUBLISH") return `Asks to publish ${data.lessons} ${data.lessons === 1 ? "lesson" : "lessons"} in ${courses.get(String(data.courseId)) ?? "a course that was removed"}`;
  return APPROVAL_LABEL[type];
}

export default async function Approvals({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireApprovalsAccess();
  const params = await searchParams;
  const decided = params.show === "decided";
  const requests = await prisma.approvalRequest.findMany({
    where: { type: { in: visibleApprovalTypes(me.role) }, status: decided ? { not: "PENDING" } : "PENDING" },
    orderBy: { createdAt: decided ? "desc" : "asc" },
    include: { requestedBy: true, decidedBy: true },
    take: 100,
  });
  const classIds = [...new Set(requests.map((r) => (r.payload as { classId?: unknown } | null)?.classId).filter((v): v is string => typeof v === "string"))];
  const classes = new Map((await prisma.courseClass.findMany({ where: { id: { in: classIds } }, include: { course: true, intake: true } })).map((c) => [c.id, classLabel(c)]));
  const courseIds = [...new Set(requests.filter((r) => r.type === "COURSE_PUBLISH").map((r) => String((r.payload as { courseId?: unknown }).courseId)))];
  const courses = new Map((await prisma.course.findMany({ where: { id: { in: courseIds } } })).map((c) => [c.id, c.title]));
  // Applications this person can approve together (never their own).
  const bulk = decided ? [] : requests.filter((r) => (BULK_APPROVAL_TYPES as readonly string[]).includes(r.type) && canDecide(me.role, r.type as ApprovalType) && r.requestedById !== me.id).slice(0, BULK_APPROVAL_LIMIT);
  const bulkIds = new Set(bulk.map((r) => r.id));
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
      {bulk.length >= 2 && (
        <form id="bulk-approve" className="card stack" action={approveSelectedAction} style={{ background: "var(--olive-soft)" }}>
          <h2>Approve applications together</h2>
          <p className="small">Tick the applications below, or approve all {bulk.length} at once. Each is still checked on its own: one whose class is full is not approved, and you are told. To reject one, use its own Reject button with a reason.</p>
          {bulk.map((r) => <input key={r.id} type="hidden" name="allIds" value={r.id} />)}
          <div className="row">
            <button className="btn" type="submit" name="mode" value="ticked">Approve ticked applications</button>
            <button className="btn ghost" type="submit" name="mode" value="all">Approve all {bulk.length} applications</button>
          </div>
        </form>
      )}
      {requests.length === 0 && <p className="card">{decided ? "No decisions yet." : "Nothing is waiting for a decision."}</p>}
      {requests.map((r) => {
        const type = r.type as ApprovalType;
        const [cls, label] = STATUS[r.status];
        const mine = r.requestedById === me.id;
        return (
          <article className="card stack" key={r.id}>
            <div className="row between">
              <h2>
                {bulk.length >= 2 && bulkIds.has(r.id) && (
                  <input type="checkbox" name="ids" value={r.id} form="bulk-approve" aria-label={`Tick ${r.requestedBy.name}'s application`} style={{ width: 20, height: 20, minHeight: 0, marginRight: 10, verticalAlign: "middle" }} />
                )}
                {r.requestedBy.name} <span className="muted small">· {r.requestedBy.email}</span>
              </h2>
              <span className={`pill ${cls}`}>{label}</span>
            </div>
            <p><span className="pill plain">{APPROVAL_LABEL[type]}</span> {describe(type, r.payload, classes, courses)} <span className="muted small">· sent {formatDateTime(r.createdAt)}</span></p>
            {r.note && <p>"{r.note}"</p>}
            {(type === "CERTIFICATE_VERIFY" || type === "CERTIFICATE_ISSUE") && <p><Link href={`/admin/certificates/record/${String((r.payload as { enrolmentId?: unknown }).enrolmentId)}`}>See the student's record before deciding</Link></p>}
            {type === "PAYMENT_ARRANGEMENT" && <p><Link href={`/finance/students/${String((r.payload as { enrolmentId?: unknown }).enrolmentId)}`}>See the student's statement before deciding</Link></p>}
            {(type === "GRADES" || type === "GRADE_APPEAL") && <p><Link href={`/admin/results/${String((r.payload as { classId?: unknown }).classId)}`}>See the class results before deciding</Link></p>}
            {type === "COURSE_PUBLISH" && <p><Link href={`/admin/content/${String((r.payload as { courseId?: unknown }).courseId)}`}>Read the lessons before deciding</Link></p>}
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
            {r.status === "PENDING" && !canDecide(me.role, type) && <p className="small muted">You can see this request, but you are not the person who decides it.</p>}
          </article>
        );
      })}
    </div>
  );
}
