import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can, isRole, seesApprovals, type Capability, type Role } from "@/lib/permissions";

export type CurrentUser = { id: string; name: string; email: string; phone: string | null; role: Role };

// The signed-in person, read fresh from the database so a role change or suspension applies at once.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.status !== "ACTIVE" || !isRole(user.role)) return null;
  return { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function requireCapability(capability: Capability): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.role, capability)) redirect("/dashboard?notice=not-allowed");
  return user;
}

// The approvals inbox is open to anyone who decides at least one kind of request.
export async function requireApprovalsAccess(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!seesApprovals(user.role)) redirect("/dashboard?notice=not-allowed");
  return user;
}
