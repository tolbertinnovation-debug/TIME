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

// Marks a quiz: the points of every question answered correctly.
export function scoreQuiz(questions: { id: string; correctIndex: number; points: number }[], answers: Record<string, unknown>): number {
  // Only a real choice counts. A blank or malformed answer must never match option 0.
  const chosen = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : -1);
  return questions.reduce((n, q) => n + (chosen(answers[q.id]) === q.correctIndex ? q.points : 0), 0);
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
