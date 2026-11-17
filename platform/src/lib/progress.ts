// Progress through a course, split into online and practical work.
export type Progress = { onlineDone: number; onlineTotal: number; practicalDone: number; practicalTotal: number; percent: number };

export function summarise(lessons: { id: string; kind: "ONLINE" | "PRACTICAL" }[], done: Set<string>): Progress {
  let onlineDone = 0, onlineTotal = 0, practicalDone = 0, practicalTotal = 0;
  for (const l of lessons) {
    if (l.kind === "ONLINE") { onlineTotal++; if (done.has(l.id)) onlineDone++; }
    else { practicalTotal++; if (done.has(l.id)) practicalDone++; }
  }
  const total = onlineTotal + practicalTotal;
  return { onlineDone, onlineTotal, practicalDone, practicalTotal, percent: total ? Math.round(((onlineDone + practicalDone) / total) * 100) : 0 };
}

// Attendance as a percentage of the sessions that were marked. Excused sessions are left out.
export function attendancePercent(statuses: ("PRESENT" | "ABSENT" | "EXCUSED")[]): number | null {
  const counted = statuses.filter((s) => s !== "EXCUSED");
  if (!counted.length) return null;
  return Math.round((counted.filter((s) => s === "PRESENT").length / counted.length) * 100);
}

// The lessons just before and after one lesson, in course order, for Previous and Next buttons.
export function neighbours<T extends { id: string }>(lessons: T[], id: string): { previous: T | null; next: T | null } {
  const i = lessons.findIndex((l) => l.id === id);
  if (i < 0) return { previous: null, next: null };
  return { previous: lessons[i - 1] ?? null, next: lessons[i + 1] ?? null };
}

const DAY = 24 * 60 * 60 * 1000;
// Days are counted in Liberia time, which is the same as UTC.
const dayNumber = (d: Date) => Math.floor(d.getTime() / DAY);

// "today", "tomorrow", "in 3 days", or "2 days ago": how far a date is from now, in whole days.
export function dayDistance(date: Date, now: Date): string {
  const n = dayNumber(date) - dayNumber(now);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}
