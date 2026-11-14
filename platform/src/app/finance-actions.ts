"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { back, firstProblem, UserProblem } from "@/lib/action-helpers";
import { classLabel } from "@/lib/academics";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { CHARGE_LABEL, creditToClear, formatUsd, METHOD_LABEL, normaliseReference, parseAmount, receiptNumber, refundableCents } from "@/lib/fees";
import { feeStatusOf, refundFigures, refundLockKey, SETTING } from "@/lib/fees-data";
import { notify } from "@/lib/notify";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import type { Prisma } from "@/generated/prisma/client";

const value = (form: FormData, key: string) => { const v = form.get(key); return typeof v === "string" && v.trim() !== "" ? v : undefined; };
const text = (max: number, message: string) => z.string().trim().min(1, message).max(max, `Keep this under ${max} characters.`);

async function requireFinance(returnTo: string) {
  const user = await requireUser();
  if (!can(user.role, "finance.manage")) back(returnTo, "error", "Your role does not allow that.");
  return user;
}

const amount = z.string({ error: "Enter the amount." }).transform((v, ctx) => {
  const cents = parseAmount(v);
  if (cents === null) { ctx.addIssue({ code: "custom", message: "Enter the amount in US dollars, like 40 or 87.50." }); return z.NEVER; }
  return cents;
});

const paymentSchema = z.object({
  enrolmentId: text(60, "Choose the class this payment is for."),
  amountCents: amount,
  method: z.enum(["MOBILE_MONEY", "BANK_TRANSFER"], "Choose Mobile Money or bank transfer."),
  reference: z.string().trim().min(4, "Enter the transaction ID or bank reference (at least 4 characters).").max(60, "That reference is too long.").transform(normaliseReference),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date you paid.").transform((v) => new Date(`${v}T00:00:00Z`)),
});

const readPayment = (form: FormData) => paymentSchema.safeParse({
  enrolmentId: value(form, "enrolmentId"), amountCents: value(form, "amount"), method: value(form, "method"), reference: value(form, "reference") ?? "", paidOn: value(form, "paidOn"),
});

// Saves a payment unless the same transaction has already been reported. The lock makes two
// people sending the same reference at the same moment wait for each other.
async function savePayment(tx: Prisma.TransactionClient, data: Prisma.PaymentUncheckedCreateInput) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${data.method}:${data.reference}`}))`;
  const used = await tx.payment.findFirst({ where: { method: data.method, reference: data.reference, status: { not: "REJECTED" } } });
  if (used) throw new UserProblem("That transaction has already been reported. Each payment can be used only once.");
  return tx.payment.create({ data });
}

