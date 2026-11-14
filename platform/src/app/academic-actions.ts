"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { back, firstProblem } from "@/lib/action-helpers";
import { classLabel } from "@/lib/academics";
import { auth } from "@/lib/auth";
import { MIN_PASSWORD } from "@/lib/auth-core";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { can, ROLE_LABEL } from "@/lib/permissions";
import { requireUser, type CurrentUser } from "@/lib/session";
import type { Capability } from "@/lib/permissions";

// Actions never trust the page that sent them: each one checks the person's role again.
async function requireActor(capability: Capability, returnTo: string): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.role, capability)) back(returnTo, "error", "Your role does not allow that.");
  return user;
}

const text = (max: number, message: string) => z.string().trim().min(1, message).max(max, `Keep this under ${max} characters.`);
const optionalText = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`).optional();
const day = (message: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, message).transform((v) => new Date(`${v}T00:00:00Z`));
const value = (form: FormData, key: string) => { const v = form.get(key); return typeof v === "string" && v.trim() !== "" ? v : undefined; };

// ---- Intakes ----

const intakeSchema = z.object({
  name: text(60, "Give the intake a name, like March 2027."),
  startDate: day("Choose the date classes start."),
  registerBy: day("Choose a valid registration date.").optional(),
});

export async function createIntakeAction(form: FormData) {
  const user = await requireActor("setup.manage", "/admin/setup");
  const parsed = intakeSchema.safeParse({ name: value(form, "name"), startDate: value(form, "startDate"), registerBy: value(form, "registerBy") });
  if (!parsed.success) back("/admin/setup", "error", firstProblem(parsed.error));
  const { name, startDate, registerBy } = parsed.data;
  if (registerBy && registerBy > startDate) back("/admin/setup", "error", "The registration date must be before classes start.");
  if (await prisma.intake.findUnique({ where: { name } })) back("/admin/setup", "error", `There is already an intake called ${name}.`);

  const intake = await prisma.intake.create({ data: { name, startDate, registerBy } });
  await audit({ actor: user, action: "setup.intake_created", summary: `${user.name} created the ${name} intake`, entityType: "intake", entityId: intake.id });
  revalidatePath("/admin");
  back("/admin/setup", "ok", `The ${name} intake was created. Open it when students can apply.`);
}

export async function setIntakeStatusAction(form: FormData) {
  const user = await requireActor("setup.manage", "/admin/setup");
  const status = z.enum(["PLANNED", "OPEN", "CLOSED"]).safeParse(form.get("status"));
  const intake = await prisma.intake.findUnique({ where: { id: String(form.get("id") ?? "") } });
  if (!status.success || !intake) back("/admin/setup", "error", "That intake no longer exists.");
  if (intake.status === status.data) back("/admin/setup", "ok", "Nothing changed.");

  await prisma.intake.update({ where: { id: intake.id }, data: { status: status.data } });
  const word = { PLANNED: "set back to planned", OPEN: "opened for applications", CLOSED: "closed to applications" }[status.data];
  await audit({ actor: user, action: "setup.intake_status", summary: `${user.name} ${word} the ${intake.name} intake`, entityType: "intake", entityId: intake.id, meta: { from: intake.status, to: status.data } });
  revalidatePath("/admin");
  back("/admin/setup", "ok", `${intake.name} is now ${word.replace("set back to ", "")}.`);
}

// ---- Study centres ----

const centreSchema = z.object({
  name: text(80, "Give the study centre a name."),
  county: text(60, "Enter the county."),
  address: optionalText(200),
});

export async function createCentreAction(form: FormData) {
  const user = await requireActor("setup.manage", "/admin/setup");
  const parsed = centreSchema.safeParse({ name: value(form, "name"), county: value(form, "county"), address: value(form, "address") });
  if (!parsed.success) back("/admin/setup", "error", firstProblem(parsed.error));
  if (await prisma.studyCentre.findUnique({ where: { name: parsed.data.name } })) back("/admin/setup", "error", "There is already a study centre with that name.");

  const centre = await prisma.studyCentre.create({ data: parsed.data });
  await audit({ actor: user, action: "setup.centre_created", summary: `${user.name} added the study centre ${centre.name}, ${centre.county}`, entityType: "study_centre", entityId: centre.id });
  back("/admin/setup", "ok", `${centre.name} was added.`);
}

// ---- Classes ----

const classSchema = z.object({
  courseId: text(200, "Choose a course."),
  intakeId: text(60, "Choose an intake."),
  track: z.enum(["WEEKDAY", "SATURDAY"], "Choose a schedule."),
  mode: z.enum(["ONLINE", "BLENDED"], "Choose online or blended."),
  studyCentreId: optionalText(60),
  capacity: z.coerce.number().int("Capacity must be a whole number.").min(1, "Capacity must be at least 1.").max(1000, "Capacity is too large.").optional(),
});

export async function createClassAction(form: FormData) {
  const user = await requireActor("setup.manage", "/admin/classes");
  const parsed = classSchema.safeParse({
    courseId: value(form, "courseId"), intakeId: value(form, "intakeId"), track: value(form, "track"), mode: value(form, "mode"),
    studyCentreId: value(form, "studyCentreId"), capacity: value(form, "capacity"),
  });
  if (!parsed.success) back("/admin/classes", "error", firstProblem(parsed.error));
  const d = parsed.data;
  const [course, intake, centre, existing] = await Promise.all([
    prisma.course.findUnique({ where: { id: d.courseId } }),
    prisma.intake.findUnique({ where: { id: d.intakeId } }),
    d.studyCentreId ? prisma.studyCentre.findUnique({ where: { id: d.studyCentreId } }) : null,
    prisma.courseClass.findUnique({ where: { courseId_intakeId_track: { courseId: d.courseId, intakeId: d.intakeId, track: d.track } } }),
  ]);
  if (!course || !intake || (d.studyCentreId && !centre)) back("/admin/classes", "error", "That course, intake or study centre no longer exists.");
  if (existing) back("/admin/classes", "error", "That class already exists for this intake and schedule.");
  if (d.mode === "BLENDED" && !centre) back("/admin/classes", "error", "A blended class needs a study centre for its in-person sessions.");

  const cls = await prisma.courseClass.create({ data: { courseId: d.courseId, intakeId: d.intakeId, track: d.track, mode: d.mode, studyCentreId: centre?.id, capacity: d.capacity } });
  const label = classLabel({ course, intake, track: d.track });
  await audit({ actor: user, action: "setup.class_created", summary: `${user.name} created the class ${label}`, entityType: "class", entityId: cls.id });
  revalidatePath("/admin");
  back(`/admin/classes/${cls.id}`, "ok", "The class was created. Assign its lecturer next.");
}

export async function setClassStatusAction(form: FormData) {
  const id = String(form.get("id") ?? "");
  const user = await requireActor("setup.manage", `/admin/classes/${id}`);
  const status = form.get("status") === "CLOSED" ? "CLOSED" : "OPEN";
  const cls = await prisma.courseClass.findUnique({ where: { id }, include: { course: true, intake: true } });
  if (!cls) back("/admin/classes", "error", "That class no longer exists.");
  await prisma.courseClass.update({ where: { id }, data: { status } });
  await audit({ actor: user, action: "setup.class_status", summary: `${user.name} ${status === "OPEN" ? "reopened" : "closed"} applications for ${classLabel(cls)}`, entityType: "class", entityId: id });
  back(`/admin/classes/${id}`, "ok", status === "OPEN" ? "Students can apply to this class again." : "This class no longer takes applications.");
}

export async function assignStaffAction(form: FormData) {
  const classId = String(form.get("classId") ?? "");
  const user = await requireActor("setup.manage", `/admin/classes/${classId}`);
  const [cls, person] = await Promise.all([
    prisma.courseClass.findUnique({ where: { id: classId }, include: { course: true, intake: true } }),
    prisma.user.findUnique({ where: { id: String(form.get("userId") ?? "") } }),
  ]);
  if (!cls) back("/admin/classes", "error", "That class no longer exists.");
  // Only people who already hold the role can be assigned, so assigning never grants access by itself.
  if (!person || person.status !== "ACTIVE" || (person.role !== "LECTURER" && person.role !== "FACILITATOR")) {
    back(`/admin/classes/${classId}`, "error", "Choose an active lecturer or study centre facilitator.");
  }
  await prisma.classStaff.upsert({
    where: { classId_userId: { classId, userId: person.id } },
    create: { classId, userId: person.id, role: person.role },
    update: { role: person.role },
  });
  await audit({ actor: user, action: "class.staff_assigned", summary: `${user.name} assigned ${person.name} (${ROLE_LABEL[person.role]}) to ${classLabel(cls)}`, entityType: "class", entityId: classId, meta: { userId: person.id } });
  back(`/admin/classes/${classId}`, "ok", `${person.name} was assigned to this class.`);
}

export async function removeStaffAction(form: FormData) {
  const classId = String(form.get("classId") ?? "");
  const userId = String(form.get("userId") ?? "");
  const user = await requireActor("setup.manage", `/admin/classes/${classId}`);
  const row = await prisma.classStaff.findUnique({ where: { classId_userId: { classId, userId } }, include: { user: true, class: { include: { course: true, intake: true } } } });
  if (!row) back(`/admin/classes/${classId}`, "error", "That person is not assigned to this class.");
  await prisma.classStaff.delete({ where: { classId_userId: { classId, userId } } });
  await audit({ actor: user, action: "class.staff_removed", summary: `${user.name} removed ${row.user.name} from ${classLabel(row.class)}`, entityType: "class", entityId: classId, meta: { userId } });
  back(`/admin/classes/${classId}`, "ok", `${row.user.name} was removed from this class.`);
}

// ---- Applying and changing an enrolment (students) ----

const applySchema = z.object({
  classId: text(60, "Choose a class."),
  county: text(60, "Enter the county you live in."),
  work: optionalText(100),
  note: optionalText(500),
});

export async function applyAction(form: FormData) {
  const user = await requireActor("classes.apply", "/apply");
  const parsed = applySchema.safeParse({ classId: value(form, "classId"), county: value(form, "county"), work: value(form, "work"), note: value(form, "note") });
  if (!parsed.success) back("/apply", "error", firstProblem(parsed.error));
  const { classId, county, work, note } = parsed.data;

  const cls = await prisma.courseClass.findUnique({ where: { id: classId }, include: { course: true, intake: true } });
  if (!cls || cls.status !== "OPEN" || cls.intake.status !== "OPEN") back("/apply", "error", "That class is not taking applications.");
  const [enrolled, pending] = await Promise.all([
    prisma.enrolment.findUnique({ where: { userId_classId: { userId: user.id, classId } } }),
    prisma.approvalRequest.findFirst({ where: { requestedById: user.id, type: "APPLICATION", status: "PENDING", payload: { path: ["classId"], equals: classId } } }),
  ]);
  if (enrolled?.status === "ACTIVE" || enrolled?.status === "COMPLETED") back("/apply", "error", "You are already enrolled in that class.");
  if (pending) back("/apply", "error", "You have already applied to that class. The registrar will review it.");

  const request = await prisma.approvalRequest.create({ data: { type: "APPLICATION", requestedById: user.id, payload: { classId, county, work: work ?? null }, note } });
  await audit({ actor: user, action: "approval.requested", summary: `${user.name} applied to ${classLabel(cls)}`, entityType: "approval", entityId: request.id, meta: { type: "APPLICATION", classId } });
  revalidatePath("/admin");
  back("/apply", "ok", "Your application has been sent. The registrar will review it and you will see the result here.");
}

const changeSchema = z.object({
  enrolmentId: text(60, "Choose a class."),
  change: z.enum(["WITHDRAW", "DEFER"], "Choose to withdraw or defer."),
  note: z.string().trim().min(10, "Give your reason (at least 10 characters).").max(500, "Keep your reason under 500 characters."),
});

export async function requestEnrolmentChangeAction(form: FormData) {
  const user = await requireUser();
  const parsed = changeSchema.safeParse({ enrolmentId: value(form, "enrolmentId"), change: value(form, "change"), note: form.get("note") });
  if (!parsed.success) back("/my-classes", "error", firstProblem(parsed.error));
  const { enrolmentId, change, note } = parsed.data;

  // The enrolment must be the person's own.
  const enrolment = await prisma.enrolment.findFirst({ where: { id: enrolmentId, userId: user.id }, include: { class: { include: { course: true, intake: true } } } });
  if (!enrolment || enrolment.status !== "ACTIVE") back("/my-classes", "error", "That enrolment is not active.");
  const pending = await prisma.approvalRequest.findFirst({ where: { requestedById: user.id, type: "ENROLMENT_CHANGE", status: "PENDING", payload: { path: ["enrolmentId"], equals: enrolmentId } } });
  if (pending) back("/my-classes", "error", "You already have a request waiting for this class.");

  const request = await prisma.approvalRequest.create({ data: { type: "ENROLMENT_CHANGE", requestedById: user.id, payload: { enrolmentId, change, classId: enrolment.classId }, note } });
  await audit({ actor: user, action: "approval.requested", summary: `${user.name} asked to ${change === "DEFER" ? "defer" : "withdraw from"} ${classLabel(enrolment.class)}`, entityType: "approval", entityId: request.id, meta: { type: "ENROLMENT_CHANGE", enrolmentId, change } });
  revalidatePath("/admin");
  back("/my-classes", "ok", "Your request has been sent to the registrar.");
}

// ---- Password reset by an administrator ----

const passwordSchema = z.object({
  userId: text(60, "Choose an account."),
  password: z.string().min(MIN_PASSWORD, `Choose a password of at least ${MIN_PASSWORD} characters.`).max(128, "That password is too long."),
});

export async function resetPasswordAction(form: FormData) {
  const userId = String(form.get("userId") ?? "");
  const returnTo = `/admin/users/${userId}/password`;
  const user = await requireActor("users.resetPassword", "/admin/users");
  const parsed = passwordSchema.safeParse({ userId, password: form.get("password") });
  if (!parsed.success) back(returnTo, "error", firstProblem(parsed.error));
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) back("/admin/users", "error", "That account no longer exists.");
  if (target.id === user.id) back("/admin/users", "error", "Change your own password under Your account.");

  const ctx = await auth.$context;
  await ctx.internalAdapter.updatePassword(userId, await ctx.password.hash(parsed.data.password));
  // Sign the person out everywhere so only the new password works.
  await prisma.session.deleteMany({ where: { userId } });
  await audit({ actor: user, action: "user.password_reset", summary: `${user.name} set a new password for ${target.name}`, entityType: "user", entityId: userId });
  back("/admin/users", "ok", `${target.name} has a new password. Give it to them in person or by phone, and ask them to change it under Your account after signing in.`);
}
