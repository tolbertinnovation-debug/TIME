import Link from "next/link";
import { requestEnrolmentChangeAction } from "@/app/academic-actions";
import { cancelRequestAction } from "@/app/actions";
import { Notices } from "@/components/notice";
import { ENROLMENT_LABEL, MODE_LABEL, TRACK_LABEL } from "@/lib/academics";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "My classes" };

const PILL = { ACTIVE: "ok", WITHDRAWN: "bad", DEFERRED: "wait", COMPLETED: "" } as const;

export default async function MyClasses({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireCapability("classes.apply");
  const [enrolments, pending, me] = await Promise.all([
    prisma.enrolment.findMany({
      where: { userId: user.id }, orderBy: { enrolledAt: "desc" },
      include: { class: { include: { course: true, intake: true, studyCentre: true, staff: { where: { role: "LECTURER" }, include: { user: true } } } } },
    }),
    prisma.approvalRequest.findMany({ where: { requestedById: user.id, type: "ENROLMENT_CHANGE", status: "PENDING" } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { studentNumber: true } }),
  ]);
  const waiting = new Map(pending.map((r) => [String((r.payload as { enrolmentId?: unknown }).enrolmentId), r]));
  return (
    <div className="stack lg">
      <div className="stack">
        <h1>My classes</h1>
        {me?.studentNumber && <p className="muted">Your student number is <strong>{me.studentNumber}</strong>.</p>}
        <Notices params={await searchParams} />
      </div>
      {enrolments.length === 0 && <p className="card">You are not enrolled in a class yet. <Link href="/apply">Apply to a class</Link>.</p>}
      {enrolments.map((e) => {
        const request = waiting.get(e.id);
        return (
          <article className="card stack" key={e.id}>
            <div className="row between"><h2>{e.class.course.title}</h2><span className={`pill ${PILL[e.status]}`}>{ENROLMENT_LABEL[e.status]}</span></div>
            <p className="muted">
              {e.class.intake.name} · starts {formatDate(e.class.intake.startDate)} · {TRACK_LABEL[e.class.track]} · {MODE_LABEL[e.class.mode]}
              {e.class.studyCentre ? ` · ${e.class.studyCentre.name}` : ""}
            </p>
            <p className="small">Lecturer: {e.class.staff.map((s) => s.user.name).join(", ") || "to be announced"}</p>
            {(e.status === "ACTIVE" || e.status === "COMPLETED") && <div><Link className="btn" href={`/learn/${e.classId}`}>Open class</Link></div>}
            {request && (
              <div className="row">
                <span className="notice info">Your request to {(request.payload as { change?: string }).change === "DEFER" ? "defer" : "withdraw"} is waiting for the registrar.</span>
                <form action={cancelRequestAction}><input type="hidden" name="id" value={request.id} /><input type="hidden" name="from" value="classes" /><button className="btn ghost sm" type="submit">Cancel request</button></form>
              </div>
            )}
            {e.status === "ACTIVE" && !request && (
              <details>
                <summary className="small">Ask to withdraw or defer</summary>
                <form className="form" action={requestEnrolmentChangeAction} style={{ marginTop: 12 }}>
                  <input type="hidden" name="enrolmentId" value={e.id} />
                  <div className="field">
                    <label htmlFor={`change-${e.id}`}>What you are asking for</label>
                    <select id={`change-${e.id}`} name="change" required>
                      <option value="DEFER">Defer to a later intake</option>
                      <option value="WITHDRAW">Withdraw from this class</option>
                    </select>
                  </div>
                  <div className="field"><label htmlFor={`reason-${e.id}`}>Your reason</label><textarea id={`reason-${e.id}`} name="note" required minLength={10} maxLength={500} /></div>
                  <div><button className="btn ghost" type="submit">Send request</button></div>
                </form>
              </details>
            )}
          </article>
        );
      })}
    </div>
  );
}
