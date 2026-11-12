"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { back, firstProblem } from "@/lib/action-helpers";
import { classLabel } from "@/lib/academics";
import { audit } from "@/lib/audit";
import { classAccess } from "@/lib/class-access";
import { prisma } from "@/lib/db";
import { accessProblem, feeStatusOf } from "@/lib/fees-data";
import { CATEGORY_LABEL, computeMarks, isLate, missingParts, scoreQuiz } from "@/lib/grading";
import { classCan } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

const value = (form: FormData, key: string) => { const v = form.get(key); return typeof v === "string" && v.trim() !== "" ? v : undefined; };
const text = (max: number, message: string) => z.string().trim().min(1, message).max(max, `Keep this under ${max} characters.`);
const link = z.string().trim().max(500, "That link is too long.").refine((v) => { try { return new URL(v).protocol === "https:"; } catch { return false; } }, "Enter a full link that starts with https://");

// Staff actions check again that the person teaches this class.
async function requireMarker(classId: string) {
  const user = await requireUser();
  const access = await classAccess(user, classId);
  const cls = access ? await prisma.courseClass.findUnique({ where: { id: classId }, include: { course: true, intake: true } }) : null;
  if (!access || !cls || !classCan(access, "assessments.manage")) back("/dashboard", "error", "You do not teach that class, or your role does not allow that.");
  return { user, cls };
}

// Marks cannot change while results are waiting for approval, or after a student's result is published.
async function lockReason(classId: string, enrolmentId?: string): Promise<string | null> {
  const results = await prisma.result.findMany({ where: { enrolment: { classId } }, select: { enrolmentId: true, status: true } });
  if (results.some((r) => r.status === "IN_REVIEW")) return "Results for this class are waiting for approval, so marks are locked. Take the results back first.";
  if (enrolmentId && results.some((r) => r.enrolmentId === enrolmentId && r.status === "PUBLISHED")) return "This student's result is published. It can change only after an approved appeal.";
  return null;
}

// ---- Setting assessments ----

const assessmentSchema = z.object({
  title: text(140, "Give the assessment a title."),
  category: z.enum(["CONTINUOUS", "ASSIGNMENT", "MIDTERM", "FINAL"], "Choose which part of the grade this counts toward."),
  kind: z.enum(["WRITTEN", "QUIZ", "OFFLINE"], "Choose how students take it."),
  instructions: text(4000, "Write the instructions."),
  maxScore: z.coerce.number().int("Marks must be a whole number.").min(1, "Marks must be at least 1.").max(1000, "That is too many marks.").optional(),
  dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a valid due date and time.").transform((v) => new Date(`${v}:00Z`)).optional(),
  timeLimitMinutes: z.coerce.number().int("Minutes must be a whole number.").min(1, "The time limit must be at least 1 minute.").max(300, "The time limit is too long.").optional(),
});

export async function createAssessmentAction(form: FormData) {
  const classId = String(form.get("classId") ?? "");
  const returnTo = `/teach/${classId}/assessments`;
  const { user, cls } = await requireMarker(classId);
  const parsed = assessmentSchema.safeParse({
    title: value(form, "title"), category: value(form, "category"), kind: value(form, "kind"), instructions: value(form, "instructions"),
    maxScore: value(form, "maxScore"), dueAt: value(form, "dueAt"), timeLimitMinutes: value(form, "timeLimitMinutes"),
  });
  if (!parsed.success) back(returnTo, "error", firstProblem(parsed.error));
  const d = parsed.data;
  // A quiz's marks are the sum of its questions, so it starts at zero.
  if (d.kind !== "QUIZ" && !d.maxScore) back(returnTo, "error", "Enter the marks this assessment is out of.");
  const a = await prisma.assessment.create({
    data: {
      classId, title: d.title, category: d.category, kind: d.kind, instructions: d.instructions,
      maxScore: d.kind === "QUIZ" ? 0 : d.maxScore!, dueAt: d.dueAt ?? null, timeLimitMinutes: d.kind === "QUIZ" ? d.timeLimitMinutes ?? null : null,
    },
  });
  await audit({ actor: user, action: "assessment.created", summary: `${user.name} set "${a.title}" (${CATEGORY_LABEL[a.category]}) for ${classLabel(cls)}`, entityType: "assessment", entityId: a.id });
  back(`/teach/${classId}/assessments/${a.id}`, "ok", d.kind === "QUIZ" ? "Quiz created. Add its questions, then open it." : "Assessment created as a draft. Open it when students should see it.");
}

