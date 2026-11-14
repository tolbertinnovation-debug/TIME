"use server";

import { back } from "@/lib/action-helpers";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { accessProblem, feeStatusOf } from "@/lib/fees-data";
import { requireUser } from "@/lib/session";

// A student marks an online lesson complete. Practical lessons are signed off by staff instead.
export async function completeLessonAction(form: FormData) {
  const user = await requireUser();
  const classId = String(form.get("classId") ?? "");
  const lessonId = String(form.get("lessonId") ?? "");
  const enrolment = await prisma.enrolment.findUnique({ where: { userId_classId: { userId: user.id, classId } }, include: { class: { include: { course: true } } } });
  if (!enrolment || enrolment.status !== "ACTIVE") back("/my-classes", "error", "You are not enrolled in that class.");
  const paused = accessProblem(await feeStatusOf(enrolment.id));
  if (paused) back("/fees", "error", paused);
  const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, status: "PUBLISHED", module: { courseId: enrolment.class.courseId } } });
  if (!lesson) back(`/learn/${classId}`, "error", "That lesson is not available.");
  if (lesson.kind !== "ONLINE") back(`/learn/${classId}/${lessonId}`, "error", "Your lecturer or facilitator signs off practical work.");

  const existing = await prisma.lessonProgress.findUnique({ where: { enrolmentId_lessonId: { enrolmentId: enrolment.id, lessonId } } });
  if (!existing) {
    await prisma.lessonProgress.create({ data: { enrolmentId: enrolment.id, lessonId } });
    await audit({ actor: user, action: "learning.lesson_completed", summary: `${user.name} completed the lesson "${lesson.title}" in ${enrolment.class.course.title}`, entityType: "lesson", entityId: lessonId });
  }
  back(`/learn/${classId}`, "ok", `"${lesson.title}" is marked complete.`);
}
