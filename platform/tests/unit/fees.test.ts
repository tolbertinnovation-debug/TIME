import { describe, expect, it } from "vitest";
import { BALANCE_DAYS, feeStatus, formatUsd, normaliseReference, parseAmount, receiptNumber } from "../../src/lib/fees";

const first = new Date("2027-03-08T00:00:00Z");
const base = { chargedCents: 17500, paidCents: 8750, firstPaidOn: first, arrangementUntil: null };

describe("the 8-week balance rule", () => {
  it("gives eight weeks from the first payment", () => expect(BALANCE_DAYS).toBe(56));
  it("needs a first confirmed payment before the class opens", () => {
    const s = feeStatus({ ...base, paidCents: 0, firstPaidOn: null, now: first });
    expect(s.state).toBe("AWAITING_FIRST");
    expect(s.hasAccess).toBe(false);
  });
  it("keeps access while a balance is owed and the due date has not passed", () => {
    const s = feeStatus({ ...base, now: new Date("2027-04-01T12:00:00Z") });
    expect(s).toMatchObject({ state: "OWING", hasAccess: true, balanceCents: 8750 });
    expect(s.daysLeft).toBe(33);
  });
  it("still has access on the whole of the 56th day, and loses it the next day", () => {
    expect(feeStatus({ ...base, now: new Date("2027-05-03T23:59:00Z") }).state).toBe("OWING");
    const late = feeStatus({ ...base, now: new Date("2027-05-04T00:00:01Z") });
    expect(late.state).toBe("OVERDUE");
    expect(late.hasAccess).toBe(false);
  });
  it("restores access as soon as the balance is paid", () => {
    const s = feeStatus({ ...base, paidCents: 17500, now: new Date("2027-06-01T00:00:00Z") });
    expect(s).toMatchObject({ state: "CLEAR", hasAccess: true, balanceCents: 0, daysLeft: null });
  });
  it("keeps access during an approved arrangement, and pauses when it ends", () => {
    const until = new Date("2027-05-31T23:59:59Z");
    expect(feeStatus({ ...base, arrangementUntil: until, now: new Date("2027-05-20T00:00:00Z") })).toMatchObject({ state: "ARRANGED", hasAccess: true });
    expect(feeStatus({ ...base, arrangementUntil: until, now: new Date("2027-06-01T00:00:01Z") }).state).toBe("OVERDUE");
  });
  it("treats a course with nothing charged as open, and never shows a negative balance", () => {
    expect(feeStatus({ chargedCents: 0, paidCents: 0, firstPaidOn: null, arrangementUntil: null, now: first })).toMatchObject({ state: "NONE", hasAccess: true });
    expect(feeStatus({ ...base, paidCents: 20000, now: first }).balanceCents).toBe(0);
  });
});

describe("amounts and references", () => {
  it("reads amounts into cents", () => {
    expect(parseAmount("40")).toBe(4000);
    expect(parseAmount("87.50")).toBe(8750);
    expect(parseAmount("US$1,250.5")).toBe(125050);
    expect(parseAmount(" $15 ")).toBe(1500);
  });
  it("refuses anything that is not a positive amount", () => {
    for (const bad of ["", "0", "-5", "abc", "12.345", "1e5", "40 dollars"]) expect(parseAmount(bad)).toBeNull();
  });
  it("formats amounts and receipt numbers", () => {
    expect(formatUsd(4000)).toBe("US$40");
    expect(formatUsd(8750)).toBe("US$87.50");
    expect(formatUsd(125050)).toBe("US$1,250.50");
    expect(receiptNumber(142)).toBe("R-000142");
  });
  it("treats the same reference typed differently as one payment", () => {
    expect(normaliseReference(" mp260502.1184.c ")).toBe("MP260502.1184.C");
    expect(normaliseReference("MP 260502 1184 C")).toBe(normaliseReference("mp2605021184c"));
  });
});