export async function setAssessmentStatusAction(form: FormData) {
  const classId = String(form.get("classId") ?? "");
  const id = String(form.get("assessmentId") ?? "");
  const returnTo = `/teach/${classId}/assessments/${id}`;
  const { user, cls } = await requireMarker(classId);
  const status = z.enum(["OPEN", "CLOSED"]).safeParse(form.get("status"));
  const a = await prisma.assessment.findFirst({ where: { id, classId }, include: { _count: { select: { questions: true } } } });
  if (!a || !status.success) back(`/teach/${classId}/assessments`, "error", "That assessment no longer exists.");
  if (status.data === "OPEN" && a.kind === "QUIZ" && a._count.questions === 0) back(returnTo, "error", "Add at least one question before opening the quiz.");
  await prisma.assessment.update({ where: { id }, data: { status: status.data } });
  await audit({ actor: user, action: "assessment.status", summary: `${user.name} ${status.data === "OPEN" ? "opened" : "closed"} "${a.title}" for ${classLabel(cls)}`, entityType: "assessment", entityId: id });
  back(returnTo, "ok", status.data === "OPEN" ? "Students can now see and take this assessment." : "This assessment is closed to new work.");
}

const questionSchema = z.object({
  text: text(1000, "Write the question."),
  options: z.string().transform((v) => v.split("\n").map((o) => o.trim()).filter(Boolean)).pipe(z.array(z.string().max(300, "Keep each answer under 300 characters.")).min(2, "Give at least two answers, one per line.").max(6, "Give at most six answers.")),
  correct: z.coerce.number().int().min(1, "Say which answer is correct."),
  points: z.coerce.number().int("Marks must be a whole number.").min(1, "A question is worth at least 1 mark.").max(100, "That is too many marks for one question."),
});

export async function addQuestionAction(form: FormData) {
  const classId = String(form.get("classId") ?? "");
  const id = String(form.get("assessmentId") ?? "");
  const returnTo = `/teach/${classId}/assessments/${id}`;
  const { user } = await requireMarker(classId);
  const a = await prisma.assessment.findFirst({ where: { id, classId, kind: "QUIZ", status: "DRAFT" } });
  if (!a) back(returnTo, "error", "Questions can be changed only while the quiz is a draft.");
  const parsed = questionSchema.safeParse({ text: value(form, "text"), options: form.get("options") ?? "", correct: value(form, "correct"), points: value(form, "points") });
  if (!parsed.success) back(returnTo, "error", firstProblem(parsed.error));
  const d = parsed.data;
  if (d.correct > d.options.length) back(returnTo, "error", `The correct answer must be a number from 1 to ${d.options.length}.`);
  await prisma.$transaction(async (tx) => {
    const sort = await tx.question.count({ where: { assessmentId: id } });
    await tx.question.create({ data: { assessmentId: id, text: d.text, options: d.options, correctIndex: d.correct - 1, points: d.points, sort } });
    await tx.assessment.update({ where: { id }, data: { maxScore: { increment: d.points } } });
  });
  await audit({ actor: user, action: "assessment.question_added", summary: `${user.name} added a question to "${a.title}"`, entityType: "assessment", entityId: id });
  back(returnTo, "ok", "Question added.");
}

