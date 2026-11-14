import { describe, expect, it } from "vitest";
import { toCsv } from "../../src/lib/csv";

const body = (csv: string) => csv.replace(/^﻿/, "").trimEnd().split("\r\n");

describe("CSV files for reports", () => {
  it("writes a header and one line per row", () => {
    expect(body(toCsv(["Name", "Total"], [["Ama Kollie", 90], ["Ben Dolo", 40]]))).toEqual(["Name,Total", "Ama Kollie,90", "Ben Dolo,40"]);
  });
  it("starts with a mark so Excel reads accents correctly", () => {
    expect(toCsv(["A"], []).charCodeAt(0)).toBe(0xfeff);
  });
  it("quotes commas, quotes and line breaks", () => {
    expect(body(toCsv(["A"], [['Kollie, Ama "AK"']]))[1]).toBe('"Kollie, Ama ""AK"""');
    expect(toCsv(["A"], [["line one\nline two"]])).toContain('"line one\nline two"');
  });
  it("stops a cell from being run as a formula", () => {
    expect(body(toCsv(["A"], [["=HYPERLINK(\"http://x\")"], ["+231 88"], ["@ama"], ["-5 text"]]))).toEqual(["A", '"\'=HYPERLINK(""http://x"")"', "'+231 88", "'@ama", "'-5 text"]);
  });
  it("leaves real numbers alone, including negatives", () => {
    expect(body(toCsv(["A"], [[-5], [12.5]]))).toEqual(["A", "-5", "12.5"]);
  });
  it("writes dates as year-month-day, yes or no, and blanks", () => {
    expect(body(toCsv(["D", "B", "N"], [[new Date("2027-03-08T10:00:00Z"), true, null], [undefined, false, ""]]))).toEqual(["D,B,N", "2027-03-08,Yes,", ",No,"]);
  });
});
