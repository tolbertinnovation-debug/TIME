import { describe, expect, it } from "vitest";
import { contactOf, formatPhone, isPhoneOnlyEmail, normalisePhone, phoneOnlyEmail, realEmail } from "../../src/lib/phone";

describe("phone numbers", () => {
  it("recognises the ways a Liberian mobile number is written as one number", () => {
    for (const written of ["0777 123 456", "0777-123-456", "(0777) 123456", "+231 777 123 456", "231777123456", "00231777123456", "777123456", " +231.777.123.456 "]) {
      expect(normalisePhone(written), written).toBe("+231777123456");
    }
    expect(normalisePhone("0886 555 111")).toBe("+231886555111");
  });

  it("keeps numbers from other countries when written with their country code", () => {
    expect(normalisePhone("+233 24 123 4567")).toBe("+233241234567");
    expect(normalisePhone("+1 202 555 0143")).toBe("+12025550143");
  });

  it("refuses what is not a phone number", () => {
    for (const bad of ["", "call me", "12345", "0777 12", "+0777123456", "077712345678901", "ama@example.com", "+231 777 123 456 789 012"]) {
      expect(normalisePhone(bad), bad).toBeNull();
    }
  });

  it("gives a phone-only account an address that can never receive mail, and never shows it", () => {
    const email = phoneOnlyEmail("+231777123456");
    expect(email).toBe("231777123456@phone.time-learning.invalid");
    expect(isPhoneOnlyEmail(email)).toBe(true);
    expect(isPhoneOnlyEmail("ama@example.com")).toBe(false);
    expect(realEmail(email)).toBeNull();
    expect(realEmail("ama@example.com")).toBe("ama@example.com");
  });

  it("shows the email, or the phone number when there is no email", () => {
    expect(contactOf({ email: "ama@example.com", phone: "+231777123456" })).toBe("ama@example.com");
    expect(contactOf({ email: phoneOnlyEmail("+231777123456"), phone: "+231 777 123 456" })).toBe("+231 777 123 456");
  });

  it("writes Liberian numbers in groups", () => {
    expect(formatPhone("+231777123456")).toBe("+231 777 123 456");
    expect(formatPhone("+233241234567")).toBe("+233241234567");
  });
});
