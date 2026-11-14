import { formatDate } from "@/lib/format";
import { formatUsd, type FeeStatus } from "@/lib/fees";

const STATE = {
  NONE: ["plain", "Nothing to pay"], AWAITING_FIRST: ["wait", "Waiting for first payment"], CLEAR: ["ok", "Paid in full"],
  OWING: ["wait", "Balance to pay"], ARRANGED: ["wait", "More time approved"], OVERDUE: ["bad", "Overdue: access paused"],
} as const;

export function FeePill({ status }: { status: FeeStatus }) {
  const [cls, label] = STATE[status.state];
  return <span className={`pill ${cls}`}>{label}</span>;
}

// One plain sentence about what is owed and by when. Written to the student, or about them for staff.
export function feeSentence(status: FeeStatus, arrangementUntil: Date | null, about: "you" | "student" = "you"): string {
  const balance = formatUsd(status.balanceCents);
  const me = about === "you";
  const owes = me ? "You owe" : "Owes", their = me ? "your" : "their", Their = me ? "Your" : "Their";
  switch (status.state) {
    case "NONE": return "Nothing has been charged for this class.";
    case "CLEAR": return me ? "Everything is paid. Thank you." : "Everything is paid.";
    case "AWAITING_FIRST": return `${owes} ${balance}. ${Their} class opens when ${their} first payment is confirmed. The rest is due 8 weeks after that payment.`;
    case "OWING": return `${owes} ${balance}, due by ${formatDate(status.dueAt!)} (8 weeks after ${their} first payment). ${status.daysLeft} ${status.daysLeft === 1 ? "day" : "days"} left.`;
    case "ARRANGED": return `${owes} ${balance}. ${me ? "The finance office has given you" : "They have been given"} until ${formatDate(arrangementUntil!)} to pay.`;
    case "OVERDUE": return `${owes} ${balance}, which was due by ${formatDate(status.dueAt!)}. ${Their} access to this class is paused until it is paid or the finance office approves more time.`;
  }
}

export const PAYMENT_STATE = { SUBMITTED: ["wait", "Waiting for Finance"], CONFIRMED: ["ok", "Confirmed"], REJECTED: ["bad", "Rejected"] } as const;
