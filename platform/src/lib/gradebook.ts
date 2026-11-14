import { prisma } from "@/lib/db";
import { computeMarks, missingParts, type Marks } from "@/lib/grading";

// A class's marks: live figures worked out from the work marked so far, next to any result already fixed.
export async function loadGradebook(classId: string) {
  const [assessments, enrolments] = await Promise.all([
    prisma.assessment.findMany({ where: { classId, status: { not: "DRAFT" } }, include: { submissions: true }, orderBy: { createdAt: "asc" } }),
    prisma.enrolment.findMany({ where: { classId, status: "ACTIVE" }, include: { user: true, result: true }, orderBy: { user: { name: "asc" } } }),
  ]);
  const rows = enrolments.map((e) => {
    const scores = new Map(assessments.flatMap((a) => a.submissions.filter((s) => s.enrolmentId === e.id && s.score !== null).map((s) => [a.id, s.score!] as const)));
    const live: Marks = computeMarks(assessments, scores);
    // Once a result is sent for approval it is fixed; show that, not the live figure.
    const marks: Marks = e.result ?? live;
    return { enrolmentId: e.id, name: e.user.name, studentNumber: e.user.studentNumber, marks, status: e.result?.status ?? null };
  });
  const unmarked = assessments.reduce((n, a) => n + a.submissions.filter((s) => s.submittedAt && s.score === null).length, 0);
  return { assessments, rows, missing: missingParts(assessments), unmarked };
}
