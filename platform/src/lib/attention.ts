// Which students in a class need their lecturer's attention, and why.
// The rules are deliberately cautious, so a flag means something:
//   - attendance is judged only after two sessions have been marked;
//   - only lessons published at least a week ago count as "should have been done";
//   - only work a student hands in themselves counts as missed (not paper exams the lecturer enters).
export const LOW_ATTENDANCE = 75; // per cent
export const LESSON_GRACE_DAYS = 7;
export const MIN_SESSIONS = 2;
export const MIN_LESSONS = 2;

export type AttentionInput = {
  attendance: ("PRESENT" | "ABSENT" | "EXCUSED")[];
  // Online lessons published at least LESSON_GRACE_DAYS ago, and how many of them the student has done
  lessonsExpected: number;
  lessonsDone: number;
  // Work whose due date has passed and that the student did not hand in
  missedWork: number;
};

export function attentionReasons(s: AttentionInput): string[] {
  const reasons: string[] = [];
  const counted = s.attendance.filter((a) => a !== "EXCUSED");
  if (counted.length >= MIN_SESSIONS) {
    const percent = Math.round((counted.filter((a) => a === "PRESENT").length / counted.length) * 100);
    if (percent < LOW_ATTENDANCE) reasons.push(`Attendance ${percent}%`);
  }
  if (s.lessonsExpected >= MIN_LESSONS && s.lessonsDone * 2 < s.lessonsExpected) {
    reasons.push(`Behind on lessons: ${s.lessonsDone} of ${s.lessonsExpected}`);
  }
  if (s.missedWork > 0) reasons.push(`Missed ${s.missedWork} ${s.missedWork === 1 ? "piece" : "pieces"} of work`);
  return reasons;
}