async function nextReceipt(tx: Prisma.TransactionClient) {
  const [{ n }] = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('receipt_number_seq') AS n`;
  return receiptNumber(Number(n));
}

// ---- Students ----

export async function reportPaymentAction(form: FormData) {
  const user = await requireUser();
  const parsed = readPayment(form);
  if (!parsed.success) back("/fees", "error", firstProblem(parsed.error));
  const d = parsed.data;
  if (d.paidOn > new Date()) back("/fees", "error", "The payment date cannot be in the future.");
  // The enrolment must be the student's own.
  const enrolment = await prisma.enrolment.findFirst({ where: { id: d.enrolmentId, userId: user.id }, include: { class: { include: { course: true, intake: true } } } });
  if (!enrolment) back("/fees", "error", "Choose one of your own classes.");

  let problem: string | null = null;
  try {
    await prisma.$transaction((tx) => savePayment(tx, { enrolmentId: enrolment.id, amountCents: d.amountCents, method: d.method, reference: d.reference, paidOn: d.paidOn, submittedById: user.id }));
  } catch (e) {
    if (!(e instanceof UserProblem)) throw e;
    problem = e.message;
  }
  if (problem) back("/fees", "error", problem);
  await audit({ actor: user, action: "payment.reported", summary: `${user.name} reported a ${METHOD_LABEL[d.method]} payment of ${formatUsd(d.amountCents)} (${d.reference}) for ${classLabel(enrolment.class)}`, entityType: "enrolment", entityId: enrolment.id });
  revalidatePath("/finance");
  back("/fees", "ok", "Thank you. The finance office will check your payment and confirm it. Your balance changes once it is confirmed.");
}

const arrangementSchema = z.object({
  enrolmentId: text(60, "Choose a class."),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date you can pay by."),
  note: z.string().trim().min(20, "Explain why you need more time (at least 20 characters).").max(1000, "Keep your reason under 1,000 characters."),
});

export async function requestArrangementAction(form: FormData) {
  const user = await requireUser();
  const parsed = arrangementSchema.safeParse({ enrolmentId: value(form, "enrolmentId"), until: value(form, "until"), note: form.get("note") });
  if (!parsed.success) back("/fees", "error", firstProblem(parsed.error));
  const { enrolmentId, until, note } = parsed.data;
  const enrolment = await prisma.enrolment.findFirst({ where: { id: enrolmentId, userId: user.id }, include: { class: { include: { course: true, intake: true } } } });
  if (!enrolment) back("/fees", "error", "Choose one of your own classes.");
  const date = new Date(`${until}T23:59:59Z`);
  const now = new Date();
  if (date <= now) back("/fees", "error", "Choose a date in the future.");
  if (date.getTime() - now.getTime() > 90 * 24 * 60 * 60 * 1000) back("/fees", "error", "Choose a date within the next 90 days.");
  const status = await feeStatusOf(enrolment.id);
  if (status.balanceCents === 0) back("/fees", "error", "You have no balance to pay on that class.");
  const pending = await prisma.approvalRequest.findFirst({ where: { requestedById: user.id, type: "PAYMENT_ARRANGEMENT", status: "PENDING", payload: { path: ["enrolmentId"], equals: enrolmentId } } });
  if (pending) back("/fees", "error", "You already have a request waiting with the finance office.");

  const request = await prisma.approvalRequest.create({ data: { type: "PAYMENT_ARRANGEMENT", requestedById: user.id, payload: { enrolmentId, classId: enrolment.classId, until, balanceCents: status.balanceCents }, note } });
  await audit({ actor: user, action: "approval.requested", summary: `${user.name} asked for until ${until} to pay ${formatUsd(status.balanceCents)} for ${classLabel(enrolment.class)}`, entityType: "approval", entityId: request.id, meta: { type: "PAYMENT_ARRANGEMENT" } });
  revalidatePath("/admin");
  back("/fees", "ok", "Your request has been sent to the finance office.");
}

// ---- Finance ----

export async function confirmPaymentAction(form: FormData) {
  const user = await requireFinance("/finance/payments");
  const id = String(form.get("paymentId") ?? "");
  const payment = await prisma.payment.findUnique({ where: { id }, include: { enrolment: { include: { user: true } } } });
  if (!payment) back("/finance/payments", "error", "That payment no longer exists.");
  // The status check inside the update means a payment can never be confirmed twice.
  const receipt = await prisma.$transaction(async (tx) => {
    const number = await nextReceipt(tx);
    const done = await tx.payment.updateMany({ where: { id, status: "SUBMITTED" }, data: { status: "CONFIRMED", decidedById: user.id, decidedAt: new Date(), receiptNumber: number } });
    return done.count ? number : null;
  });
  if (!receipt) back("/finance/payments", "error", "Someone has already dealt with that payment.");
  await audit({ actor: user, action: "payment.confirmed", summary: `${user.name} confirmed ${payment.enrolment.user.name}'s ${METHOD_LABEL[payment.method]} payment of ${formatUsd(payment.amountCents)} (${payment.reference}). Receipt ${receipt}`, entityType: "payment", entityId: id });
  await notify(payment.enrolment.userId, { title: `Payment confirmed: ${formatUsd(payment.amountCents)}`, body: `Your ${METHOD_LABEL[payment.method]} payment (${payment.reference}) was confirmed. Receipt ${receipt}.`, href: "/fees" });
  back("/finance/payments", "ok", `Confirmed. Receipt ${receipt} was issued to ${payment.enrolment.user.name}.`);
}