export async function deleteQuestionAction(form: FormData) {
  const classId = String(form.get("classId") ?? "");
  const id = String(form.get("assessmentId") ?? "");
  const returnTo = `/teach/${classId}/assessments/${id}`;
  const { user } = await requireMarker(classId);
  const q = await prisma.question.findFirst({ where: { id: String(form.get("questionId") ?? ""), assessment: { id, classId, status: "DRAFT" } }, include: { assessment: true } });
  if (!q) back(returnTo, "error", "Questions can be changed only while the quiz is a draft.");
  await prisma.$transaction([
    prisma.question.delete({ where: { id: q.id } }),
    prisma.assessment.update({ where: { id }, data: { maxScore: { decrement: q.points } } }),
  ]);
  await audit({ actor: user, action: "assessment.question_removed", summary: `${user.name} removed a question from "${q.assessment.title}"`, entityType: "assessment", entityId: id });
  back(returnTo, "ok", "Question removed.");
}

// ---- Marking ----

const markSchema = z.object({
  score: z.coerce.number("Enter the marks as a number.").min(0, "Marks cannot be below zero."),
  feedback: z.string().trim().max(2000, "Keep the feedback under 2,000 characters.").optional(),
  reason: z.string().trim().max(500, "Keep the reason under 500 characters.").optional(),
});

export async function markAction(form: FormData) {
  const classId = String(form.get("classId") ?? "");
  const assessmentId = String(form.get("assessmentId") ?? "");
  const enrolmentId = String(form.get("enrolmentId") ?? "");
  const returnTo = `/teach/${classId}/assessments/${assessmentId}/mark/${enrolmentId}`;
  const { user } = await requireMarker(classId);
  const [a, enrolment] = await Promise.all([
    prisma.assessment.findFirst({ where: { id: assessmentId, classId } }),
    prisma.enrolment.findFirst({ where: { id: enrolmentId, classId, status: "ACTIVE" }, include: { user: true } }),
  ]);
  if (!a || !enrolment) back(`/teach/${classId}/assessments`, "error", "That assessment or student is not in this class.");
  if (a.kind === "QUIZ") back(returnTo, "error", "Quizzes are marked automatically. Reset the attempt if the student should take it again.");
  const locked = await lockReason(classId, enrolmentId);
  if (locked) back(returnTo, "error", locked);

  const parsed = markSchema.safeParse({ score: value(form, "score"), feedback: value(form, "feedback"), reason: value(form, "reason") });
  if (!parsed.success) back(returnTo, "error", firstProblem(parsed.error));
  const { score, feedback, reason } = parsed.data;
  if (score > a.maxScore) back(returnTo, "error", `Marks cannot be more than ${a.maxScore}.`);

  const existing = await prisma.submission.findUnique({ where: { assessmentId_enrolmentId: { assessmentId, enrolmentId } } });
  if (a.kind === "WRITTEN" && !existing?.submittedAt) back(returnTo, "error", "This student has not handed in any work to mark.");
  const changing = existing?.score !== null && existing?.score !== undefined && existing.score !== score;
  // Changing a mark that was already given needs a reason, and the reason is recorded.
  if (changing && (!reason || reason.length < 5)) back(returnTo, "error", "Give a reason for changing a mark that was already recorded.");

  const data = { score, feedback: feedback ?? null, gradedById: user.id, gradedAt: new Date() };
  await prisma.submission.upsert({
    where: { assessmentId_enrolmentId: { assessmentId, enrolmentId } },
    create: { assessmentId, enrolmentId, submittedAt: new Date(), ...data },
    update: data,
  });
  await audit({
    actor: user, action: changing ? "grade.changed" : "grade.recorded",
    summary: changing
      ? `${user.name} changed ${enrolment.user.name}'s mark for "${a.title}" from ${existing!.score} to ${score} of ${a.maxScore}. Reason: ${reason}`
      : `${user.name} gave ${enrolment.user.name} ${score} of ${a.maxScore} for "${a.title}"`,
    entityType: "submission", entityId: `${assessmentId}:${enrolmentId}`, meta: { from: existing?.score ?? null, to: score, reason: reason ?? null },
  });
  back(`/teach/${classId}/assessments/${assessmentId}`, "ok", `${enrolment.user.name}: ${score} of ${a.maxScore} saved.`);
}

