import { describe, expect, it } from "vitest";
import { awardedPhrase, certificateKind, certificateNumber, eligibility, makeCode, nextNumber, normaliseCode, normaliseNumber, SIGNATURES, WORDING } from "../../src/lib/certificate";

describe("who can request a certificate", () => {
  const ok = { classEnded: true, result: { total: 88, passed: true }, feeState: "CLEAR", balanceText: "US$0" } as const;
  it("needs the class ended, a pass and cleared fees", () => {
    expect(eligibility(ok).eligible).toBe(true);
    expect(eligibility({ ...ok, feeState: "NONE" }).eligible).toBe(true);
  });
  it("refuses while the administration has not ended the class", () => expect(eligibility({ ...ok, classEnded: false }).eligible).toBe(false));
  it("refuses without a published result, or below the pass mark", () => {
    expect(eligibility({ ...ok, result: null }).eligible).toBe(false);
    const failed = eligibility({ ...ok, result: { total: 51, passed: false } });
    expect(failed.eligible).toBe(false);
    expect(failed.checks[1].detail).toMatch(/51 of 100. The pass mark is 70/);
  });
  it("refuses while any fees are owed", () => {
    for (const feeState of ["OWING", "ARRANGED", "OVERDUE", "AWAITING_FIRST"] as const) {
      const e = eligibility({ ...ok, feeState, balanceText: "US$87.50" });
      expect(e.eligible).toBe(false);
      expect(e.checks[2].detail).toBe("You still owe US$87.50.");
    }
  });
});

describe("certificate details", () => {
  it("awards a Teaching Certificate in Elementary Education for the C Certificate, with TIME's wording and three signatures", () => {
    const kind = certificateKind("c-certificate");
    expect(kind).toMatchObject({ title: "Teaching Certificate", prefix: "TC", wording: "TEACHING" });
    expect(kind.field("Mathematics and Integrated Science")).toBe("Elementary Education");
    expect(WORDING.TEACHING).toContain("Bureau of Teacher Education, Ministry of Education (MoE), Republic of Liberia");
    expect(SIGNATURES.TEACHING.map((s) => s.label)).toEqual(["Signed", "Attested", "Approved"]);
  });
  it("does not name the Ministry on other programs' certificates", () => {
    for (const program of ["diploma", "professional", "skills", "anything-else"]) {
      const kind = certificateKind(program);
      expect(kind.wording).toBe("GENERAL");
      expect(kind.field("QuickBooks")).toBe("QuickBooks");
    }
    expect(WORDING.GENERAL).not.toContain("Ministry");
    expect(SIGNATURES.GENERAL.map((s) => s.label)).toEqual(["Signed"]);
    expect(certificateKind("diploma").prefix).toBe("DP");
  });
  it("numbers certificates like the paper ones, continuing after the last paper number", () => {
    expect(certificateNumber("TC", 2)).toBe("TC-002");
    expect(certificateNumber("TC", 1234)).toBe("TC-1234");
    expect(nextNumber([], 0)).toBe(1);
    expect(nextNumber([], 37)).toBe(38);
    expect(nextNumber([38, 39], 37)).toBe(40);
    expect(nextNumber([5], 37)).toBe(38);
  });
  it("writes the award date as on the paper certificate", () => {
    expect(awardedPhrase(new Date("2026-08-08T00:00:00Z"))).toBe("8th day of August, 2026");
    expect(awardedPhrase(new Date("2027-03-01T00:00:00Z"))).toBe("1st day of March, 2027");
    expect(awardedPhrase(new Date("2027-03-22T00:00:00Z"))).toBe("22nd day of March, 2027");
    expect(awardedPhrase(new Date("2027-03-13T00:00:00Z"))).toBe("13th day of March, 2027");
  });
  it("makes readable codes and accepts them however they are typed", () => {
    let i = 0;
    const code = makeCode((max) => (i++ * 7) % max);
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
    expect(normaliseCode(" 7kq2 m9xd ")).toBe("7KQ2-M9XD");
    expect(normaliseCode("7KQ2-M9XD")).toBe("7KQ2-M9XD");
    expect(normaliseNumber(" tc-002 ")).toBe("TC-002");
  });
});