export async function rejectPaymentAction(form: FormData) {
  const user = await requireFinance("/finance/payments");
  const id = String(form.get("paymentId") ?? "");
  const reason = z.string().trim().min(5, "Say why the payment is rejected, so the student knows what to fix.").max(500, "Keep the reason under 500 characters.").safeParse(form.get("reason"));
  if (!reason.success) back("/finance/payments", "error", firstProblem(reason.error));
  const payment = await prisma.payment.findUnique({ where: { id }, include: { enrolment: { include: { user: true } } } });
  if (!payment) back("/finance/payments", "error", "That payment no longer exists.");
  const done = await prisma.payment.updateMany({ where: { id, status: "SUBMITTED" }, data: { status: "REJECTED", decidedById: user.id, decidedAt: new Date(), rejectReason: reason.data } });
  if (!done.count) back("/finance/payments", "error", "Someone has already dealt with that payment.");
  await audit({ actor: user, action: "payment.rejected", summary: `${user.name} rejected ${payment.enrolment.user.name}'s reported payment of ${formatUsd(payment.amountCents)} (${payment.reference}). Reason: ${reason.data}`, entityType: "payment", entityId: id });
  await notify(payment.enrolment.userId, { title: `Payment not confirmed: ${formatUsd(payment.amountCents)}`, body: `Your reported payment (${payment.reference}) was rejected. Reason: ${reason.data}`, href: "/fees" });
  back("/finance/payments", "ok", "Payment rejected. The student can see the reason.");
}

// Finance records a payment it has already seen on the statement. It is confirmed at once.
export async function recordPaymentAction(form: FormData) {
  const enrolmentId = String(form.get("enrolmentId") ?? "");
  const returnTo = `/finance/students/${enrolmentId}`;
  const user = await requireFinance(returnTo);
  const parsed = readPayment(form);
  if (!parsed.success) back(returnTo, "error", firstProblem(parsed.error));
  const d = parsed.data;
  if (d.paidOn > new Date()) back(returnTo, "error", "The payment date cannot be in the future.");
  const enrolment = await prisma.enrolment.findUnique({ where: { id: enrolmentId }, include: { user: true } });
  if (!enrolment) back("/finance/students", "error", "That student's enrolment no longer exists.");

  let receipt = "", problem: string | null = null;
  try {
    receipt = await prisma.$transaction(async (tx) => {
      const number = await nextReceipt(tx);
      await savePayment(tx, { enrolmentId, amountCents: d.amountCents, method: d.method, reference: d.reference, paidOn: d.paidOn, status: "CONFIRMED", submittedById: user.id, decidedById: user.id, decidedAt: new Date(), receiptNumber: number });
      return number;
    });
  } catch (e) {
    if (!(e instanceof UserProblem)) throw e;
    problem = e.message;
  }
  if (problem) back(returnTo, "error", problem);
  await audit({ actor: user, action: "payment.recorded", summary: `${user.name} recorded ${enrolment.user.name}'s ${METHOD_LABEL[d.method]} payment of ${formatUsd(d.amountCents)} (${d.reference}). Receipt ${receipt}`, entityType: "enrolment", entityId: enrolmentId });
  await notify(enrolment.userId, { title: `Payment recorded: ${formatUsd(d.amountCents)}`, body: `The finance office recorded your ${METHOD_LABEL[d.method]} payment (${d.reference}). Receipt ${receipt}.`, href: "/fees" });
  back(returnTo, "ok", `Payment recorded. Receipt ${receipt} was issued.`);
}

const chargeSchema = z.object({
  kind: z.enum(["TUITION", "REGISTRATION", "EXAM", "OTHER"], "Choose the kind of charge."),
  description: text(140, "Describe the charge."),
  amountCents: amount,
});

