import { describe, expect, it } from "vitest";
import { attentionReasons } from "../../src/lib/attention";

const fine = { attendance: ["PRESENT", "PRESENT", "PRESENT", "ABSENT"] as const, lessonsExpected: 6, lessonsDone: 5, missedWork: 0 };
const check = (over: object) => attentionReasons({ ...fine, attendance: [...fine.attendance], ...over });

describe("students who need attention", () => {
  it("does not flag a student who is keeping up", () => {
    expect(check({})).toEqual([]);
  });
  it("flags attendance below 75%, leaving excused sessions out", () => {
    expect(check({ attendance: ["PRESENT", "ABSENT", "ABSENT", "EXCUSED"] })).toEqual(["Attendance 33%"]);
    expect(check({ attendance: ["PRESENT", "PRESENT", "PRESENT", "ABSENT"] })).toEqual([]);
  });
  it("waits for two marked sessions before judging attendance", () => {
    expect(check({ attendance: ["ABSENT"] })).toEqual([]);
    expect(check({ attendance: ["ABSENT", "EXCUSED", "EXCUSED"] })).toEqual([]);
    expect(check({ attendance: ["ABSENT", "ABSENT"] })).toEqual(["Attendance 0%"]);
  });
  it("flags a student who has done fewer than half of the lessons due", () => {
    expect(check({ lessonsExpected: 6, lessonsDone: 2 })).toEqual(["Behind on lessons: 2 of 6"]);
    expect(check({ lessonsExpected: 6, lessonsDone: 3 })).toEqual([]);
  });
  it("does not call anyone behind in the first week, when few lessons are due", () => {
    expect(check({ lessonsExpected: 0, lessonsDone: 0 })).toEqual([]);
    expect(check({ lessonsExpected: 1, lessonsDone: 0 })).toEqual([]);
  });
  it("flags missed work and gives every reason", () => {
    expect(check({ missedWork: 1 })).toEqual(["Missed 1 piece of work"]);
    expect(check({ attendance: ["ABSENT", "ABSENT"], lessonsExpected: 4, lessonsDone: 0, missedWork: 3 })).toEqual(["Attendance 0%", "Behind on lessons: 0 of 4", "Missed 3 pieces of work"]);
  });
});
