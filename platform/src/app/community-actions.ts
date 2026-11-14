"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { back, firstProblem } from "@/lib/action-helpers";
import { classLabel } from "@/lib/academics";
import { audit } from "@/lib/audit";
import { classAccess } from "@/lib/class-access";
import { prisma } from "@/lib/db";
import { accessProblem, feeStatusOf } from "@/lib/fees-data";
import { classStaffIds, notify } from "@/lib/notify";
import { can, classCan, SUPPORT_CATEGORIES, SUPPORT_LABEL, supportCategoriesFor, type SupportCategory } from "@/lib/permissions";
import { requireUser, type CurrentUser } from "@/lib/session";

const value = (form: FormData, key: string) => { const v = form.get(key); return typeof v === "string" && v.trim() !== "" ? v : undefined; };
const text = (max: number, message: string) => z.string().trim().min(1, message).max(max, `Keep this under ${max} characters.`);

// ---- Notifications ----

export async function markNotificationsReadAction() {
  const user = await requireUser();
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  // The unread count sits in the page header, which is shared by every page, so refresh it.
  revalidatePath("/", "layout");
  back("/notifications", "ok", "All caught up.");
}

// ---- Class discussion ----

// Who may take part in a class's discussion: its staff, and students who are enrolled with access.
async function discussionMember(user: CurrentUser, classId: string): Promise<"STAFF" | "STUDENT" | null> {
  if (await classAccess(user, classId)) return "STAFF";
  const enrolment = await prisma.enrolment.findUnique({ where: { userId_classId: { userId: user.id, classId } } });
  if (!enrolment || enrolment.status !== "ACTIVE") return null;
  return accessProblem(await feeStatusOf(enrolment.id)) ? null : "STUDENT";
}

export async function postAction(form: FormData) {
  const user = await requireUser();
  const classId = String(form.get("classId") ?? "");
  const returnTo = `/discussion/${classId}`;
  if (!(await discussionMember(user, classId))) back("/dashboard", "error", "You are not part of that class's discussion.");
  const body = z.string().trim().min(2, "Write your message.").max(3000, "Keep your message under 3,000 characters.").safeParse(form.get("body"));
  if (!body.success) back(returnTo, "error", firstProblem(body.error));
  const parentId = value(form, "parentId");
  // A reply must answer a question in this same class, and replies cannot be replied to.
  const parent = parentId ? await prisma.post.findFirst({ where: { id: parentId, classId, parentId: null, hiddenAt: null } }) : null;
  if (parentId && !parent) back(returnTo, "error", "That question is no longer there.");
  const cls = await prisma.courseClass.findUniqueOrThrow({ where: { id: classId }, include: { course: true, intake: true } });

  const post = await prisma.post.create({ data: { classId, authorId: user.id, parentId: parent?.id ?? null, body: body.data } });
  await audit({ actor: user, action: "discussion.posted", summary: `${user.name} ${parent ? "replied in" : "asked a question in"} the discussion for ${classLabel(cls)}`, entityType: "post", entityId: post.id });
  const href = `/discussion/${classId}#post-${parent?.id ?? post.id}`;
  if (parent) await notify(parent.authorId === user.id ? [] : [parent.authorId], { title: `${user.name} replied to your question`, body: body.data, href });
  else await notify((await classStaffIds(classId, "LECTURER")).filter((id) => id !== user.id), { title: `New question in ${cls.course.title}`, body: `${user.name}: ${body.data}`, href });
  back(returnTo, "ok", parent ? "Reply posted." : "Question posted.");
}

