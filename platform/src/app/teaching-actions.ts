"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { back, firstProblem } from "@/lib/action-helpers";
import { classLabel } from "@/lib/academics";
import { audit } from "@/lib/audit";
import { classAccess } from "@/lib/class-access";
import { prisma } from "@/lib/db";
import { classStudentIds, notify } from "@/lib/notify";
import { classCan, type ClassTask } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

// Every action checks again that the person works with this class and may do this task.
async function requireStaff(classId: string, task: ClassTask) {
  const user = await requireUser();
  const access = await classAccess(user, classId);
  const cls = access ? await prisma.courseClass.findUnique({ where: { id: classId }, include: { course: true, intake: true } }) : null;
  if (!access || !cls || !classCan(access, task)) back("/dashboard", "error", "You do not work with that class, or your role does not allow that.");
  return { user, cls };
}

const value = (form: FormData, key: string) => { const v = form.get(key); return typeof v === "string" && v.trim() !== "" ? v : undefined; };
const text = (max: number, message: string) => z.string().trim().min(1, message).max(max, `Keep this under ${max} characters.`);
const link = z.string().trim().max(500, "That link is too long.").refine((v) => { try { return new URL(v).protocol === "https:"; } catch { return false; } }, "Enter a full link that starts with https://");

// ---- Lessons ----

export async function createModuleAction(form: FormData) {
  const classId = String(form.get("classId") ?? "");
  const returnTo = `/teach/${classId}/content`;
  const { user, cls } = await requireStaff(classId, "content.edit");
  const title = text(120, "Give the module a title.").safeParse(value(form, "title"));
  if (!title.success) back(returnTo, "error", firstProblem(title.error));
  const sort = await prisma.module.count({ where: { courseId: cls.courseId } });
  const mod = await prisma.module.create({ data: { courseId: cls.courseId, title: title.data, sort } });
  await audit({ actor: user, action: "content.module_created", summary: `${user.name} added the module "${mod.title}" to ${cls.course.title}`, entityType: "module", entityId: mod.id });
  back(returnTo, "ok", "Module added. Now add its lessons.");
}

const lessonSchema = z.object({
  moduleId: text(60, "Choose a module."),
  title: text(140, "Give the lesson a title."),
  kind: z.enum(["ONLINE", "PRACTICAL"], "Choose online or practical."),
  body: z.string().trim().min(20, "Write the lesson (at least 20 characters).").max(20000, "Keep the lesson under 20,000 characters. Split longer lessons in two."),
  minutes: z.coerce.number().int("Minutes must be a whole number.").min(1, "Minutes must be at least 1.").max(600, "That is too long for one lesson.").optional(),
  resourceUrl: link.optional(),
});

export async function saveLessonAction(form: FormData) {
  const classId = String(form.get("classId") ?? "");
  const lessonId = value(form, "lessonId");
  const returnTo = lessonId ? `/teach/${classId}/content/${lessonId}` : `/teach/${classId}/content/new`;
  const { user, cls } = await requireStaff(classId, "content.edit");
  const parsed = lessonSchema.safeParse({
    moduleId: value(form, "moduleId"), title: value(form, "title"), kind: value(form, "kind"), body: form.get("body"),
    minutes: value(form, "minutes"), resourceUrl: value(form, "resourceUrl"),
  });
  if (!parsed.success) back(returnTo, "error", firstProblem(parsed.error));
  const d = parsed.data;
  // The module must belong to this class's course.
  const mod = await prisma.module.findFirst({ where: { id: d.moduleId, courseId: cls.courseId } });
  if (!mod) back(returnTo, "error", "That module is not part of this course.");

  const data = { moduleId: mod.id, title: d.title, kind: d.kind, body: d.body, minutes: d.minutes ?? null, resourceUrl: d.resourceUrl ?? null };
  if (lessonId) {
    // Only a draft can be changed. Published lessons are taken back to draft first.
    const changed = await prisma.lesson.updateMany({ where: { id: lessonId, status: "DRAFT", module: { courseId: cls.courseId } }, data });
    if (!changed.count) back(`/teach/${classId}/content`, "error", "Only a draft lesson can be changed.");
    await audit({ actor: user, action: "content.lesson_updated", summary: `${user.name} edited the lesson "${d.title}" in ${cls.course.title}`, entityType: "lesson", entityId: lessonId });
  } else {
    const sort = await prisma.lesson.count({ where: { moduleId: mod.id } });
    const lesson = await prisma.lesson.create({ data: { ...data, sort } });
    await audit({ actor: user, action: "content.lesson_created", summary: `${user.name} wrote the lesson "${d.title}" in ${cls.course.title}`, entityType: "lesson", entityId: lesson.id });
  }
  back(`/teach/${classId}/content`, "ok", "Lesson saved as a draft. Send it for review when it is ready.");
}

