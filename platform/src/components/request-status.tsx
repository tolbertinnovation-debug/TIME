export const REQUEST_STATUS = { PENDING: ["wait", "Waiting"], APPROVED: ["ok", "Approved"], REJECTED: ["bad", "Rejected"], CANCELLED: ["plain", "Cancelled"] } as const;

export function RequestStatus({ status }: { status: keyof typeof REQUEST_STATUS }) {
  const [cls, label] = REQUEST_STATUS[status];
  return <span className={`pill ${cls}`}>{label}</span>;
}