export async function hidePostAction(form: FormData) {
  const user = await requireUser();
  const classId = String(form.get("classId") ?? "");
  const returnTo = `/discussion/${classId}`;
  const access = await classAccess(user, classId);
  if (!access || !classCan(access, "discussion.moderate")) back(returnTo, "error", "Only the class lecturer can remove a post.");
  const post = await prisma.post.findFirst({ where: { id: String(form.get("postId") ?? ""), classId, hiddenAt: null }, include: { author: true } });
  if (!post) back(returnTo, "error", "That post is no longer there.");
  await prisma.post.update({ where: { id: post.id }, data: { hiddenAt: new Date() } });
  await audit({ actor: user, action: "discussion.post_removed", summary: `${user.name} removed a post by ${post.author?.name ?? "a removed account"} from a class discussion`, entityType: "post", entityId: post.id, meta: { body: post.body } });
  back(returnTo, "ok", "Post removed.");
}

// ---- Help desk ----

const ticketSchema = z.object({
  category: z.enum(SUPPORT_CATEGORIES, "Choose what your request is about."),
  subject: text(140, "Give your request a short title."),
  body: z.string().trim().min(10, "Describe what you need (at least 10 characters).").max(3000, "Keep your message under 3,000 characters."),
});

async function supportStaffIds(category: SupportCategory): Promise<string[]> {
  const roles = (["ADMIN", "REGISTRAR", "FINANCE"] as const).filter((r) => supportCategoriesFor(r).includes(category));
  return (await prisma.user.findMany({ where: { role: { in: [...roles] }, status: "ACTIVE" }, select: { id: true } })).map((u) => u.id);
}

export async function openTicketAction(form: FormData) {
  const user = await requireUser();
  const parsed = ticketSchema.safeParse({ category: value(form, "category"), subject: value(form, "subject"), body: form.get("body") });
  if (!parsed.success) back("/help", "error", firstProblem(parsed.error));
  const { category, subject, body } = parsed.data;
  const open = await prisma.supportTicket.count({ where: { userId: user.id, status: { not: "CLOSED" } } });
  if (open >= 5) back("/help", "error", "You already have 5 open requests. Please wait for a reply, or close one you no longer need.");

  const ticket = await prisma.supportTicket.create({ data: { userId: user.id, subject, category, messages: { create: { authorId: user.id, body } } } });
  await audit({ actor: user, action: "support.opened", summary: `${user.name} asked for help: ${subject} (${SUPPORT_LABEL[category]})`, entityType: "ticket", entityId: ticket.id });
  await notify((await supportStaffIds(category)).filter((id) => id !== user.id), { title: `Help request: ${subject}`, body: `${user.name}: ${body}`, href: `/help/${ticket.id}` });
  back(`/help/${ticket.id}`, "ok", "Your request has been sent. You will see the reply here.");
}

// The person who opened a request, and the staff who handle its category, may read and reply.
async function ticketFor(user: CurrentUser, id: string) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id }, include: { user: true } });
  if (!ticket) return null;
  const staff = supportCategoriesFor(user.role).includes(ticket.category);
  return ticket.userId === user.id || staff ? { ticket, staff: staff && ticket.userId !== user.id } : null;
}

export async function replyTicketAction(form: FormData) {
  const user = await requireUser();
  const id = String(form.get("ticketId") ?? "");
  const found = await ticketFor(user, id);
  if (!found) back("/help", "error", "That request is not yours to answer.");
  const { ticket, staff } = found;
  const close = form.get("close") === "yes";
  const body = z.string().trim().max(3000, "Keep your message under 3,000 characters.").safeParse(form.get("body") ?? "");
  if (!body.success) back(`/help/${id}`, "error", firstProblem(body.error));
  if (!close && body.data.length < 2) back(`/help/${id}`, "error", "Write your reply.");
  if (ticket.status === "CLOSED" && !body.data) back(`/help/${id}`, "ok", "This request is already closed.");

  const status = close ? "CLOSED" : staff ? "ANSWERED" : "OPEN";
  await prisma.$transaction([
    ...(body.data ? [prisma.supportMessage.create({ data: { ticketId: id, authorId: user.id, body: body.data } })] : []),
    prisma.supportTicket.update({ where: { id }, data: { status } }),
  ]);
  await audit({ actor: user, action: close ? "support.closed" : "support.replied", summary: `${user.name} ${close ? "closed" : "replied to"} the help request "${ticket.subject}"${staff ? ` from ${ticket.user.name}` : ""}`, entityType: "ticket", entityId: id });
  if (staff) await notify(ticket.userId, { title: close ? `Your help request was closed: ${ticket.subject}` : `Reply to your help request: ${ticket.subject}`, body: body.data || "The request was closed.", href: `/help/${id}` });
  else if (body.data) await notify(await supportStaffIds(ticket.category), { title: `${ticket.user.name} replied: ${ticket.subject}`, body: body.data, href: `/help/${id}` });
  back(`/help/${id}`, "ok", close ? "Request closed." : "Reply sent.");
}

