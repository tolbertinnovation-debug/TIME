import { describe, expect, it } from "vitest";
import { attendancePercent, summarise } from "../../src/lib/progress";

describe("course progress", () => {
  const lessons = [
    { id: "a", kind: "ONLINE" }, { id: "b", kind: "ONLINE" }, { id: "c", kind: "ONLINE" },
    { id: "d", kind: "PRACTICAL" }, { id: "e", kind: "PRACTICAL" },
  ] as const;
  it("counts online and practical lessons separately", () => {
    expect(summarise([...lessons], new Set(["a", "b", "d"]))).toEqual({ onlineDone: 2, onlineTotal: 3, practicalDone: 1, practicalTotal: 2, percent: 60 });
  });
  it("ignores completed lessons that are no longer in the course", () => {
    expect(summarise([...lessons], new Set(["zzz"])).percent).toBe(0);
  });
  it("is 0% for a course with no lessons", () => expect(summarise([], new Set()).percent).toBe(0));
});

describe("attendance", () => {
  it("is the share of marked sessions attended, leaving out excused ones", () => {
    expect(attendancePercent(["PRESENT", "PRESENT", "ABSENT", "EXCUSED"])).toBe(67);
    expect(attendancePercent(["PRESENT"])).toBe(100);
  });
  it("is unknown when nothing counts yet", () => {
    expect(attendancePercent([])).toBeNull();
    expect(attendancePercent(["EXCUSED"])).toBeNull();
  });
});