export async function resetAttemptAction(form: FormData) {
  const classId = String(form.get("classId") ?? "");
  const assessmentId = String(form.get("assessmentId") ?? "");
  const enrolmentId = String(form.get("enrolmentId") ?? "");
  const returnTo = `/teach/${classId}/assessments/${assessmentId}`;
  const { user } = await requireMarker(classId);
  const reason = z.string().trim().min(5, "Give a reason for letting the student take it again.").max(500, "Keep the reason under 500 characters.").safeParse(form.get("reason"));
  if (!reason.success) back(returnTo, "error", firstProblem(reason.error));
  const locked = await lockReason(classId, enrolmentId);
  if (locked) back(returnTo, "error", locked);
  const sub = await prisma.submission.findFirst({ where: { assessmentId, enrolmentId, assessment: { classId } }, include: { assessment: true, enrolment: { include: { user: true } } } });
  if (!sub) back(returnTo, "error", "That student has no attempt to reset.");
  await prisma.submission.delete({ where: { id: sub.id } });
  await audit({
    actor: user, action: "assessment.attempt_reset",
    summary: `${user.name} let ${sub.enrolment.user.name} take "${sub.assessment.title}" again (previous mark: ${sub.score ?? "none"}). Reason: ${reason.data}`,
    entityType: "submission", entityId: `${assessmentId}:${enrolmentId}`, meta: { previousScore: sub.score, reason: reason.data },
  });
  back(returnTo, "ok", `${sub.enrolment.user.name} can take this assessment again.`);
}

// ---- Results ----

export async function submitResultsAction(form: FormData) {
  const classId = String(form.get("classId") ?? "");
  const returnTo = `/teach/${classId}/gradebook`;
  const { user, cls } = await requireMarker(classId);
  const [assessments, enrolments, pending] = await Promise.all([
    prisma.assessment.findMany({ where: { classId, status: { not: "DRAFT" } }, include: { submissions: true } }),
    prisma.enrolment.findMany({ where: { classId, status: "ACTIVE" }, include: { result: true } }),
    prisma.approvalRequest.findFirst({ where: { type: "GRADES", status: "PENDING", payload: { path: ["classId"], equals: classId } } }),
  ]);
  if (pending) back(returnTo, "error", "Results for this class are already waiting for approval.");
  const missing = missingParts(assessments);
  if (missing.length) back(returnTo, "error", `Every part of the grade needs at least one assessment. Missing: ${missing.map((c) => CATEGORY_LABEL[c]).join(", ")}.`);
  const unmarked = assessments.flatMap((a) => a.submissions.filter((s) => s.submittedAt && s.score === null));
  if (unmarked.length) back(returnTo, "error", `${unmarked.length} piece${unmarked.length === 1 ? "" : "s"} of handed-in work ${unmarked.length === 1 ? "is" : "are"} not marked yet.`);
  // Students whose result is already published are left alone.
  const todo = enrolments.filter((e) => !e.result);
  if (!todo.length) back(returnTo, "error", "Every student in this class already has a published result.");

  await prisma.$transaction(async (tx) => {
    for (const e of todo) {
      const scores = new Map(assessments.flatMap((a) => a.submissions.filter((s) => s.enrolmentId === e.id && s.score !== null).map((s) => [a.id, s.score!] as const)));
      const { continuous, assignments, midterm, final, total, passed } = computeMarks(assessments, scores);
      await tx.result.create({ data: { enrolmentId: e.id, continuous, assignments, midterm, final, total, passed } });
    }
    await tx.approvalRequest.create({ data: { type: "GRADES", requestedById: user.id, payload: { classId, students: todo.length } } });
  });
  await audit({ actor: user, action: "approval.requested", summary: `${user.name} sent results for ${todo.length} ${todo.length === 1 ? "student" : "students"} in ${classLabel(cls)} for approval`, entityType: "class", entityId: classId, meta: { type: "GRADES", students: todo.length } });
  revalidatePath("/admin");
  back(returnTo, "ok", "Results sent for approval. Marks are locked until a decision is made.");
}