// ---- Sponsors ----

async function requireSponsorManager(returnTo: string) {
  const user = await requireUser();
  if (!can(user.role, "sponsors.manage")) back(returnTo, "error", "Your role does not allow that.");
  return user;
}

const sponsorSchema = z.object({ name: text(120, "Enter the sponsor's name."), contact: z.string().trim().max(200, "Keep the contact details under 200 characters.").optional(), notes: z.string().trim().max(500, "Keep the notes under 500 characters.").optional() });

export async function createSponsorAction(form: FormData) {
  const user = await requireSponsorManager("/admin/sponsors");
  const parsed = sponsorSchema.safeParse({ name: value(form, "name"), contact: value(form, "contact"), notes: value(form, "notes") });
  if (!parsed.success) back("/admin/sponsors", "error", firstProblem(parsed.error));
  const sponsor = await prisma.sponsor.create({ data: parsed.data });
  await audit({ actor: user, action: "sponsor.created", summary: `${user.name} added the sponsor ${sponsor.name}`, entityType: "sponsor", entityId: sponsor.id });
  back(`/admin/sponsors/${sponsor.id}`, "ok", "Sponsor added. Now link the students they sponsor.");
}

export async function addSponsorshipAction(form: FormData) {
  const sponsorId = String(form.get("sponsorId") ?? "");
  const returnTo = `/admin/sponsors/${sponsorId}`;
  const user = await requireSponsorManager(returnTo);
  const [sponsor, enrolment] = await Promise.all([
    prisma.sponsor.findUnique({ where: { id: sponsorId } }),
    prisma.enrolment.findUnique({ where: { id: String(form.get("enrolmentId") ?? "") }, include: { user: true, sponsorship: true, class: { include: { course: true, intake: true } } } }),
  ]);
  if (!sponsor || !enrolment) back("/admin/sponsors", "error", "That sponsor or student no longer exists.");
  if (enrolment.sponsorship) back(returnTo, "error", `${enrolment.user.name} already has a sponsor for that class.`);
  await prisma.sponsorship.create({ data: { sponsorId, enrolmentId: enrolment.id } });
  await audit({ actor: user, action: "sponsor.student_linked", summary: `${user.name} recorded ${sponsor.name} as the sponsor of ${enrolment.user.name} for ${classLabel(enrolment.class)}`, entityType: "sponsor", entityId: sponsorId });
  await notify(enrolment.userId, { title: `${sponsor.name} is recorded as your sponsor`, body: "They receive a summary of your progress only if you agree. You can decide on your My classes page.", href: "/my-classes" });
  back(returnTo, "ok", `${enrolment.user.name} is linked. No report can be sent until the student agrees.`);
}

export async function removeSponsorshipAction(form: FormData) {
  const sponsorId = String(form.get("sponsorId") ?? "");
  const returnTo = `/admin/sponsors/${sponsorId}`;
  const user = await requireSponsorManager(returnTo);
  const row = await prisma.sponsorship.findFirst({ where: { id: String(form.get("sponsorshipId") ?? ""), sponsorId }, include: { sponsor: true, enrolment: { include: { user: true } } } });
  if (!row) back(returnTo, "error", "That link no longer exists.");
  await prisma.sponsorship.delete({ where: { id: row.id } });
  await audit({ actor: user, action: "sponsor.student_unlinked", summary: `${user.name} removed ${row.sponsor.name} as the sponsor of ${row.enrolment.user.name}`, entityType: "sponsor", entityId: sponsorId });
  back(returnTo, "ok", "Link removed.");
}

