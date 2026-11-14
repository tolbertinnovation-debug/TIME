import { describe, expect, it } from "vitest";
import { canEvaluate, MIN_RESPONSES, summarise, type Answers } from "../../src/lib/evaluation";

const answer = (n: number, wentWell: string | null = null, improve: string | null = null): Answers => ({ teaching: n, materials: n, support: n, overall: n, wentWell, improve });

describe("course evaluations", () => {
  it("shows nothing until enough students have answered", () => {
    expect(summarise([])).toEqual({ ready: false, responses: 0, needed: MIN_RESPONSES });
    expect(summarise([answer(5, "Great"), answer(1, "Bad")])).toEqual({ ready: false, responses: 2, needed: 1 });
  });
  it("averages each question to one decimal place and counts each choice", () => {
    const s = summarise([answer(5), answer(4), { ...answer(4), teaching: 2 }]);
    if (!s.ready) throw new Error("expected a summary");
    expect(s.responses).toBe(3);
    expect(s.averages).toEqual({ teaching: 3.7, materials: 4.3, support: 4.3, overall: 4.3 });
    expect(s.counts.teaching).toEqual([0, 1, 0, 1, 1]);
    expect(s.counts.overall).toEqual([0, 0, 0, 2, 1]);
  });
  it("lists comments alphabetically, dropping blanks, so their order reveals nothing", () => {
    const s = summarise([answer(5, "Zeal of the lecturer", "  "), answer(4, null, "More examples"), answer(3, "Clear notes", "Audio lessons")]);
    if (!s.ready) throw new Error("expected a summary");
    expect(s.wentWell).toEqual(["Clear notes", "Zeal of the lecturer"]);
    expect(s.improve).toEqual(["Audio lessons", "More examples"]);
  });
  it("opens when the class has ended or the student's result is published", () => {
    expect(canEvaluate("OPEN", false)).toBe(false);
    expect(canEvaluate("OPEN", true)).toBe(true);
    expect(canEvaluate("ENDED", false)).toBe(true);
  });
});
