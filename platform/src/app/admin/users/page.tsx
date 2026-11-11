import Link from "next/link";
import { changeRoleAction, setStatusAction } from "@/app/actions";
import { Notices } from "@/components/notice";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { can, isRole, ROLE_LABEL, ROLES } from "@/lib/permissions";
import { requireCapability } from "@/lib/session";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Accounts" };
const PAGE = 50;

export default async function Users({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireCapability("users.view");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const role = isRole(params.role) ? params.role : null;
  const page = Math.max(1, Number(params.page) || 1);
  const where: Prisma.UserWhereInput = {
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { studentNumber: { contains: q, mode: "insensitive" } }] } : {}),
    ...(role ? { role } : {}),
  };
  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    prisma.user.count({ where }),
  ]);
  const manage = can(me.role, "users.manage");
  const link = (p: number) => `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), ...(role ? { role } : {}), page: String(p) })}`;
  return (
    <div className="stack lg">
      <div className="stack">
        <h1>Accounts</h1>
        <Notices params={params} />
        <form className="inline-form" method="get" role="search">
          <label className="skip" htmlFor="q">Search by name or email</label>
          <input id="q" name="q" type="search" placeholder="Name, email or student no." defaultValue={q} />
          <label className="skip" htmlFor="role-filter">Role</label>
          <select id="role-filter" name="role" defaultValue={role ?? ""}>
            <option value="">All roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <button className="btn sm" type="submit">Search</button>
        </form>
        <p className="muted small">{total} {total === 1 ? "account" : "accounts"}</p>
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>Name</th><th>Email</th><th>Student no.</th><th>Joined</th><th>Status</th><th>Role</th>{manage && <th>Account</th>}</tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}{u.id === me.id && <span className="muted small"> (you)</span>}</td>
              <td>{u.email}</td>
              <td className="nowrap">{u.studentNumber ?? "—"}</td>
              <td className="nowrap">{formatDate(u.createdAt)}</td>
              <td><span className={`pill ${u.status === "ACTIVE" ? "ok" : "bad"}`}>{u.status === "ACTIVE" ? "Active" : "Suspended"}</span></td>
              <td>
                {manage && u.id !== me.id ? (
                  <form className="inline-form" action={changeRoleAction}>
                    <input type="hidden" name="userId" value={u.id} />
                    <label className="skip" htmlFor={`role-${u.id}`}>Role for {u.name}</label>
                    <select id={`role-${u.id}`} name="role" defaultValue={u.role}>
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                    <button className="btn ghost sm" type="submit">Save</button>
                  </form>
                ) : ROLE_LABEL[u.role]}
              </td>
              {manage && (
                <td>
                  {u.id !== me.id && (
                    <div className="row">
                    <Link className="btn ghost sm" href={`/admin/users/${u.id}/password`}>New password</Link>
                    <form action={setStatusAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="status" value={u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"} />
                      <button className={`btn sm ${u.status === "ACTIVE" ? "danger" : "ghost"}`} type="submit">{u.status === "ACTIVE" ? "Suspend" : "Restore"}</button>
                    </form>
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
          {users.length === 0 && <tr><td colSpan={manage ? 7 : 6}>No accounts match.</td></tr>}
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
