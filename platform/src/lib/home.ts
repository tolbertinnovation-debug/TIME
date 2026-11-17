// What the home page shows each person: for a student, what to do next in each class;
// for a lecturer or facilitator, the work waiting in the classes they are assigned to.
import { classLabel } from "@/lib/academics";
import { prisma } from "@/lib/db";
import { feeStatuses } from "@/lib/fees-data";
import { summarise } from "@/lib/progress";

const SOON_DAYS = 14;
const soon = () => new Date(Date.now() + SOON_DAYS * 24 * 60 * 60 * 1000);
// A session still counts as "coming" for two hours after it starts.
const recently = () => new Date(Date.now() - 2 * 60 * 60 * 1000);

export async function studentAgenda(userId: string) {
  const enrolments = await prisma.enrolment.findMany({
    where: { userId, status: "ACTIVE" },
    orderBy: { enrolledAt: "asc" },
    include: { progress: { select: { lessonId: true } }, class: { include: { course: true, intake: true } } },
  });
  if (!enrolments.length) return [];
  const fees = await feeStatuses(enrolments.map((e) => e.id));
  // A class whose fees block access shows only a note: its lessons and sessions stay hidden.
  const open = enrolments.filter((e) => fees.get(e.id)?.hasAccess);
  const classIds = open.map((e) => e.classId);
  const [modules, sessions, assessments] = await Promise.all([
    prisma.module.findMany({ where: { courseId: { in: open.map((e) => e.class.courseId) } }, orderBy: { sort: "asc" }, include: { lessons: { where: { status: "PUBLISHED" }, orderBy: { sort: "asc" }, select: { id: true, title: true, kind: true, minutes: true } } } }),
    prisma.classSession.findMany({ where: { classId: { in: classIds }, startsAt: { gte: recently(), lte: soon() } }, orderBy: { startsAt: "asc" } }),
    prisma.assessment.findMany({ where: { classId: { in: classIds }, status: "OPEN" }, orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }], include: { submissions: { where: { enrolmentId: { in: open.map((e) => e.id) } }, select: { enrolmentId: true, submittedAt: true } } } }),
  ]);
  return enrolments.map((e) => {
    const hasAccess = Boolean(fees.get(e.id)?.hasAccess);
    const lessons = modules.filter((m) => m.courseId === e.class.courseId).flatMap((m) => m.lessons);
    const done = new Set(e.progress.map((p) => p.lessonId));
    return {
      classId: e.classId,
      title: e.class.course.title,
      label: classLabel(e.class),
      hasAccess,
      progress: summarise(lessons, done),
      lessonCount: lessons.length,
      nextLesson: hasAccess ? lessons.find((l) => l.kind === "ONLINE" && !done.has(l.id)) ?? null : null,
      sessions: sessions.filter((s) => s.classId === e.classId).slice(0, 3),
      // Work still to hand in: open, and not yet handed in by this student.
      toDo: assessments.filter((a) => a.classId === e.classId && !a.submissions.some((s) => s.enrolmentId === e.id && s.submittedAt)).slice(0, 4),
    };
  });
}

export async function teachingAgenda(userId: string, role: "LECTURER" | "FACILITATOR") {
  // Only assignments that match the person's current role count, as everywhere else.
  const rows = await prisma.classStaff.findMany({ where: { userId, role }, include: { class: { include: { course: true, intake: true, _count: { select: { enrolments: { where: { status: "ACTIVE" } } } } } } } });
  const classes = rows.map((r) => r.class).filter((c) => c.status !== "ENDED");
  if (!classes.length) return [];
  const classIds = classes.map((c) => c.id);
  const [toMark, sessions] = await Promise.all([
    // Handed in, not yet marked. Facilitators do not mark, so they are not shown this.
    role === "LECTURER"
      ? prisma.submission.findMany({ where: { submittedAt: { not: null }, score: null, assessment: { classId: { in: classIds } }, enrolment: { status: "ACTIVE" } }, select: { assessment: { select: { classId: true } } } })
      : Promise.resolve([]),
    prisma.classSession.findMany({ where: { classId: { in: classIds }, startsAt: { gte: recently(), lte: soon() } }, orderBy: { startsAt: "asc" } }),
  ]);
  return classes.map((c) => ({
    classId: c.id,
    title: c.course.title,
    label: classLabel(c),
    students: c._count.enrolments,
    toMark: toMark.filter((s) => s.assessment.classId === c.id).length,
    sessions: sessions.filter((s) => s.classId === c.id).slice(0, 3),
  }));
}
