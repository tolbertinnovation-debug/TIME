import { cancelRequestAction, requestStaffAccessAction } from "@/app/actions";
import { Notices } from "@/components/notice";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { REQUESTABLE_ROLES, ROLE_LABEL, isRole } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Staff access" };

const STATUS = { PENDING: ["wait", "Waiting"], APPROVED: ["ok", "Approved"], REJECTED: ["bad", "Rejected"], CANCELLED: ["plain", "Cancelled"] } as const;

export default async function StaffAccess({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const requests = await prisma.approvalRequest.findMany({ where: { requestedById: user.id, type: "STAFF_ACCESS" }, orderBy: { createdAt: "desc" }, take: 10 });
  const pending = requests.find((r) => r.status === "PENDING");
  return (
    <div className="stack lg" style={{ maxWidth: 640 }}>
      <div className="stack">
        <h1>Ask for staff access</h1>
        <p className="muted">Lecturers and TIME staff ask for their role here. An administrator checks each request before access is given. Your current role is <strong>{ROLE_LABEL[user.role]}</strong>.</p>
        <Notices params={await searchParams} />
      </div>
      {!pending && (
        <form className="card form" action={requestStaffAccessAction}>
          <div className="field">
            <label htmlFor="role">Role you need</label>
            <select id="role" name="role" required defaultValue="">
              <option value="" disabled>Choose a role</option>
              {REQUESTABLE_ROLES.filter((r) => r !== user.role).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="note">Who you are and what you will do</label>
            <textarea id="note" name="note" required minLength={10} maxLength={500} aria-describedby="note-hint" />
            <span className="hint" id="note-hint">For example: "I teach Early Childhood Education on Saturdays."</span>
          </div>
          <button className="btn" type="submit">Send request</button>
        </form>
      )}
      {requests.length > 0 && (
        <section className="stack" aria-labelledby="mine-h">
          <h2 id="mine-h">Your requests</h2>
          <div className="table-wrap"><table>
            <thead><tr><th>Sent</th><th>Role</th><th>Status</th><th>Decision note</th><th></th></tr></thead>
            <tbody>
              {requests.map((r) => {
                const role = (r.payload as { role?: unknown }).role;
                const [cls, label] = STATUS[r.status];
                return (
                  <tr key={r.id}>
                    <td className="nowrap">{formatDateTime(r.createdAt)}</td>
                    <td>{isRole(role) ? ROLE_LABEL[role] : "—"}</td>
                    <td><span className={`pill ${cls}`}>{label}</span></td>
                    <td>{r.decisionNote ?? "—"}</td>
                    <td>{r.status === "PENDING" && <form action={cancelRequestAction}><input type="hidden" name="id" value={r.id} /><button className="btn ghost sm" type="submit">Cancel</button></form>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </section>
      )}
    </div>
  );
}
