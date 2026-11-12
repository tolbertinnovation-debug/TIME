import { describe, expect, it } from "vitest";
import { computeMarks, isLate, missingParts, PASS_MARK, scoreQuiz, WEIGHTS } from "../../src/lib/grading";

const assessments = [
  { id: "q1", category: "CONTINUOUS", maxScore: 10 }, { id: "q2", category: "CONTINUOUS", maxScore: 10 },
  { id: "a1", category: "ASSIGNMENT", maxScore: 50 },
  { id: "m", category: "MIDTERM", maxScore: 100 },
  { id: "f", category: "FINAL", maxScore: 100 },
] as const;

describe("TIME grading", () => {
  it("uses the approved split of 30, 20, 20 and 30 with a pass mark of 70", () => {
    expect(WEIGHTS).toEqual({ CONTINUOUS: 30, ASSIGNMENT: 20, MIDTERM: 20, FINAL: 30 });
    expect(Object.values(WEIGHTS).reduce<number>((a, b) => a + b, 0)).toBe(100);
    expect(PASS_MARK).toBe(70);
  });
  it("gives full marks 100 points", () => {
    const m = computeMarks([...assessments], new Map([["q1", 10], ["q2", 10], ["a1", 50], ["m", 100], ["f", 100]]));
    expect(m).toEqual({ continuous: 30, assignments: 20, midterm: 20, final: 30, total: 100, passed: true });
  });
  it("scales each part by the share of marks earned", () => {
    // continuous 15/20 -> 22.5, assignment 40/50 -> 16, midterm 65% -> 13, final 80% -> 24
    const m = computeMarks([...assessments], new Map([["q1", 8], ["q2", 7], ["a1", 40], ["m", 65], ["f", 80]]));
    expect(m).toEqual({ continuous: 22.5, assignments: 16, midterm: 13, final: 24, total: 75.5, passed: true });
  });
  it("passes at exactly 70 and fails just below", () => {
    expect(computeMarks([...assessments], new Map([["q1", 7], ["q2", 7], ["a1", 35], ["m", 70], ["f", 70]])).total).toBe(70);
    expect(computeMarks([...assessments], new Map([["q1", 7], ["q2", 7], ["a1", 35], ["m", 70], ["f", 70]])).passed).toBe(true);
    const below = computeMarks([...assessments], new Map([["q1", 7], ["q2", 7], ["a1", 35], ["m", 70], ["f", 69]]));
    expect(below.total).toBe(69.7);
    expect(below.passed).toBe(false);
  });
  it("counts missing work as zero and never lets a score exceed its maximum", () => {
    expect(computeMarks([...assessments], new Map([["m", 100]])).total).toBe(20);
    expect(computeMarks([...assessments], new Map([["q1", 999], ["q2", -5]])).continuous).toBe(15);
  });
  it("reports parts that have no assessment yet", () => {
    expect(missingParts([{ category: "CONTINUOUS" }, { category: "FINAL" }])).toEqual(["ASSIGNMENT", "MIDTERM"]);
    expect(missingParts([...assessments])).toEqual([]);
  });
});

describe("quizzes", () => {
  const questions = [{ id: "a", correctIndex: 1, points: 2 }, { id: "b", correctIndex: 0, points: 3 }];
  it("adds the points of correct answers only", () => {
    expect(scoreQuiz(questions, { a: "1", b: "0" })).toBe(5);
    expect(scoreQuiz(questions, { a: "1", b: "2" })).toBe(2);
    expect(scoreQuiz(questions, {})).toBe(0);
    expect(scoreQuiz(questions, { a: "nonsense", b: null })).toBe(0);
  });
  it("allows two minutes beyond the time limit, and no more", () => {
    const start = new Date("2027-03-08T10:00:00Z");
    expect(isLate(start, 30, new Date("2027-03-08T10:29:00Z"))).toBe(false);
    expect(isLate(start, 30, new Date("2027-03-08T10:31:59Z"))).toBe(false);
    expect(isLate(start, 30, new Date("2027-03-08T10:32:01Z"))).toBe(true);
    expect(isLate(start, null, new Date("2030-01-01T00:00:00Z"))).toBe(false);
  });
});
