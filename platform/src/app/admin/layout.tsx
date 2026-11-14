import { NavLink } from "@/components/nav-link";
import { can, seesApprovals, supportCategoriesFor } from "@/lib/permissions";
import { requireCapability } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCapability("admin.area");
  return (
    <div className="stack lg">
      <nav className="subnav" aria-label="Administration">
        <NavLink href="/admin" exact>Overview</NavLink>
        {seesApprovals(user.role) && <NavLink href="/admin/approvals">Approvals</NavLink>}
        {can(user.role, "enrolments.view") && <NavLink href="/admin/classes">Classes</NavLink>}
        {can(user.role, "setup.manage") && <NavLink href="/admin/setup">Intakes and centres</NavLink>}
        {can(user.role, "certificates.view") && <NavLink href="/admin/certificates">Certificates</NavLink>}
        {supportCategoriesFor(user.role).length > 0 && <NavLink href="/admin/support">Help desk</NavLink>}
        {can(user.role, "sponsors.manage") && <NavLink href="/admin/sponsors">Sponsors</NavLink>}
        {can(user.role, "results.review") && <NavLink href="/admin/evaluations">Evaluations</NavLink>}
        {(can(user.role, "records.view") || can(user.role, "finance.view")) && <NavLink href="/admin/reports">Reports</NavLink>}
        {can(user.role, "users.view") && <NavLink href="/admin/users">Accounts</NavLink>}
        {can(user.role, "activity.view") && <NavLink href="/admin/activity">Activity</NavLink>}
      </nav>
      {children}
    </div>
  );
}
