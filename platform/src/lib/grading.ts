// TIME's grading: 100 points in four parts, pass mark 70.
export const WEIGHTS = { CONTINUOUS: 30, ASSIGNMENT: 20, MIDTERM: 20, FINAL: 30 } as const;
export type Category = keyof typeof WEIGHTS;
export const CATEGORIES = Object.keys(WEIGHTS) as Category[];
export const PASS_MARK = 70;

export const CATEGORY_LABEL: Record<Category, string> = {
  CONTINUOUS: "Continuous assessment",
  ASSIGNMENT: "Assignments and practical activities",
  MIDTERM: "Midterm",
  FINAL: "Final examination or project",
};

export type Marks = { continuous: number; assignments: number; midterm: number; final: number; total: number; passed: boolean };

const round1 = (n: number) => Math.round(n * 10) / 10;

// A part's points are the share of marks earned across every assessment in that part.
// Work that was not handed in, or not yet marked, counts as zero.
export function computeMarks(assessments: { id: string; category: Category; maxScore: number }[], scores: Map<string, number>): Marks {
  const part = (category: Category) => {
    const items = assessments.filter((a) => a.category === category);
    const max = items.reduce((n, a) => n + a.maxScore, 0);
    if (!max) return 0;
    const earned = items.reduce((n, a) => n + Math.min(a.maxScore, Math.max(0, scores.get(a.id) ?? 0)), 0);
    return round1((earned / max) * WEIGHTS[category]);
  };
  const continuous = part("CONTINUOUS"), assignments = part("ASSIGNMENT"), midterm = part("MIDTERM"), final = part("FINAL");
  const total = round1(continuous + assignments + midterm + final);
  return { continuous, assignments, midterm, final, total, passed: total >= PASS_MARK };
}

// Results can be sent for approval only when every part has at least one assessment.
export function missingParts(assessments: { category: Category }[]): Category[] {
  return CATEGORIES.filter((c) => !assessments.some((a) => a.category === c));
}

// How a typed answer is compared: capitals, accents, extra spaces and punctuation do not count,
// so "Lrd 500." matches "LRD 500". A decimal point or comma between digits is kept ("2.5" is not "25").
export function normaliseAnswer(text: string): string {
  return text
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/(\d)[.,](\d)/g, "$1\u0000$2")
    .replace(/[^\p{L}\p{N}\u0000]+/gu, " ")
    .replace(/\u0000/g, ".")
    .trim()
    .replace(/\s+/g, " ");
}

type QuizQuestion = { id: string; type?: "CHOICE" | "TRUE_FALSE" | "SHORT"; correctIndex: number; accepted?: string[]; points: number };

// Is one answer right? Choice questions compare the option chosen; short answers compare the text.
export function isCorrect(q: QuizQuestion, answer: unknown): boolean {
  if (q.type === "SHORT") {
    if (typeof answer !== "string") return false;
    const given = normaliseAnswer(answer);
    return given !== "" && (q.accepted ?? []).some((a) => normaliseAnswer(a) === given);
  }
  // Only a real choice counts. A blank or malformed answer must never match option 0.
  const chosen = typeof answer === "number" && Number.isInteger(answer) ? answer : typeof answer === "string" && /^\d+$/.test(answer) ? Number(answer) : -1;
  return chosen === q.correctIndex;
}

// Marks a quiz: the points of every question answered correctly.
export function scoreQuiz(questions: QuizQuestion[], answers: Record<string, unknown>): number {
  return questions.reduce((n, q) => n + (isCorrect(q, answers[q.id]) ? q.points : 0), 0);
}

// A timed quiz must be handed in within its limit, plus a short allowance for a slow connection.
export const GRACE_SECONDS = 120;
export function quizDeadline(startedAt: Date, timeLimitMinutes: number | null): Date | null {
  return timeLimitMinutes ? new Date(startedAt.getTime() + timeLimitMinutes * 60_000) : null;
}
export function isLate(startedAt: Date, timeLimitMinutes: number | null, now: Date): boolean {
  const deadline = quizDeadline(startedAt, timeLimitMinutes);
  return !!deadline && now.getTime() > deadline.getTime() + GRACE_SECONDS * 1000;
}
