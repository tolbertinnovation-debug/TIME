"use server";

import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { back, firstProblem, UserProblem } from "@/lib/action-helpers";
import { studentNumber } from "@/lib/academics";
import { auth } from "@/lib/auth";
import { MIN_PASSWORD } from "@/lib/auth-core";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import {
  APPROVAL_LABEL, REQUESTABLE_ROLES, ROLE_LABEL, ROLES, canDecide, isRole, roleChangeProblem, suspendProblem,
  type ApprovalType, type Role,
} from "@/lib/permissions";
import { requireUser } from "@/lib/session";

// ---- Accounts ----

const signUpSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(100, "That name is too long."),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address, like name@example.com.")),
  phone: z.string().trim().max(30, "That phone number is too long.").optional(),
  password: z.string().min(MIN_PASSWORD, `Choose a password of at least ${MIN_PASSWORD} characters.`).max(128, "That password is too long."),
});

export async function signUpAction(form: FormData) {
  const parsed = signUpSchema.safeParse({
    name: form.get("name"), email: form.get("email"), phone: form.get("phone") || undefined, password: form.get("password"),
  });
  const keep = { name: String(form.get("name") ?? ""), email: String(form.get("email") ?? "") };
  if (!parsed.success) back("/sign-up", "error", firstProblem(parsed.error), keep);

  let problem: string | null = null;
  try {
    await auth.api.signUpEmail({ body: parsed.data });
  } catch (e) {
    problem = e instanceof APIError && e.status === "UNPROCESSABLE_ENTITY"
      ? "An account with that email already exists. Sign in instead."
      : e instanceof APIError ? e.message : "We couldn't create your account. Please try again.";
  }
  if (problem) back("/sign-up", "error", problem, keep);
  redirect("/dashboard");
}

const MAX_FAILED_SIGN_INS = 5;
const LOCK_MINUTES = 10;

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter the email address you registered with.")),
  password: z.string().min(1, "Enter your password."),
});

export async function signInAction(form: FormData) {
  const parsed = signInSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  const keep = { email: String(form.get("email") ?? "") };
  if (!parsed.success) back("/sign-in", "error", firstProblem(parsed.error), keep);

  // Slow down password guessing: after 5 failed tries for one email, wait 10 minutes.
  const { email } = parsed.data;
  const recentFailures = await prisma.auditLog.count({
    where: { action: "auth.sign_in_failed", entityType: "email", entityId: email, createdAt: { gte: new Date(Date.now() - LOCK_MINUTES * 60_000) } },
  });
  if (recentFailures >= MAX_FAILED_SIGN_INS) back("/sign-in", "error", `Too many failed attempts. Wait ${LOCK_MINUTES} minutes and try again.`, keep);

  let problem: string | null = null;
  try {
    await auth.api.signInEmail({ body: parsed.data });
  } catch (e) {
    const suspended = e instanceof APIError && e.status === "FORBIDDEN";
    problem = suspended ? e.message : "That email or password is not correct.";
    if (!suspended) await audit({ actor: null, action: "auth.sign_in_failed", summary: `Failed sign-in for ${email}`, entityType: "email", entityId: email });
  }
  if (problem) back("/sign-in", "error", problem, keep);
  redirect("/dashboard");
}

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/sign-in");
}

// ---- Staff access requests ----

const staffAccessSchema = z.object({
  role: z.enum(REQUESTABLE_ROLES, "Choose the role you are asking for."),
  note: z.string().trim().min(10, "Say briefly who you are and what you will do at TIME (at least 10 characters).").max(500, "Keep your note under 500 characters."),
});

export async function requestStaffAccessAction(form: FormData) {
  const user = await requireUser();
  const parsed = staffAccessSchema.safeParse({ role: form.get("role"), note: form.get("note") });
  if (!parsed.success) back("/account/staff-access", "error", firstProblem(parsed.error));
  const { role, note } = parsed.data;
  if (user.role === role) back("/account/staff-access", "error", `You already have the ${ROLE_LABEL[role]} role.`);

  const pending = await prisma.approvalRequest.findFirst({ where: { requestedById: user.id, type: "STAFF_ACCESS", status: "PENDING" } });
  if (pending) back("/account/staff-access", "error", "You already have a request waiting for a decision.");

  const request = await prisma.approvalRequest.create({ data: { type: "STAFF_ACCESS", requestedById: user.id, payload: { role }, note } });
  await audit({ actor: user, action: "approval.requested", summary: `${user.name} asked for ${ROLE_LABEL[role]} access`, entityType: "approval", entityId: request.id, meta: { type: "STAFF_ACCESS", role } });
  revalidatePath("/admin");
  back("/account/staff-access", "ok", "Your request has been sent. An administrator will review it.");
}

