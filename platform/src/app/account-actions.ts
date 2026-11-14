"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { z } from "zod";
import { back, firstProblem } from "@/lib/action-helpers";
import { auth } from "@/lib/auth";
import { MIN_PASSWORD } from "@/lib/auth-core";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

const PAGE = "/account/settings";
const MAX_WRONG = 5;
const LOCK_MINUTES = 10;

const passwordSchema = z.object({
  current: z.string().min(1, "Enter your current password."),
  next: z.string().min(MIN_PASSWORD, `Choose a new password of at least ${MIN_PASSWORD} characters.`).max(128, "That password is too long."),
  repeat: z.string(),
}).refine((d) => d.next === d.repeat, "The two new passwords are not the same.").refine((d) => d.next !== d.current, "Your new password must be different from your current one.");

// A signed-in person changes their own password. Every other device is signed out.
export async function changePasswordAction(form: FormData) {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse({ current: form.get("current") ?? "", next: form.get("next") ?? "", repeat: form.get("repeat") ?? "" });
  if (!parsed.success) back(PAGE, "error", firstProblem(parsed.error));

  // Someone using an unattended, signed-in phone must not be able to guess the current password.
  const wrong = await prisma.auditLog.count({ where: { action: "auth.password_change_failed", actorId: user.id, createdAt: { gte: new Date(Date.now() - LOCK_MINUTES * 60_000) } } });
  if (wrong >= MAX_WRONG) back(PAGE, "error", `Too many wrong passwords. Wait ${LOCK_MINUTES} minutes and try again.`);

  let problem: string | null = null;
  try {
    await auth.api.changePassword({ body: { currentPassword: parsed.data.current, newPassword: parsed.data.next, revokeOtherSessions: true }, headers: await headers() });
  } catch (e) {
    const code = e instanceof APIError ? String((e.body as { code?: unknown } | undefined)?.code ?? "") : "";
    if (code === "INVALID_PASSWORD") {
      await audit({ actor: user, action: "auth.password_change_failed", summary: `${user.name} entered a wrong current password while changing their password`, entityType: "user", entityId: user.id });
      problem = "Your current password is not correct.";
    } else if (code === "SESSION_NOT_FRESH") {
      problem = "For your safety, sign out and sign in again, then change your password.";
    } else {
      problem = "Your password could not be changed. Please try again.";
    }
  }
  if (problem) back(PAGE, "error", problem);
  await audit({ actor: user, action: "auth.password_changed", summary: `${user.name} changed their password`, entityType: "user", entityId: user.id });
  back(PAGE, "ok", "Your password has been changed. You were signed out on every other device.");
}

const phoneSchema = z.string().trim().max(30, "That phone number is too long.")
  .refine((v) => v === "" || /^\+?[0-9 ()-]{7,}$/.test(v), "Enter a phone number using digits, for example 0777 123 456 or +231 777 123 456.");

// A person updates the phone number TIME can reach them on. Names are changed by the Registrar, because they appear on certificates.
export async function updatePhoneAction(form: FormData) {
  const user = await requireUser();
  const parsed = phoneSchema.safeParse(String(form.get("phone") ?? ""));
  if (!parsed.success) back(PAGE, "error", firstProblem(parsed.error));
  const phone = parsed.data || null;
  if (phone === user.phone) back(PAGE, "ok", "Nothing changed.");
  await prisma.user.update({ where: { id: user.id }, data: { phone } });
  await audit({ actor: user, action: "user.phone_changed", summary: `${user.name} ${phone ? "updated their phone number" : "removed their phone number"}`, entityType: "user", entityId: user.id });
  back(PAGE, "ok", phone ? "Your phone number has been saved." : "Your phone number has been removed.");
}
