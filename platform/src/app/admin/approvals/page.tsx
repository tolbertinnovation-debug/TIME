import Link from "next/link";
import { decideApprovalAction } from "@/app/actions";
import { Notices } from "@/components/notice";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { classLabel } from "@/lib/academics";
import { APPROVAL_LABEL, canDecide, isRole, ROLE_LABEL, visibleApprovalTypes, type ApprovalType } from "@/lib/permissions";
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
            <p><span className="pill plain">{APPROVAL_LABEL[type]}</span> {describe(type, r.payload, classes, courses)} <span className="muted small">· sent {formatDateTime(r.createdAt)}</span></p>
            {r.note && <p>"{r.note}"</p>}
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
