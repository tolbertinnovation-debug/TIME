import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatUsd, WARN_DAYS } from "@/lib/fees";
import { feeStatuses } from "@/lib/fees-data";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "Finance" };

export default async function FinanceOverview() {
  await requireCapability("finance.view");
  const [toConfirm, active, confirmed] = await Promise.all([
    prisma.payment.count({ where: { status: "SUBMITTED" } }),
    prisma.enrolment.findMany({ where: { status: "ACTIVE" }, select: { id: true } }),
    prisma.payment.aggregate({ where: { status: "CONFIRMED" }, _sum: { amountCents: true } }),
  ]);
  const statuses = [...(await feeStatuses(active.map((e) => e.id))).values()];
  const dueSoon = statuses.filter((s) => s.state === "OWING" && s.daysLeft !== null && s.daysLeft <= WARN_DAYS).length;
  const overdue = statuses.filter((s) => s.state === "OVERDUE").length;
  const awaiting = statuses.filter((s) => s.state === "AWAITING_FIRST").length;
  const owed = statuses.reduce((n, s) => n + s.balanceCents, 0);
  return (
    <div className="stack lg">
      <h1>Finance</h1>
      <div className="grid">
        <Link className="tile" href="/finance/payments"><b>{toConfirm}</b><span>{toConfirm === 1 ? "payment" : "payments"} waiting to be confirmed</span></Link>
        <Link className="tile" href="/finance/students?show=due"><b>{dueSoon}</b><span>balances due in the next {WARN_DAYS} days</span></Link>
        <Link className="tile" href="/finance/students?show=overdue"><b>{overdue}</b><span>past 8 weeks: access paused</span></Link>
        <Link className="tile" href="/finance/students?show=first"><b>{awaiting}</b><span>waiting for a first payment</span></Link>
      </div>
      <div className="grid">
        <div className="tile"><b>{formatUsd(confirmed._sum.amountCents ?? 0)}</b><span>received and confirmed in total</span></div>
        <div className="tile"><b>{formatUsd(owed)}</b><span>still owed by enrolled students</span></div>
      </div>
    </div>
  );
}