export async function deleteLessonAction(form: FormData) {
  const classId = String(form.get("classId") ?? "");
  const returnTo = `/teach/${classId}/content`;
  const { user, cls } = await requireStaff(classId, "content.edit");
  const lesson = await prisma.lesson.findFirst({ where: { id: String(form.get("lessonId") ?? ""), status: "DRAFT", module: { courseId: cls.courseId } } });
  if (!lesson) back(returnTo, "error", "Only a draft lesson can be deleted.");
  await prisma.lesson.delete({ where: { id: lesson.id } });
  await audit({ actor: user, action: "content.lesson_deleted", summary: `${user.name} deleted the draft lesson "${lesson.title}" from ${cls.course.title}`, entityType: "lesson", entityId: lesson.id });
  back(returnTo, "ok", "Draft deleted.");
}

export async function unpublishLessonAction(form: FormData) {
  const classId = String(form.get("classId") ?? "");
  const returnTo = `/teach/${classId}/content`;
  const { user, cls } = await requireStaff(classId, "content.edit");
  const lessonId = String(form.get("lessonId") ?? "");
  const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, status: "PUBLISHED", module: { courseId: cls.courseId } } });
  if (!lesson) back(returnTo, "error", "That lesson is not published.");
  await prisma.lesson.update({ where: { id: lessonId }, data: { status: "DRAFT" } });
  await audit({ actor: user, action: "content.lesson_unpublished", summary: `${user.name} took the lesson "${lesson.title}" in ${cls.course.title} back to draft`, entityType: "lesson", entityId: lessonId });
  back(returnTo, "ok", "The lesson is a draft again. Students cannot see it until it is reviewed and published.");
}

export async function submitForReviewAction(form: FormData) {
  const classId = String(form.get("classId") ?? "");
  const returnTo = `/teach/${classId}/content`;
  const { user, cls } = await requireStaff(classId, "content.edit");
  const pending = await prisma.approvalRequest.findFirst({ where: { type: "COURSE_PUBLISH", status: "PENDING", payload: { path: ["courseId"], equals: cls.courseId } } });
  if (pending) back(returnTo, "error", "Lessons for this course are already waiting for review.");

  const count = await prisma.$transaction(async (tx) => {
    const locked = await tx.lesson.updateMany({ where: { status: "DRAFT", module: { courseId: cls.courseId } }, data: { status: "IN_REVIEW" } });
    if (locked.count) await tx.approvalRequest.create({ data: { type: "COURSE_PUBLISH", requestedById: user.id, payload: { courseId: cls.courseId, classId, lessons: locked.count } } });
    return locked.count;
  });
  if (!count) back(returnTo, "error", "There are no draft lessons to send.");
  await audit({ actor: user, action: "approval.requested", summary: `${user.name} sent ${count} ${count === 1 ? "lesson" : "lessons"} in ${cls.course.title} for review`, entityType: "course", entityId: cls.courseId, meta: { type: "COURSE_PUBLISH", lessons: count } });
  revalidatePath("/admin");
  back(returnTo, "ok", `${count} ${count === 1 ? "lesson was" : "lessons were"} sent for review. They are locked until a decision is made.`);
}

export async function withdrawReviewAction(form: FormData) {
  const classId = String(form.get("classId") ?? "");
  const returnTo = `/teach/${classId}/content`;
  const { user, cls } = await requireStaff(classId, "content.edit");
  const done = await prisma.$transaction(async (tx) => {
    const cancelled = await tx.approvalRequest.updateMany({ where: { type: "COURSE_PUBLISH", status: "PENDING", payload: { path: ["courseId"], equals: cls.courseId } }, data: { status: "CANCELLED" } });
    if (cancelled.count) await tx.lesson.updateMany({ where: { status: "IN_REVIEW", module: { courseId: cls.courseId } }, data: { status: "DRAFT" } });
    return cancelled.count;
  });
  if (!done) back(returnTo, "error", "Nothing is waiting for review.");
  await audit({ actor: user, action: "approval.cancelled", summary: `${user.name} took back the lessons in ${cls.course.title} from review`, entityType: "course", entityId: cls.courseId });
  back(returnTo, "ok", "The lessons are drafts again and can be edited.");
}

// ---- Sessions and attendance ----

const sessionSchema = z.object({
  title: text(120, "Give the session a title."),
  kind: z.enum(["ONLINE", "PRACTICAL"], "Choose online or practical."),
  // Times are entered and shown in Liberia time, which is the same as UTC.
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose the date and time.").transform((v) => new Date(`${v}:00Z`)),
  meetingUrl: link.optional(),
});

export async function createSessionAction(form: FormData) {
  const classId = String(form.get("classId") ?? "");
  const returnTo = `/teach/${classId}/sessions`;
  const { user, cls } = await requireStaff(classId, "sessions.manage");
  const parsed = sessionSchema.safeParse({ title: value(form, "title"), kind: value(form, "kind"), startsAt: value(form, "startsAt"), meetingUrl: value(form, "meetingUrl") });
  if (!parsed.success) back(returnTo, "error", firstProblem(parsed.error));
  const d = parsed.data;
  if (d.kind === "ONLINE" && !d.meetingUrl) back(returnTo, "error", "An online session needs its meeting link.");
  const session = await prisma.classSession.create({ data: { classId, title: d.title, kind: d.kind, startsAt: d.startsAt, meetingUrl: d.meetingUrl ?? null, createdById: user.id } });
  await audit({ actor: user, action: "session.created", summary: `${user.name} scheduled "${d.title}" for ${classLabel(cls)}`, entityType: "session", entityId: session.id });
  back(returnTo, "ok", "Session added. Students can see it on their class page.");
}