export async function withdrawResultsAction(form: FormData) {
  const classId = String(form.get("classId") ?? "");
  const returnTo = `/teach/${classId}/gradebook`;
  const { user, cls } = await requireMarker(classId);
  const done = await prisma.$transaction(async (tx) => {
    const cancelled = await tx.approvalRequest.updateMany({ where: { type: "GRADES", status: "PENDING", payload: { path: ["classId"], equals: classId } }, data: { status: "CANCELLED" } });
    if (cancelled.count) await tx.result.deleteMany({ where: { status: "IN_REVIEW", enrolment: { classId } } });
    return cancelled.count;
  });
  if (!done) back(returnTo, "error", "No results are waiting for approval.");
  await audit({ actor: user, action: "approval.cancelled", summary: `${user.name} took back the results for ${classLabel(cls)} from approval`, entityType: "class", entityId: classId });
  back(returnTo, "ok", "Results taken back. Marks can be changed again.");
}

// ---- Students: handing in work, quizzes and appeals ----

async function requireStudent(classId: string) {
  const user = await requireUser();
  const enrolment = await prisma.enrolment.findUnique({ where: { userId_classId: { userId: user.id, classId } }, include: { class: { include: { course: true, intake: true } }, result: true } });
  if (!enrolment || enrolment.status !== "ACTIVE") back("/my-classes", "error", "You are not enrolled in that class.");
  const paused = accessProblem(await feeStatusOf(enrolment.id));
  if (paused) back("/fees", "error", paused);
  return { user, enrolment };
}

async function openAssessment(classId: string, assessmentId: string, kind: "WRITTEN" | "QUIZ", returnTo: string) {
  const a = await prisma.assessment.findFirst({ where: { id: assessmentId, classId, kind }, include: { questions: true } });
  if (!a || a.status === "DRAFT") back(`/learn/${classId}`, "error", "That assessment is not available.");
  if (a.status === "CLOSED") back(returnTo, "error", "This assessment is closed.");
  if (a.dueAt && a.dueAt < new Date()) back(returnTo, "error", "The due date for this assessment has passed.");
  return a;
}

const writtenSchema = z.object({
  text: z.string().trim().min(20, "Write your answer (at least 20 characters).").max(20000, "Keep your answer under 20,000 characters."),
  link: link.optional(),
});

export async function submitWrittenAction(form: FormData) {
  const classId = String(form.get("classId") ?? "");
  const assessmentId = String(form.get("assessmentId") ?? "");
  const returnTo = `/learn/${classId}/assess/${assessmentId}`;
  const { user, enrolment } = await requireStudent(classId);
  const a = await openAssessment(classId, assessmentId, "WRITTEN", returnTo);
  const parsed = writtenSchema.safeParse({ text: form.get("text"), link: value(form, "link") });
  if (!parsed.success) back(returnTo, "error", firstProblem(parsed.error));
  const existing = await prisma.submission.findUnique({ where: { assessmentId_enrolmentId: { assessmentId, enrolmentId: enrolment.id } } });
  if (existing?.score !== null && existing?.score !== undefined) back(returnTo, "error", "This work has been marked and can no longer be changed.");
  const data = { text: parsed.data.text, link: parsed.data.link ?? null, submittedAt: new Date() };
  await prisma.submission.upsert({
    where: { assessmentId_enrolmentId: { assessmentId, enrolmentId: enrolment.id } },
    create: { assessmentId, enrolmentId: enrolment.id, ...data },
    update: data,
  });
  await audit({ actor: user, action: "assessment.submitted", summary: `${user.name} handed in "${a.title}" (${enrolment.class.course.title})`, entityType: "assessment", entityId: assessmentId });
  back(returnTo, "ok", "Your work has been handed in. You can change it until it is marked or the assessment closes.");
}

export async function startQuizAction(form: FormData) {
  const classId = String(form.get("classId") ?? "");
  const assessmentId = String(form.get("assessmentId") ?? "");
  const returnTo = `/learn/${classId}/assess/${assessmentId}`;
  const { user, enrolment } = await requireStudent(classId);
  const a = await openAssessment(classId, assessmentId, "QUIZ", returnTo);
  const existing = await prisma.submission.findUnique({ where: { assessmentId_enrolmentId: { assessmentId, enrolmentId: enrolment.id } } });
  if (!existing) {
    // The clock starts on the server, so it cannot be changed from the phone.
    await prisma.submission.create({ data: { assessmentId, enrolmentId: enrolment.id } });
    await audit({ actor: user, action: "assessment.quiz_started", summary: `${user.name} started the quiz "${a.title}" (${enrolment.class.course.title})`, entityType: "assessment", entityId: assessmentId });
  }
  back(returnTo, "ok", a.timeLimitMinutes ? `Your ${a.timeLimitMinutes} minutes have started.` : "Quiz started.");
}

