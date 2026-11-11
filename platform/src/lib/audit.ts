import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

type Actor = { id: string; name: string; email: string } | null;

// Record one line in the activity log. Call this for every sign-in and every change that matters.
export async function audit(entry: {
  actor: Actor;
  action: string;
  summary: string;
  entityType?: string;
  entityId?: string;
  meta?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: entry.actor?.id ?? null,
      actorLabel: entry.actor ? `${entry.actor.name} <${entry.actor.email}>` : "System",
      action: entry.action,
      summary: entry.summary,
      entityType: entry.entityType,
      entityId: entry.entityId,
      meta: entry.meta,
    },
  });
}
