import { randomInt } from "node:crypto";
import { UserProblem } from "@/lib/action-helpers";
import { certificateKind, certificateNumber, eligibility, makeCode, nextNumber } from "@/lib/certificate";
import { prisma } from "@/lib/db";
import { formatUsd } from "@/lib/fees";
import { feeStatusOf } from "@/lib/fees-data";
import type { Prisma } from "@/generated/prisma/client";

// Everything needed to decide whether an enrolment has earned a certificate.
export async function certificateStanding(enrolmentId: string) {
  const enrolment = await prisma.enrolment.findUnique({
    where: { id: enrolmentId },
    include: { user: true, result: true, certificate: true, class: { include: { course: true, intake: true } } },
  });
  if (!enrolment) return null;
  const fees = await feeStatusOf(enrolment.id);
  const published = enrolment.result?.status === "PUBLISHED" ? enrolment.result : null;
  const { checks, eligible } = eligibility({ classEnded: enrolment.class.status === "ENDED", result: published, feeState: fees.state, balanceText: formatUsd(fees.balanceCents) });
  return { enrolment, checks, eligible };
}

// Stops an approval if the student no longer qualifies (for example, fees were charged since they asked).
export async function assertStillEligible(enrolmentId: string, requesterId: string) {
  const standing = await certificateStanding(enrolmentId);
  if (!standing || standing.enrolment.userId !== requesterId) throw new UserProblem("That enrolment no longer exists.");
  if (standing.enrolment.certificate) throw new UserProblem("A certificate has already been issued for this class.");
  if (!standing.eligible) throw new UserProblem("This student no longer qualifies for the certificate. Open their record to see what is missing.");
  return standing;
}

export const lastPaperKey = (prefix: string) => `certificate.lastPaper.${prefix}`;

// Issues the certificate inside the approval's transaction. The lock makes two issues of the
// same kind wait for each other, so two certificates can never get the same number.
export async function issueCertificate(tx: Prisma.TransactionClient, standing: NonNullable<Awaited<ReturnType<typeof certificateStanding>>>, issuedByName: string) {
  const { enrolment } = standing;
  const kind = certificateKind(enrolment.class.course.programId);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`certificate:${kind.prefix}`}))`;
  const [issued, setting] = await Promise.all([
    tx.certificate.findMany({ where: { number: { startsWith: `${kind.prefix}-` } }, select: { number: true } }),
    tx.setting.findUnique({ where: { key: lastPaperKey(kind.prefix) } }),
  ]);
  const n = nextNumber(issued.map((c) => Number(c.number.slice(kind.prefix.length + 1))).filter(Number.isFinite), Number(setting?.value) || 0);
  const now = new Date();
  return tx.certificate.create({
    data: {
      number: certificateNumber(kind.prefix, n), code: makeCode(randomInt), enrolmentId: enrolment.id, userId: enrolment.userId,
      holderName: enrolment.user.name, title: kind.title, field: kind.field(enrolment.class.course.title), courseTitle: enrolment.class.course.title,
      wording: kind.wording, awardedOn: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())), issuedByName,
    },
  });
}
