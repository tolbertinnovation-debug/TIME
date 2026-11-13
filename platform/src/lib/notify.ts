import { prisma } from "@/lib/db";

type Message = { title: string; body: string; href?: string };

// Tells people something happened. Today this shows inside the platform; email and SMS
// will be sent from this same function once TIME has chosen providers.
export async function notify(userIds: string | (string | null | undefined)[], message: Message) {
  const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).filter((id): id is string => !!id))];
  if (!ids.length) return;
  await prisma.notification.createMany({ data: ids.map((userId) => ({ userId, title: message.title.slice(0, 140), body: message.body.slice(0, 500), href: message.href ?? null })) });
}

// Everyone actively enrolled in a class.
export async function classStudentIds(classId: string): Promise<string[]> {
  return (await prisma.enrolment.findMany({ where: { classId, status: "ACTIVE" }, select: { userId: true } })).map((e) => e.userId);
}

// The lecturers and facilitators assigned to a class.
export async function classStaffIds(classId: string, role?: "LECTURER" | "FACILITATOR"): Promise<string[]> {
  return (await prisma.classStaff.findMany({ where: { classId, ...(role ? { role } : {}) }, select: { userId: true } })).map((s) => s.userId);
}
