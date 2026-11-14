"use server";

import { z } from "zod";
import { back, firstProblem } from "@/lib/action-helpers";
import { classLabel } from "@/lib/academics";
import { canEvaluate } from "@/lib/evaluation";
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

const rating = z.coerce.number().int().min(1, "Choose an answer for every question.").max(5);
const comment = z.string().trim().max(1000, "Keep each comment under 1,000 characters.").transform((v) => v || null);
const evaluationSchema = z.object({ teaching: rating, materials: rating, support: rating, overall: rating, wentWell: comment, improve: comment });

// A student hands in their course evaluation, once. The answers are stored without any link to the student.
export async function submitEvaluationAction(form: FormData) {
  const user = await requireUser();
  const classId = String(form.get("classId") ?? "");
  const page = `/evaluate/${classId}`;
  const enrolment = await prisma.enrolment.findUnique({ where: { userId_classId: { userId: user.id, classId } }, include: { result: true, class: { include: { course: true, intake: true } } } });
  if (!enrolment || (enrolment.status !== "ACTIVE" && enrolment.status !== "COMPLETED")) back("/my-classes", "error", "You are not enrolled in that class.");
  if (!canEvaluate(enrolment.class.status, enrolment.result?.status === "PUBLISHED")) back(page, "error", "This course cannot be evaluated yet.");
  const parsed = evaluationSchema.safeParse({
    teaching: form.get("teaching") ?? 0, materials: form.get("materials") ?? 0, support: form.get("support") ?? 0, overall: form.get("overall") ?? 0,
    wentWell: String(form.get("wentWell") ?? ""), improve: String(form.get("improve") ?? ""),
  });
  if (!parsed.success) back(page, "error", firstProblem(parsed.error));

  const saved = await prisma.$transaction(async (tx) => {
    // Marking the enrolment first means two hand-ins at the same moment cannot both be stored.
    const marked = await tx.enrolment.updateMany({ where: { id: enrolment.id, evaluatedAt: null }, data: { evaluatedAt: new Date() } });
    if (!marked.count) return false;
    await tx.courseEvaluation.create({ data: { classId, ...parsed.data } });
    return true;
  });
  if (!saved) back(page, "error", "You have already evaluated this course.");
  // The log records that an evaluation arrived, not who wrote it.
  await audit({ actor: null, action: "evaluation.submitted", summary: `A student evaluated ${classLabel(enrolment.class)}`, entityType: "class", entityId: classId });
  back(page, "ok", "Thank you. Your evaluation has been handed in.");
}