export async function addChargeAction(form: FormData) {
  const enrolmentId = String(form.get("enrolmentId") ?? "");
  const returnTo = `/finance/students/${enrolmentId}`;
  const user = await requireFinance(returnTo);
  const parsed = chargeSchema.safeParse({ kind: value(form, "kind"), description: value(form, "description"), amountCents: value(form, "amount") });
  if (!parsed.success) back(returnTo, "error", firstProblem(parsed.error));
  const enrolment = await prisma.enrolment.findUnique({ where: { id: enrolmentId }, include: { user: true } });
  if (!enrolment) back("/finance/students", "error", "That student's enrolment no longer exists.");
  const charge = await prisma.charge.create({ data: { enrolmentId, ...parsed.data } });
  await audit({ actor: user, action: "fee.charge_added", summary: `${user.name} charged ${enrolment.user.name} ${formatUsd(charge.amountCents)}: ${CHARGE_LABEL[charge.kind]}, ${charge.description}`, entityType: "charge", entityId: charge.id });
  back(returnTo, "ok", "Charge added.");
}

const settingsSchema = z.object({
  mobileMoney: z.string().trim().max(500, "Keep the Mobile Money details under 500 characters."),
  bank: z.string().trim().max(500, "Keep the bank details under 500 characters."),
});

export async function savePaymentDetailsAction(form: FormData) {
  const user = await requireFinance("/finance/settings");
  const parsed = settingsSchema.safeParse({ mobileMoney: form.get("mobileMoney") ?? "", bank: form.get("bank") ?? "" });
  if (!parsed.success) back("/finance/settings", "error", firstProblem(parsed.error));
  await prisma.$transaction([
    prisma.setting.upsert({ where: { key: SETTING.mobileMoney }, create: { key: SETTING.mobileMoney, value: parsed.data.mobileMoney }, update: { value: parsed.data.mobileMoney } }),
    prisma.setting.upsert({ where: { key: SETTING.bank }, create: { key: SETTING.bank, value: parsed.data.bank }, update: { value: parsed.data.bank } }),
  ]);
  // The details are kept in the log so a wrong or malicious change can be traced.
  await audit({ actor: user, action: "setting.payment_details", summary: `${user.name} changed the payment details shown to students`, entityType: "setting", meta: parsed.data });
  back("/finance/settings", "ok", "Payment details saved. Students see them on their Fees page.");
}

// ---- Refunds ----

const refundSchema = z.object({
  amount: z.string().trim(),
  cancelBalance: z.boolean(),
  reason: z.string().trim().min(10, "Say why, in at least a few words. Leadership and the student will read it.").max(500, "Keep the reason under 500 characters."),
});

