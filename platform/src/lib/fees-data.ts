import { prisma } from "@/lib/db";
import { feeStatus, type FeeStatus } from "@/lib/fees";

// Works out where each enrolment stands on fees: charged, paid (confirmed payments only), balance and due date.
export async function feeStatuses(enrolmentIds: string[], now = new Date()): Promise<Map<string, FeeStatus>> {
  if (!enrolmentIds.length) return new Map();
  const [charges, payments, refunds, enrolments] = await Promise.all([
    prisma.charge.groupBy({ by: ["enrolmentId"], where: { enrolmentId: { in: enrolmentIds } }, _sum: { amountCents: true } }),
    prisma.payment.groupBy({ by: ["enrolmentId"], where: { enrolmentId: { in: enrolmentIds }, status: "CONFIRMED" }, _sum: { amountCents: true }, _min: { paidOn: true } }),
    // Only refunds actually paid out reduce what the student has paid.
    prisma.refund.groupBy({ by: ["enrolmentId"], where: { enrolmentId: { in: enrolmentIds }, status: "PAID" }, _sum: { amountCents: true } }),
    prisma.enrolment.findMany({ where: { id: { in: enrolmentIds } }, select: { id: true, arrangementUntil: true } }),
  ]);
  const charged = new Map(charges.map((c) => [c.enrolmentId, c._sum.amountCents ?? 0]));
  const paid = new Map(payments.map((p) => [p.enrolmentId, p]));
  const refunded = new Map(refunds.map((r) => [r.enrolmentId, r._sum.amountCents ?? 0]));
  return new Map(enrolments.map((e) => [e.id, feeStatus({
    chargedCents: charged.get(e.id) ?? 0,
    paidCents: (paid.get(e.id)?._sum.amountCents ?? 0) - (refunded.get(e.id) ?? 0),
    firstPaidOn: paid.get(e.id)?._min.paidOn ?? null,
    arrangementUntil: e.arrangementUntil,
    now,
  })]));
}

export async function feeStatusOf(enrolmentId: string): Promise<FeeStatus> {
  return (await feeStatuses([enrolmentId])).get(enrolmentId) ?? feeStatus({ chargedCents: 0, paidCents: 0, firstPaidOn: null, arrangementUntil: null, now: new Date() });
}

// Why a student cannot use a class right now, or null if they can.
export function accessProblem(status: FeeStatus): string | null {
  if (status.state === "AWAITING_FIRST") return "Your class opens when your first payment has been confirmed by the finance office.";
  if (status.state === "OVERDUE") return "Your access is paused because your balance was not paid within 8 weeks of your first payment. It returns when the balance is paid or the finance office approves more time.";
  return null;
}

export const SETTING = { mobileMoney: "payment.mobileMoney", bank: "payment.bank" } as const;

export async function paymentDetails() {
  const rows = await prisma.setting.findMany({ where: { key: { in: Object.values(SETTING) } } });
  const get = (key: string) => rows.find((r) => r.key === key)?.value ?? "";
  return { mobileMoney: get(SETTING.mobileMoney), bank: get(SETTING.bank) };
}

type RefundDb = Pick<typeof prisma, "payment" | "refund" | "approvalRequest" | "charge">;

// The figures behind a refund on one enrolment. Call inside a transaction that holds the
// enrolment's refund lock (refundLock), so two requests cannot both use the same money.
export async function refundFigures(db: RefundDb, enrolmentId: string) {
  const [confirmed, refunds, pending, charged] = await Promise.all([
    db.payment.aggregate({ where: { enrolmentId, status: "CONFIRMED" }, _sum: { amountCents: true } }),
    db.refund.aggregate({ where: { enrolmentId }, _sum: { amountCents: true } }),
    db.approvalRequest.findMany({ where: { type: "REFUND", status: "PENDING", payload: { path: ["enrolmentId"], equals: enrolmentId } }, select: { payload: true } }),
    db.charge.aggregate({ where: { enrolmentId }, _sum: { amountCents: true } }),
  ]);
  const pendingCents = pending.reduce((n, r) => n + (Number((r.payload as { amountCents?: unknown }).amountCents) || 0), 0);
  return {
    confirmedCents: confirmed._sum.amountCents ?? 0,
    refundedCents: refunds._sum.amountCents ?? 0,
    pendingCents,
    pendingRequests: pending.length,
    chargedCents: charged._sum.amountCents ?? 0,
  };
}

export const refundLockKey = (enrolmentId: string) => `refund:${enrolmentId}`;
