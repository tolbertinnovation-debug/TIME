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
