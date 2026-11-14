// Builds a CSV file that opens correctly in Excel and Google Sheets.
export type Cell = string | number | boolean | Date | null | undefined;

function text(value: Cell): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  // A cell that starts like a formula would be run by a spreadsheet: a leading apostrophe makes it plain text.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  // The first character (a byte order mark) tells Excel the file is UTF-8, so names with accents display correctly.
  return "﻿" + [header, ...rows].map((row) => row.map(text).join(",")).join("\r\n") + "\r\n";
}
