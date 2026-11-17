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

import { dayDistance, neighbours } from "../../src/lib/progress";

describe("moving between lessons", () => {
  const lessons = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("finds the lessons before and after", () => {
    expect(neighbours(lessons, "b")).toEqual({ previous: { id: "a" }, next: { id: "c" } });
  });
  it("has nothing before the first or after the last", () => {
    expect(neighbours(lessons, "a")).toEqual({ previous: null, next: { id: "b" } });
    expect(neighbours(lessons, "c")).toEqual({ previous: { id: "b" }, next: null });
  });
  it("gives nothing for a lesson that is not in the course", () => {
    expect(neighbours(lessons, "x")).toEqual({ previous: null, next: null });
  });
});

describe("how far away a date is", () => {
  const now = new Date("2027-03-10T15:00:00Z");
  it("counts whole days, whatever the time of day", () => {
    expect(dayDistance(new Date("2027-03-10T23:30:00Z"), now)).toBe("today");
    expect(dayDistance(new Date("2027-03-11T00:10:00Z"), now)).toBe("tomorrow");
    expect(dayDistance(new Date("2027-03-13T09:00:00Z"), now)).toBe("in 3 days");
    expect(dayDistance(new Date("2027-03-09T08:00:00Z"), now)).toBe("yesterday");
    expect(dayDistance(new Date("2027-03-05T08:00:00Z"), now)).toBe("5 days ago");
  });
});