export async function submitQuizAction(form: FormData) {
  const classId = String(form.get("classId") ?? "");
  const assessmentId = String(form.get("assessmentId") ?? "");
  const returnTo = `/learn/${classId}/assess/${assessmentId}`;
  const { user, enrolment } = await requireStudent(classId);
  const a = await prisma.assessment.findFirst({ where: { id: assessmentId, classId, kind: "QUIZ" }, include: { questions: true } });
  if (!a || a.status === "DRAFT") back(`/learn/${classId}`, "error", "That quiz is not available.");
  const sub = await prisma.submission.findUnique({ where: { assessmentId_enrolmentId: { assessmentId, enrolmentId: enrolment.id } } });
  if (!sub) back(returnTo, "error", "Start the quiz first.");
  if (sub.submittedAt) back(returnTo, "error", "You have already handed in this quiz.");

  const answers = Object.fromEntries(a.questions.map((q) => [q.id, value(form, `q-${q.id}`) ?? null]));
  const late = isLate(sub.startedAt, a.timeLimitMinutes, new Date());
  const score = late ? 0 : scoreQuiz(a.questions, answers);
  // The "not yet handed in" check in the update stops a second hand-in from another tab.
  const saved = await prisma.submission.updateMany({
    where: { id: sub.id, submittedAt: null },
    data: { answers, submittedAt: new Date(), score, gradedAt: new Date(), feedback: late ? "Handed in after the time limit, so no marks were given. Ask your lecturer if your connection failed." : null },
  });
  if (!saved.count) back(returnTo, "error", "You have already handed in this quiz.");
  await audit({ actor: user, action: "assessment.submitted", summary: `${user.name} handed in the quiz "${a.title}" (${enrolment.class.course.title}): ${score} of ${a.maxScore}${late ? ", after the time limit" : ""}`, entityType: "assessment", entityId: assessmentId, meta: { score, late } });
  back(returnTo, late ? "error" : "ok", late ? "Your time had run out, so no marks were given. Ask your lecturer if your connection failed." : `Quiz handed in. You scored ${score} of ${a.maxScore}.`);
}

export async function requestAppealAction(form: FormData) {
  const classId = String(form.get("classId") ?? "");
  const returnTo = `/learn/${classId}`;
  const { user, enrolment } = await requireStudent(classId);
  const reason = z.string().trim().min(20, "Explain what you think is wrong with your result (at least 20 characters).").max(1000, "Keep your reason under 1,000 characters.").safeParse(form.get("reason"));
  if (!reason.success) back(returnTo, "error", firstProblem(reason.error));
  if (enrolment.result?.status !== "PUBLISHED") back(returnTo, "error", "You can appeal only a published result.");
  const pending = await prisma.approvalRequest.findFirst({ where: { requestedById: user.id, type: "GRADE_APPEAL", status: "PENDING", payload: { path: ["enrolmentId"], equals: enrolment.id } } });
  if (pending) back(returnTo, "error", "You already have an appeal waiting for a decision.");
  const request = await prisma.approvalRequest.create({ data: { type: "GRADE_APPEAL", requestedById: user.id, payload: { enrolmentId: enrolment.id, classId, total: enrolment.result.total }, note: reason.data } });
  await audit({ actor: user, action: "approval.requested", summary: `${user.name} appealed their result of ${enrolment.result.total} in ${classLabel(enrolment.class)}`, entityType: "approval", entityId: request.id, meta: { type: "GRADE_APPEAL" } });
  revalidatePath("/admin");
  back(returnTo, "ok", "Your appeal has been sent to academic leadership.");
}
