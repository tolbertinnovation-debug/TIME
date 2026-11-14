import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { feeStatusOf } from "@/lib/fees-data";
import { classCan, type ClassAccess, type ClassTask } from "@/lib/permissions";
import { requireUser, type CurrentUser } from "@/lib/session";

// How the signed-in person may work with a class: as its lecturer, its facilitator,
// or as an administrator stepping in. Anyone else gets "not found".
export async function classAccess(user: CurrentUser, classId: string): Promise<ClassAccess | null> {
  if (user.role === "ADMIN") return "ADMIN";
  if (user.role !== "LECTURER" && user.role !== "FACILITATOR") return null;
  const row = await prisma.classStaff.findUnique({ where: { classId_userId: { classId, userId: user.id } } });
  // The assignment only counts while the person still holds the matching role.
  return row && row.role === user.role ? row.role : null;
}

export async function requireClassStaff(classId: string, task?: ClassTask) {
  const user = await requireUser();
  const access = await classAccess(user, classId);
  if (!access || (task && !classCan(access, task))) notFound();
  const cls = await prisma.courseClass.findUnique({ where: { id: classId }, include: { course: true, intake: true, studyCentre: true } });
  if (!cls) notFound();
  return { user, access, cls };
}

// A student may open a class only while they are enrolled in it (or have completed it).
export async function requireEnrolment(classId: string) {
  const user = await requireUser();
  const enrolment = await prisma.enrolment.findUnique({
    where: { userId_classId: { userId: user.id, classId } },
    include: { class: { include: { course: true, intake: true, studyCentre: true } } },
  });
  if (!enrolment || (enrolment.status !== "ACTIVE" && enrolment.status !== "COMPLETED")) notFound();
  // Fees: the class opens with the first confirmed payment and pauses if the balance is overdue.
  if (!(await feeStatusOf(enrolment.id)).hasAccess) redirect("/fees?notice=paused");
  return { user, enrolment, cls: enrolment.class };
}