// Staff record consent only when they hold the student's signed form.
export async function recordConsentAction(form: FormData) {
  const sponsorId = String(form.get("sponsorId") ?? "");
  const returnTo = `/admin/sponsors/${sponsorId}`;
  const user = await requireSponsorManager(returnTo);
  if (form.get("signed") !== "on") back(returnTo, "error", "Tick the box to confirm you hold the student's signed consent form.");
  const row = await prisma.sponsorship.findFirst({ where: { id: String(form.get("sponsorshipId") ?? ""), sponsorId }, include: { sponsor: true, enrolment: { include: { user: true } } } });
  if (!row) back(returnTo, "error", "That link no longer exists.");
  await prisma.sponsorship.update({ where: { id: row.id }, data: { consentAt: new Date(), consentBy: user.name } });
  await audit({ actor: user, action: "sponsor.consent_recorded", summary: `${user.name} recorded ${row.enrolment.user.name}'s signed consent to share progress with ${row.sponsor.name}`, entityType: "sponsor", entityId: sponsorId });
  await notify(row.enrolment.userId, { title: "Your consent to share progress was recorded", body: `TIME recorded your signed form allowing a progress summary to go to ${row.sponsor.name}. You can withdraw it at any time on your My classes page.`, href: "/my-classes" });
  back(returnTo, "ok", "Consent recorded.");
}

// The student gives or withdraws consent themselves.
export async function setConsentAction(form: FormData) {
  const user = await requireUser();
  const give = form.get("give") === "yes";
  // The sponsorship must be on the student's own enrolment.
  const row = await prisma.sponsorship.findFirst({ where: { id: String(form.get("sponsorshipId") ?? ""), enrolment: { userId: user.id } }, include: { sponsor: true } });
  if (!row) back("/my-classes", "error", "That sponsorship is not yours.");
  await prisma.sponsorship.update({ where: { id: row.id }, data: give ? { consentAt: new Date(), consentBy: "student" } : { consentAt: null, consentBy: null } });
  await audit({ actor: user, action: give ? "sponsor.consent_given" : "sponsor.consent_withdrawn", summary: `${user.name} ${give ? "agreed to share" : "withdrew consent to share"} a progress summary with ${row.sponsor.name}`, entityType: "sponsor", entityId: row.sponsorId });
  back("/my-classes", "ok", give ? `Thank you. ${row.sponsor.name} can now receive a summary of your progress.` : `Done. ${row.sponsor.name} will no longer receive your progress.`);
}

// Recorded each time a report is produced, so there is a trail of what was shared and when.
export async function logSponsorReportAction(form: FormData) {
  const sponsorId = String(form.get("sponsorId") ?? "");
  const user = await requireSponsorManager(`/admin/sponsors/${sponsorId}`);
  const sponsor = await prisma.sponsor.findUnique({ where: { id: sponsorId }, include: { sponsorships: { where: { consentAt: { not: null } }, include: { enrolment: { include: { user: true } } } } } });
  if (!sponsor) back("/admin/sponsors", "error", "That sponsor no longer exists.");
  if (!sponsor.sponsorships.length) back(`/admin/sponsors/${sponsorId}`, "error", "No student has agreed to share their progress with this sponsor.");
  await audit({ actor: user, action: "sponsor.report_produced", summary: `${user.name} produced a progress report for ${sponsor.name} covering ${sponsor.sponsorships.map((s) => s.enrolment.user.name).join(", ")}`, entityType: "sponsor", entityId: sponsorId });
  back(`/admin/sponsors/${sponsorId}/report`, "ok", "This report has been recorded in the activity log. Print it, or save it as a PDF, to send to the sponsor.");
}
