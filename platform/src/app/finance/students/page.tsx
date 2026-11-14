import Link from "next/link";
import { FeePill } from "@/components/fees";
import { classLabel } from "@/lib/academics";
import { prisma } from "@/lib/db";
import { formatUsd, WARN_DAYS, type FeeStatus } from "@/lib/fees";
import { feeStatuses } from "@/lib/fees-data";
import { formatDate } from "@/lib/format";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "Student balances" };

const FILTERS = {
  all: ["Everyone", () => true],
  due: [`Due in ${WARN_DAYS} days`, (s: FeeStatus) => s.state === "OWING" && s.daysLeft !== null && s.daysLeft <= WARN_DAYS],
  overdue: ["Access paused", (s: FeeStatus) => s.state === "OVERDUE"],
  first: ["Waiting for first payment", (s: FeeStatus) => s.state === "AWAITING_FIRST"],
  owing: ["Any balance", (s: FeeStatus) => s.balanceCents > 0],
} as const;

export default async function Balances({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireCapability("finance.view");
  const params = await searchParams;
  const show = typeof params.show === "string" && params.show in FILTERS ? (params.show as keyof typeof FILTERS) : "all";
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const enrolments = await prisma.enrolment.findMany({
    where: { status: "ACTIVE", ...(q ? { user: { OR: [{ name: { contains: q, mode: "insensitive" } }, { studentNumber: { contains: q, mode: "insensitive" } }] } } : {}) },
    include: { user: true, class: { include: { course: true, intake: true } } }, orderBy: { user: { name: "asc" } }, take: 500,
  });
  const statuses = await feeStatuses(enrolments.map((e) => e.id));
  const rows = enrolments.filter((e) => FILTERS[show][1](statuses.get(e.id)!));
  return (
    <div className="stack lg">
      <div className="stack">
        <h1>Student balances</h1>
        <nav className="subnav" aria-label="Show">
          {Object.entries(FILTERS).map(([k, [label]]) => <Link key={k} href={`/finance/students?show=${k}`} aria-current={show === k ? "page" : undefined}>{label}</Link>)}
        </nav>
        <form className="inline-form" method="get" role="search">
          <input type="hidden" name="show" value={show} />
          <label className="skip" htmlFor="q">Search by name or student number</label>
          <input id="q" name="q" type="search" placeholder="Name or student no." defaultValue={q} />
          <button className="btn sm" type="submit">Search</button>
        </form>
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>Student</th><th>Class</th><th>Charged</th><th>Paid</th><th>Balance</th><th>Due</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((e) => {
            const s = statuses.get(e.id)!;
            return (
              <tr key={e.id}>
                <td><Link href={`/finance/students/${e.id}`}><strong>{e.user.name}</strong></Link><br /><span className="muted small">{e.user.studentNumber ?? ""}</span></td>
                <td>{classLabel(e.class)}</td>
                <td className="nowrap">{formatUsd(s.chargedCents)}</td>
                <td className="nowrap">{formatUsd(s.paidCents)}</td>
                <td className="nowrap"><strong>{formatUsd(s.balanceCents)}</strong></td>
                <td className="nowrap">{s.balanceCents > 0 && s.dueAt ? formatDate(s.dueAt) : "—"}</td>
                <td><FeePill status={s} /></td>
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={7}>No students match.</td></tr>}
        </tbody>
      </table></div>
    </div>
  );
}
