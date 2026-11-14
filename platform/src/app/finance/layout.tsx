import { NavLink } from "@/components/nav-link";
import { can } from "@/lib/permissions";
import { requireCapability } from "@/lib/session";

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCapability("finance.view");
  return (
    <div className="stack lg">
      <nav className="subnav" aria-label="Finance">
        <NavLink href="/finance" exact>Overview</NavLink>
        <NavLink href="/finance/payments">Payments</NavLink>
        <NavLink href="/finance/students">Student balances</NavLink>
        <NavLink href="/finance/refunds">Refunds</NavLink>
        {can(user.role, "finance.manage") && <NavLink href="/finance/settings">Payment details</NavLink>}
      </nav>
      {children}
    </div>
  );
}
