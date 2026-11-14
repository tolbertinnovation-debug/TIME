// TIME's fee rules. Amounts are whole US cents so sums are always exact.

// The balance is due 8 weeks after the date of the first payment.
export const BALANCE_DAYS = 56;
// Show a warning on the student's screens this many days before the balance is due.
export const WARN_DAYS = 14;

export type FeeState =
  | "NONE" // nothing has been charged
  | "AWAITING_FIRST" // charged, but no payment has been confirmed yet
  | "CLEAR" // everything is paid
  | "OWING" // a balance remains and the due date has not passed
  | "ARRANGED" // past the due date, but Finance approved more time
  | "OVERDUE"; // past the due date with no arrangement: access is paused

export type FeeStatus = { chargedCents: number; paidCents: number; balanceCents: number; dueAt: Date | null; state: FeeState; hasAccess: boolean; daysLeft: number | null };

const DAY = 24 * 60 * 60 * 1000;

export function feeStatus(input: { chargedCents: number; paidCents: number; firstPaidOn: Date | null; arrangementUntil: Date | null; now: Date }): FeeStatus {
  const { chargedCents, paidCents, firstPaidOn, arrangementUntil, now } = input;
  const balanceCents = Math.max(0, chargedCents - paidCents);
  // The due date runs to the end of the 56th day after the first payment.
  const dueAt = firstPaidOn ? new Date(firstPaidOn.getTime() + (BALANCE_DAYS + 1) * DAY - 1) : null;
  let state: FeeState;
  if (chargedCents <= 0) state = "NONE";
  else if (balanceCents === 0) state = "CLEAR";
  else if (!dueAt) state = "AWAITING_FIRST";
  else if (now <= dueAt) state = "OWING";
  else if (arrangementUntil && now <= arrangementUntil) state = "ARRANGED";
  else state = "OVERDUE";
  const hasAccess = state !== "AWAITING_FIRST" && state !== "OVERDUE";
  const deadline = state === "ARRANGED" ? arrangementUntil : dueAt;
  const daysLeft = balanceCents > 0 && deadline ? Math.ceil((deadline.getTime() - now.getTime()) / DAY) : null;
  return { chargedCents, paidCents, balanceCents, dueAt, state, hasAccess, daysLeft };
}

export const formatUsd = (cents: number) => `US$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

// Reads an amount such as "40", "40.5" or "1,250.00" into cents. Returns null if it is not a valid amount.
export function parseAmount(input: string): number | null {
  const cleaned = input.trim().replace(/^(US)?\$/i, "").replace(/,/g, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  return cents > 0 ? cents : null;
}

export const receiptNumber = (n: number) => `R-${String(n).padStart(6, "0")}`;

// References are compared without spaces or letter case, so "mp 2605.11" and "MP2605.11" are the same payment.
export const normaliseReference = (ref: string) => ref.replace(/\s+/g, "").toUpperCase();

export const METHOD_LABEL = { MOBILE_MONEY: "Mobile Money", BANK_TRANSFER: "Bank transfer" } as const;
export const CHARGE_LABEL = { TUITION: "Tuition", REGISTRATION: "Registration fee", EXAM: "Examination fee", OTHER: "Other" } as const;