export async function cancelRequestAction(form: FormData) {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const returnTo = { apply: "/apply", classes: "/my-classes" }[String(form.get("from"))] ?? "/account/staff-access";
  const done = await prisma.approvalRequest.updateMany({ where: { id, requestedById: user.id, status: "PENDING" }, data: { status: "CANCELLED" } });
  if (done.count) await audit({ actor: user, action: "approval.cancelled", summary: `${user.name} cancelled their request`, entityType: "approval", entityId: id });
  back(returnTo, done.count ? "ok" : "error", done.count ? "Your request was cancelled." : "That request can no longer be cancelled.");
}

// ---- Deciding approvals ----

const decisionSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(500, "Keep the note under 500 characters.").optional(),
});

export async function decideApprovalAction(form: FormData) {
  const user = await requireUser();
  const parsed = decisionSchema.safeParse({ id: form.get("id"), decision: form.get("decision"), note: form.get("note") || undefined });
  if (!parsed.success) back("/admin/approvals", "error", firstProblem(parsed.error));
  const { id, decision, note } = parsed.data;

  const request = await prisma.approvalRequest.findUnique({ where: { id }, include: { requestedBy: true } });
  if (!request) back("/admin/approvals", "error", "That request no longer exists.");
  const type = request.type as ApprovalType;
  if (!canDecide(user.role, type)) back("/admin/approvals", "error", "You are not allowed to decide this request.");
  if (request.requestedById === user.id) back("/admin/approvals", "error", "You cannot decide your own request.");
  if (decision === "REJECTED" && !note) back("/admin/approvals", "error", "Give a short reason when you reject a request.");

  // The status check inside the update means two people can never decide the same request.
  let applied = false;
  let effect: string | null = null;
  let problem: string | null = null;
  try {
    applied = await prisma.$transaction(async (tx) => {
      const updated = await tx.approvalRequest.updateMany({
        where: { id, status: "PENDING" },
        data: { status: decision, decidedById: user.id, decidedAt: new Date(), decisionNote: note },
      });
      if (!updated.count) return false;
      if (decision === "APPROVED") effect = await applyApproval(tx, type, request.requestedById, request.payload);
      return true;
    });
  } catch (e) {
    if (!(e instanceof UserProblem)) throw e;
    problem = e.message;
  }
  if (problem) back("/admin/approvals", "error", problem);
  if (!applied) back("/admin/approvals", "error", "Someone has already decided that request.");

  const verb = decision === "APPROVED" ? "approved" : "rejected";
  await audit({
    actor: user, action: `approval.${verb}`,
    summary: `${user.name} ${verb} the ${APPROVAL_LABEL[type].toLowerCase()} request from ${request.requestedBy.name}`,
    entityType: "approval", entityId: id, meta: { type, payload: request.payload as Prisma.InputJsonValue, note: note ?? null },
  });
  if (effect) await audit({ actor: user, action: "enrolment.changed", summary: effect, entityType: "user", entityId: request.requestedById });
  revalidatePath("/admin");
  back("/admin/approvals", "ok", `Request ${verb}.`);
}