export async function saveAttendanceAction(form: FormData) {
  const classId = String(form.get("classId") ?? "");
  const sessionId = String(form.get("sessionId") ?? "");
  const returnTo = `/teach/${classId}/sessions/${sessionId}`;
  const { user, cls } = await requireStaff(classId, "sessions.manage");
  const session = await prisma.classSession.findFirst({ where: { id: sessionId, classId } });
  if (!session) back(`/teach/${classId}/sessions`, "error", "That session no longer exists.");

  // Only students enrolled in this class can be marked.
  const enrolments = await prisma.enrolment.findMany({ where: { classId, status: "ACTIVE" }, select: { id: true } });
  const marks = enrolments.flatMap((e) => {
    const status = z.enum(["PRESENT", "ABSENT", "EXCUSED"]).safeParse(form.get(`status-${e.id}`));
    return status.success ? [{ enrolmentId: e.id, status: status.data }] : [];
  });
  if (!marks.length) back(returnTo, "error", "Mark at least one student.");
  await prisma.$transaction(marks.map((m) => prisma.attendance.upsert({
    where: { sessionId_enrolmentId: { sessionId, enrolmentId: m.enrolmentId } },
    create: { sessionId, enrolmentId: m.enrolmentId, status: m.status },
    update: { status: m.status },
  })));
  const present = marks.filter((m) => m.status === "PRESENT").length;
  await audit({ actor: user, action: "attendance.recorded", summary: `${user.name} recorded attendance for "${session.title}" (${classLabel(cls)}): ${present} of ${marks.length} present`, entityType: "session", entityId: sessionId });
  back(returnTo, "ok", `Attendance saved: ${present} of ${marks.length} present.`);
}

// ---- Practical sign-off ----

export async function signOffPracticalAction(form: FormData) {
  const classId = String(form.get("classId") ?? "");
  const lessonId = String(form.get("lessonId") ?? "");
  const returnTo = `/teach/${classId}/practical/${lessonId}`;
  const { user, cls } = await requireStaff(classId, "sessions.manage");
  const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, kind: "PRACTICAL", status: "PUBLISHED", module: { courseId: cls.courseId } } });
  if (!lesson) back(`/teach/${classId}`, "error", "That practical lesson is not published in this course.");

  const enrolments = await prisma.enrolment.findMany({ where: { classId, status: "ACTIVE" }, include: { progress: { where: { lessonId } } } });
  const add = enrolments.filter((e) => form.get(`done-${e.id}`) === "on" && e.progress.length === 0);
  const remove = enrolments.filter((e) => form.get(`done-${e.id}`) !== "on" && e.progress.length > 0);
  await prisma.$transaction([
    ...add.map((e) => prisma.lessonProgress.create({ data: { enrolmentId: e.id, lessonId, signedOffById: user.id } })),
    ...remove.map((e) => prisma.lessonProgress.delete({ where: { enrolmentId_lessonId: { enrolmentId: e.id, lessonId } } })),
  ]);
  if (add.length || remove.length) {
    await audit({
      actor: user, action: "learning.practical_signed_off",
      summary: `${user.name} updated sign-off for the practical "${lesson.title}" (${classLabel(cls)}): ${add.length} signed off${remove.length ? `, ${remove.length} removed` : ""}`,
      entityType: "lesson", entityId: lessonId, meta: { added: add.map((e) => e.id), removed: remove.map((e) => e.id) },
    });
  }
  back(returnTo, "ok", "Sign-off saved.");
}

// ---- Announcements ----

const announcementSchema = z.object({ title: text(120, "Give the announcement a title."), body: text(2000, "Write the announcement.") });

export async function postAnnouncementAction(form: FormData) {
  const classId = String(form.get("classId") ?? "");
  const returnTo = `/teach/${classId}`;
  const { user, cls } = await requireStaff(classId, "announcements.post");
  const parsed = announcementSchema.safeParse({ title: value(form, "title"), body: value(form, "body") });
  if (!parsed.success) back(returnTo, "error", firstProblem(parsed.error));
  const a = await prisma.announcement.create({ data: { classId, authorId: user.id, ...parsed.data } });
  await audit({ actor: user, action: "announcement.posted", summary: `${user.name} posted "${a.title}" to ${classLabel(cls)}`, entityType: "announcement", entityId: a.id });
  await notify(await classStudentIds(classId), { title: `${cls.course.title}: ${a.title}`, body: a.body, href: `/learn/${classId}` });
  back(returnTo, "ok", "Announcement posted.");
}
