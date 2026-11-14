// Course evaluations: what students are asked, and how answers are summarised.
// Answers are anonymous. To keep them so, nothing is shown until enough students have answered.
export const MIN_RESPONSES = 3;

export const QUESTIONS = [
  { key: "teaching", label: "The teaching", hint: "Was the lecturer clear, prepared and helpful?" },
  { key: "materials", label: "The lessons and materials", hint: "Were they easy to follow and useful?" },
  { key: "support", label: "Support from TIME", hint: "Were your questions about the class, fees and the platform answered?" },
  { key: "overall", label: "The course overall", hint: "" },
] as const;
export type QuestionKey = (typeof QUESTIONS)[number]["key"];

export const SCALE = [
  { value: 5, label: "Very good" }, { value: 4, label: "Good" }, { value: 3, label: "Fair" }, { value: 2, label: "Poor" }, { value: 1, label: "Very poor" },
] as const;

export type Answers = Record<QuestionKey, number> & { wentWell: string | null; improve: string | null };

export type Summary =
  | { ready: false; responses: number; needed: number }
  | { ready: true; responses: number; averages: Record<QuestionKey, number>; counts: Record<QuestionKey, number[]>; wentWell: string[]; improve: string[] };

// Comments are sorted alphabetically so their order says nothing about who wrote them or when.
const comments = (rows: Answers[], key: "wentWell" | "improve") =>
  rows.map((r) => r[key]?.trim() ?? "").filter(Boolean).sort((a, b) => a.localeCompare(b));

export function summarise(rows: Answers[]): Summary {
  if (rows.length < MIN_RESPONSES) return { ready: false, responses: rows.length, needed: MIN_RESPONSES - rows.length };
  const averages = {} as Record<QuestionKey, number>;
  const counts = {} as Record<QuestionKey, number[]>;
  for (const { key } of QUESTIONS) {
    averages[key] = Math.round((rows.reduce((n, r) => n + r[key], 0) / rows.length) * 10) / 10;
    // counts[key][0] is how many chose 1, up to counts[key][4] for 5.
    counts[key] = [1, 2, 3, 4, 5].map((v) => rows.filter((r) => r[key] === v).length);
  }
  return { ready: true, responses: rows.length, averages, counts, wentWell: comments(rows, "wentWell"), improve: comments(rows, "improve") };
}

// A student may evaluate once the class has ended or their own result has been published.
export const canEvaluate = (classStatus: string, resultPublished: boolean) => classStatus === "ENDED" || resultPublished;