// What an approval does once it is granted. Runs inside the same transaction as the decision,
// so a request is never marked approved without its effect.
async function applyApproval(tx: Prisma.TransactionClient, type: ApprovalType, requesterId: string, payload: Prisma.JsonValue): Promise<string | null> {
  const data = (payload ?? {}) as Record<string, unknown>;
  if (type === "STAFF_ACCESS") {
    const role = data.role;
    if (!isRole(role) || !(REQUESTABLE_ROLES as readonly Role[]).includes(role)) throw new UserProblem("The request names a role that cannot be granted.");
    await tx.user.update({ where: { id: requesterId }, data: { role } });
    return null;
  }
  if (type === "APPLICATION") {
    const cls = await tx.courseClass.findUnique({
      where: { id: String(data.classId) },
      include: { course: true, intake: true, _count: { select: { enrolments: { where: { status: "ACTIVE" } } } } },
    });
    if (!cls) throw new UserProblem("That class no longer exists.");
    if (cls.capacity !== null && cls._count.enrolments >= cls.capacity) throw new UserProblem("That class is full. Raise its capacity or reject the application.");
    await tx.enrolment.upsert({
      where: { userId_classId: { userId: requesterId, classId: cls.id } },
      create: { userId: requesterId, classId: cls.id },
      update: { status: "ACTIVE" },
    });
    const student = await tx.user.findUniqueOrThrow({ where: { id: requesterId } });
    let number = student.studentNumber;
    if (!number) {
      const [{ n }] = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('student_number_seq') AS n`;
      number = studentNumber(new Date().getUTCFullYear(), Number(n));
    }
    await tx.user.update({ where: { id: requesterId }, data: { studentNumber: number, county: typeof data.county === "string" ? data.county : student.county } });
    return `${student.name} (${number}) was enrolled in ${cls.course.title}, ${cls.intake.name}`;
  }
  if (type === "ENROLMENT_CHANGE") {
    const status = data.change === "DEFER" ? "DEFERRED" : "WITHDRAWN";
    const changed = await tx.enrolment.updateMany({ where: { id: String(data.enrolmentId), userId: requesterId, status: "ACTIVE" }, data: { status } });
    if (!changed.count) throw new UserProblem("That enrolment is no longer active.");
    const student = await tx.user.findUniqueOrThrow({ where: { id: requesterId } });
    return `${student.name}'s enrolment was ${status === "DEFERRED" ? "deferred" : "withdrawn"}`;
  }
  return null;
}

// ---- Managing accounts ----

const activeAdmins = () => prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });

export async function changeRoleAction(form: FormData) {
  const user = await requireUser();
  const targetId = String(form.get("userId") ?? "");
  const newRole = form.get("role");
  const returnTo = "/admin/users";
  if (!isRole(newRole) || !(ROLES as readonly string[]).includes(newRole)) back(returnTo, "error", "Choose a role.");

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target || !isRole(target.role)) back(returnTo, "error", "That account no longer exists.");
  if (target.role === newRole) back(returnTo, "ok", `${target.name} already has that role.`);
  const problem = roleChangeProblem({ actorId: user.id, actorRole: user.role, targetId, targetRole: target.role, newRole, activeAdminCount: await activeAdmins() });
  if (problem) back(returnTo, "error", problem);

  await prisma.user.update({ where: { id: targetId }, data: { role: newRole } });
  await audit({
    actor: user, action: "user.role_changed",
    summary: `${user.name} changed ${target.name} from ${ROLE_LABEL[target.role]} to ${ROLE_LABEL[newRole]}`,
    entityType: "user", entityId: targetId, meta: { from: target.role, to: newRole },
  });
  revalidatePath("/admin");
  back(returnTo, "ok", `${target.name} is now ${ROLE_LABEL[newRole]}.`);
}

export async function setStatusAction(form: FormData) {
  const user = await requireUser();
  const targetId = String(form.get("userId") ?? "");
  const suspend = form.get("status") === "SUSPENDED";
  const returnTo = "/admin/users";

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target || !isRole(target.role)) back(returnTo, "error", "That account no longer exists.");
  const problem = suspendProblem({ actorId: user.id, actorRole: user.role, targetId, targetRole: target.role, activeAdminCount: await activeAdmins() });
  if (problem) back(returnTo, "error", problem);

  await prisma.$transaction([
    prisma.user.update({ where: { id: targetId }, data: { status: suspend ? "SUSPENDED" : "ACTIVE" } }),
    // Suspending signs the person out everywhere straight away.
    ...(suspend ? [prisma.session.deleteMany({ where: { userId: targetId } })] : []),
  ]);
  await audit({
    actor: user, action: suspend ? "user.suspended" : "user.restored",
    summary: `${user.name} ${suspend ? "suspended" : "restored"} the account of ${target.name}`,
    entityType: "user", entityId: targetId,
  });
  revalidatePath("/admin");
  back(returnTo, "ok", `${target.name}'s account is ${suspend ? "suspended" : "active again"}.`);
}
