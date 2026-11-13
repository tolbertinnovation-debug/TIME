// TIME's certificates, following the paper certificate TIME issues today.
import type { FeeState } from "@/lib/fees";

export const INSTITUTION = "Technical Institute for Many Empowerment (TIME Inc.)";
export const ADDRESS = "Mid-Liberia Christian School System, Ben's Town Community, Marshall Education District, Margibi County, Liberia";
export const PLACE = "Marshall Education District, Margibi County, Republic of Liberia";

export type Wording = "TEACHING" | "GENERAL";

// The sentence under the holder's name. TEACHING is the wording on TIME's teaching certificate.
export const WORDING: Record<Wording, string> = {
  TEACHING: "Having successfully completed the prescribed course of study and has fulfilled all academic and institutional requirements established by the Bureau of Teacher Education, Ministry of Education (MoE), Republic of Liberia, and the Technical Institute for Many Empowerment (TIME) Inc., and is therefore awarded this certificate with all the rights, privileges, and responsibilities pertaining thereto.",
  GENERAL: "Having successfully completed the prescribed course of study and has fulfilled all academic and institutional requirements established by the Technical Institute for Many Empowerment (TIME) Inc., and is therefore awarded this certificate with all the rights, privileges, and responsibilities pertaining thereto.",
};

// The signature lines, left blank on the page to be signed by hand.
export const SIGNATURES: Record<Wording, { label: string; lines: string[] }[]> = {
  TEACHING: [
    { label: "Signed", lines: ["Executive Director", "Technical Institute for Many Empowerment (TIME) Inc."] },
    { label: "Attested", lines: ["Assistant Minister", "Bureau of Teacher Education, Ministry of Education (MoE)-R/L"] },
    { label: "Approved", lines: ["County Education Office (CEO)", "Margibi County, Republic of Liberia"] },
  ],
  GENERAL: [
    { label: "Signed", lines: ["Executive Director", "Technical Institute for Many Empowerment (TIME) Inc."] },
  ],
};

export type CertificateKind = { title: string; prefix: string; wording: Wording; field: (courseTitle: string) => string };

// What each program awards. The "C" Certificate is the teaching certificate in TIME's photo.
const KINDS: Record<string, CertificateKind> = {
  "c-certificate": { title: "Teaching Certificate", prefix: "TC", wording: "TEACHING", field: () => "Elementary Education" },
  diploma: { title: "Diploma", prefix: "DP", wording: "GENERAL", field: (c) => c },
  professional: { title: "Professional Certificate", prefix: "PC", wording: "GENERAL", field: (c) => c },
};
const OTHER: CertificateKind = { title: "Certificate", prefix: "CT", wording: "GENERAL", field: (c) => c };

export const certificateKind = (programId: string): CertificateKind => KINDS[programId] ?? OTHER;
export const PREFIXES = ["TC", "DP", "PC", "CT"] as const;

// "TC-002": at least three digits, as on the paper certificates.
export const certificateNumber = (prefix: string, n: number) => `${prefix}-${String(n).padStart(3, "0")}`;

// The next number is one more than the highest already used, on paper or on the platform.
export function nextNumber(issuedOnPlatform: number[], lastPaperNumber: number): number {
  return Math.max(lastPaperNumber, 0, ...issuedOnPlatform) + 1;
}

// A code that is easy to read aloud and type: no 0/O, 1/I/L.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function makeCode(random: (max: number) => number): string {
  const pick = () => Array.from({ length: 4 }, () => ALPHABET[random(ALPHABET.length)]).join("");
  return `${pick()}-${pick()}`;
}
export const normaliseCode = (v: string) => v.replace(/[^a-z0-9]/gi, "").toUpperCase().replace(/^(.{4})(.{4})$/, "$1-$2");
export const normaliseNumber = (v: string) => v.replace(/\s+/g, "").toUpperCase();

// "8th day of August, 2026"
export function awardedPhrase(date: Date): string {
  const d = date.getUTCDate();
  const suffix = d % 100 >= 11 && d % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][d % 10] ?? "th");
  const month = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(date);
  return `${d}${suffix} day of ${month}, ${date.getUTCFullYear()}`;
}

// What a student needs before they can request a certificate.
export type Check = { label: string; met: boolean; detail: string };
export function eligibility(input: { classEnded: boolean; result: { total: number; passed: boolean } | null; feeState: FeeState; balanceText: string }): { checks: Check[]; eligible: boolean } {
  const { classEnded, result, feeState, balanceText } = input;
  const checks: Check[] = [
    { label: "The class has ended", met: classEnded, detail: classEnded ? "The administration has closed this class." : "The administration has not yet declared this class finished." },
    {
      label: "You passed", met: !!result?.passed,
      detail: !result ? "Your result has not been published yet." : result.passed ? `Your result is ${result.total} of 100.` : `Your result is ${result.total} of 100. The pass mark is 70.`,
    },
    {
      label: "Your fees are cleared", met: feeState === "CLEAR" || feeState === "NONE",
      detail: feeState === "CLEAR" || feeState === "NONE" ? "Nothing is owed." : `You still owe ${balanceText}.`,
    },
  ];
  return { checks, eligible: checks.every((c) => c.met) };
}
