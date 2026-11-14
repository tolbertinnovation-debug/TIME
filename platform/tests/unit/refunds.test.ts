import { describe, expect, it } from "vitest";
import { creditToClear, feeStatus, formatUsd, refundableCents } from "../../src/lib/fees";

describe("refunds", () => {
  it("can refund at most what was confirmed, less refunds made or waiting", () => {
    expect(refundableCents({ confirmedCents: 12500, refundedCents: 0, pendingCents: 0 })).toBe(12500);
    expect(refundableCents({ confirmedCents: 12500, refundedCents: 5000, pendingCents: 2500 })).toBe(5000);
    expect(refundableCents({ confirmedCents: 4000, refundedCents: 4000, pendingCents: 0 })).toBe(0);
    expect(refundableCents({ confirmedCents: 0, refundedCents: 0, pendingCents: 0 })).toBe(0);
  });

  it("works out the credit that leaves nothing to pay after a withdrawal", () => {
    // Charged 125, paid 100, refunding 30: the student keeps 70 paid, so 55 is cancelled.
    expect(creditToClear({ chargedCents: 12500, confirmedCents: 10000, refundedCents: 3000 })).toBe(5500);
    // Nothing owed: no credit.
    expect(creditToClear({ chargedCents: 12500, confirmedCents: 12500, refundedCents: 0 })).toBe(0);
    // Overpaid: still no credit.
    expect(creditToClear({ chargedCents: 10000, confirmedCents: 12500, refundedCents: 0 })).toBe(0);
  });

  it("a cancelled balance and a paid refund leave the student clear", () => {
    const charged = 12500 - creditToClear({ chargedCents: 12500, confirmedCents: 10000, refundedCents: 3000 });
    const s = feeStatus({ chargedCents: charged, paidCents: 10000 - 3000, firstPaidOn: new Date("2027-01-10"), arrangementUntil: null, now: new Date("2027-06-01") });
    expect(s.balanceCents).toBe(0);
    expect(s.state).toBe("CLEAR");
  });

  it("shows a credit with a minus sign", () => {
    expect(formatUsd(-5500)).toBe("−US$55");
    expect(formatUsd(-1250)).toBe("−US$12.50");
    expect(formatUsd(0)).toBe("US$0");
  });
});
