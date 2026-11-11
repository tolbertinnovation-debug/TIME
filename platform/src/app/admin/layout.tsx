import Link from "next/link";
import { can } from "@/lib/permissions";
import { requireCapability } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCapability("admin.area");
  return (
    <div className="stack lg">
      <nav className="subnav" aria-label="Administration">
        <Link href="/admin">Overview</Link>
        {can(user.role, "users.view") && <Link href="/admin/users">Accounts</Link>}
        {can(user.role, "approvals.view") && <Link href="/admin/approvals">Approvals</Link>}
        {can(user.role, "activity.view") && <Link href="/admin/activity">Activity</Link>}
      </nav>
      {children}
    </div>
  );
}