// Finance asks to pay money back to a student, or to cancel what is left to pay, or both.
// Nothing changes until academic leadership approves it in the approvals inbox.
export async function requestRefundAction(form: FormData) {
  const enrolmentId = String(form.get("enrolmentId") ?? "");
  const returnTo = `/finance/students/${enrolmentId}`;
  const user = await requireFinance(returnTo);
  const parsed = refundSchema.safeParse({ amount: String(form.get("amount") ?? ""), cancelBalance: form.get("cancelBalance") === "yes", reason: form.get("reason") ?? "" });
  if (!parsed.success) back(returnTo, "error", firstProblem(parsed.error));
  const { cancelBalance, reason } = parsed.data;
  const blank = parsed.data.amount === "" || /^0+(\.0+)?$/.test(parsed.data.amount);
  const amountCents = blank ? 0 : parseAmount(parsed.data.amount);
  if (amountCents === null) back(returnTo, "error", "Enter the amount to refund in US dollars, like 40 or 87.50.");
  if (amountCents === 0 && !cancelBalance) back(returnTo, "error", "Enter an amount to refund, or tick the box to cancel what is left to pay.");
  const enrolment = await prisma.enrolment.findUnique({ where: { id: enrolmentId }, include: { user: true, class: { include: { course: true, intake: true } } } });
  if (!enrolment) back("/finance/students", "error", "That student's enrolment no longer exists.");

  let problem: string | null = null, requestId = "", confirmedCents = 0;
  try {
    requestId = await prisma.$transaction(async (tx) => {
      // One refund request at a time per enrolment, so two cannot both use the same money.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${refundLockKey(enrolmentId)}))`;
      const f = await refundFigures(tx, enrolmentId);
      confirmedCents = f.confirmedCents;
      if (f.pendingRequests > 0) throw new UserProblem("A refund for this student is already waiting for approval. Wait for that decision first.");
      const most = refundableCents(f);
      if (amountCents > most) throw new UserProblem(most === 0 ? "Nothing can be refunded: this student has no confirmed payments left to refund." : `At most ${formatUsd(most)} can be refunded: that is what this student has paid and has not had back.`);
      if (cancelBalance && creditToClear({ chargedCents: f.chargedCents, confirmedCents: f.confirmedCents, refundedCents: f.refundedCents + amountCents }) === 0 && amountCents === 0) {
        throw new UserProblem("This student owes nothing, so there is no balance to cancel.");
      }
      const request = await tx.approvalRequest.create({
        data: { type: "REFUND", requestedById: user.id, payload: { enrolmentId, classId: enrolment.classId, studentName: enrolment.user.name, amountCents, cancelBalance, reason, confirmedCents: f.confirmedCents } },
      });
      return request.id;
    });
  } catch (e) {
    if (!(e instanceof UserProblem)) throw e;
    problem = e.message;
  }
  if (problem) back(returnTo, "error", problem);
  const what = [amountCents > 0 && `refund ${formatUsd(amountCents)}`, cancelBalance && "cancel the rest of the balance"].filter(Boolean).join(" and ");
  await audit({ actor: user, action: "approval.requested", summary: `${user.name} asked to ${what} for ${enrolment.user.name} (${classLabel(enrolment.class)}). Reason: ${reason}`, entityType: "approval", entityId: requestId, meta: { type: "REFUND", amountCents, cancelBalance, confirmedCents } });
  revalidatePath("/admin");
  back(returnTo, "ok", "Your request has been sent to academic leadership for approval.");
}

const refundPaidSchema = z.object({
  method: z.enum(["MOBILE_MONEY", "BANK_TRANSFER"], "Choose Mobile Money or bank transfer."),
  reference: z.string().trim().min(4, "Enter the transaction ID or bank reference of the money you sent (at least 4 characters).").max(60, "That reference is too long.").transform(normaliseReference),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date the money was sent.").transform((v) => new Date(`${v}T00:00:00Z`)),
});

// After a refund is approved, Finance sends the money and records how it was sent.
export async function markRefundPaidAction(form: FormData) {
  const user = await requireFinance("/finance/refunds");
  const id = String(form.get("refundId") ?? "");
  const parsed = refundPaidSchema.safeParse({ method: value(form, "method"), reference: value(form, "reference") ?? "", paidOn: value(form, "paidOn") });
  if (!parsed.success) back("/finance/refunds", "error", firstProblem(parsed.error));
  const d = parsed.data;
  if (d.paidOn > new Date()) back("/finance/refunds", "error", "The date cannot be in the future.");
  const refund = await prisma.refund.findUnique({ where: { id }, include: { enrolment: { include: { user: true } } } });
  if (!refund) back("/finance/refunds", "error", "That refund no longer exists.");
  // The status check inside the update means a refund can never be recorded as paid twice.
  const done = await prisma.refund.updateMany({ where: { id, status: "APPROVED" }, data: { status: "PAID", method: d.method, reference: d.reference, paidOn: d.paidOn, paidById: user.id } });
  if (!done.count) back("/finance/refunds", "error", "Someone has already recorded that refund as paid.");
  await audit({ actor: user, action: "fee.refund_paid", summary: `${user.name} paid ${refund.enrolment.user.name} a refund of ${formatUsd(refund.amountCents)} by ${METHOD_LABEL[d.method]} (${d.reference})`, entityType: "refund", entityId: id });
  await notify(refund.enrolment.userId, { title: `Refund sent: ${formatUsd(refund.amountCents)}`, body: `TIME has sent you ${formatUsd(refund.amountCents)} by ${METHOD_LABEL[d.method]} (reference ${d.reference}). Reason: ${refund.reason}`, href: "/fees" });
  back("/finance/refunds", "ok", `Refund to ${refund.enrolment.user.name} recorded as paid.`);
}
