"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { back, firstProblem } from "@/lib/action-helpers";
import { classLabel } from "@/lib/academics";
import { audit } from "@/lib/audit";
import { normaliseCode, normaliseNumber, PREFIXES } from "@/lib/certificate";
import { certificateStanding, lastPaperKey } from "@/lib/certificate-data";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

// ---- The administration ends a class, which lets students who qualify request their certificate ----

export async function endClassAction(form: FormData) {
  const id = String(form.get("id") ?? "");
  const returnTo = `/admin/classes/${id}`;
  const user = await requireUser();
  if (!can(user.role, "setup.manage")) back(returnTo, "error", "Your role does not allow that.");
  const reopen = form.get("reopen") === "yes";
  const cls = await prisma.courseClass.findUnique({ where: { id }, include: { course: true, intake: true } });
  if (!cls) back("/admin/classes", "error", "That class no longer exists.");
  if (reopen ? cls.status !== "ENDED" : cls.status === "ENDED") back(returnTo, "ok", "Nothing changed.");

  await prisma.courseClass.update({ where: { id }, data: reopen ? { status: "CLOSED", endedAt: null } : { status: "ENDED", endedAt: new Date() } });
  await audit({ actor: user, action: reopen ? "class.reopened" : "class.ended", summary: `${user.name} ${reopen ? "reopened" : "ended"} the class ${classLabel(cls)}`, entityType: "class", entityId: id });
  back(returnTo, "ok", reopen ? "The class is running again. Certificates cannot be requested until it is ended." : "The class has ended. Students who passed and have cleared their fees can now request their certificate.");
}

// ---- A student requests their certificate ----

export async function requestCertificateAction(form: FormData) {
  const user = await requireUser();
  const enrolmentId = String(form.get("enrolmentId") ?? "");
  const standing = await certificateStanding(enrolmentId);
  // The enrolment must be the student's own.
  if (!standing || standing.enrolment.userId !== user.id) back("/certificates", "error", "Choose one of your own classes.");
  if (standing.enrolment.certificate) back("/certificates", "error", "Your certificate for this class has already been issued.");
  if (!standing.eligible) back("/certificates", "error", "You cannot request this certificate yet. See what is still needed below.");
  const pending = await prisma.approvalRequest.findFirst({
    where: { requestedById: user.id, type: { in: ["CERTIFICATE_VERIFY", "CERTIFICATE_ISSUE"] }, status: "PENDING", payload: { path: ["enrolmentId"], equals: enrolmentId } },
  });
  if (pending) back("/certificates", "error", "You have already requested this certificate. It is being processed.");

  const cls = standing.enrolment.class;
  const request = await prisma.approvalRequest.create({ data: { type: "CERTIFICATE_VERIFY", requestedById: user.id, payload: { enrolmentId, classId: cls.id, total: standing.enrolment.result!.total } } });
  await audit({ actor: user, action: "approval.requested", summary: `${user.name} requested their certificate for ${classLabel(cls)}`, entityType: "approval", entityId: request.id, meta: { type: "CERTIFICATE_VERIFY", enrolmentId } });
  revalidatePath("/admin");
  back("/certificates", "ok", "Your request has been sent. The registrar checks your record, then academic leadership approves it.");
}

// ---- Revoking, and the numbering setting ----

export async function revokeCertificateAction(form: FormData) {
  const user = await requireUser();
  if (!can(user.role, "certificates.revoke")) back("/admin/certificates", "error", "Your role does not allow that.");
  const id = String(form.get("certificateId") ?? "");
  const reason = z.string().trim().min(10, "Give the reason for revoking this certificate (at least 10 characters).").max(500, "Keep the reason under 500 characters.").safeParse(form.get("reason"));
  if (!reason.success) back("/admin/certificates", "error", firstProblem(reason.error));
  const done = await prisma.certificate.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: reason.data } });
  if (!done.count) back("/admin/certificates", "error", "That certificate is already revoked or no longer exists.");
  const cert = await prisma.certificate.findUniqueOrThrow({ where: { id } });
  await audit({ actor: user, action: "certificate.revoked", summary: `${user.name} revoked certificate ${cert.number} (${cert.holderName}). Reason: ${reason.data}`, entityType: "certificate", entityId: id });
  back("/admin/certificates", "ok", `Certificate ${cert.number} is revoked. Anyone who checks it will see that.`);
}

export async function saveNumberingAction(form: FormData) {
  const user = await requireUser();
  if (!can(user.role, "certificates.numbering")) back("/admin/certificates", "error", "Your role does not allow that.");
  const values: Record<string, number> = {};
  for (const prefix of PREFIXES) {
    const n = z.coerce.number().int().min(0).max(999999).safeParse(form.get(`last-${prefix}`) || "0");
    if (!n.success) back("/admin/certificates", "error", `Enter a whole number for ${prefix}, or 0 if none were issued on paper.`);
    values[prefix] = n.data;
  }
  await prisma.$transaction(PREFIXES.map((p) => prisma.setting.upsert({ where: { key: lastPaperKey(p) }, create: { key: lastPaperKey(p), value: String(values[p]) }, update: { value: String(values[p]) } })));
  await audit({ actor: user, action: "setting.certificate_numbering", summary: `${user.name} set the last paper certificate numbers`, entityType: "setting", meta: values });
  back("/admin/certificates", "ok", "Saved. New certificates continue from these numbers.");
}

// ---- Anyone can check a certificate: no sign-in needed ----

export async function verifyCertificateAction(form: FormData) {
  const number = normaliseNumber(String(form.get("number") ?? "")).slice(0, 20);
  const code = normaliseCode(String(form.get("code") ?? "")).slice(0, 12);
  redirect(`/verify?${new URLSearchParams({ number, code })}`);
}
