-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApprovalType" ADD VALUE 'CERTIFICATE_VERIFY';
ALTER TYPE "ApprovalType" ADD VALUE 'CERTIFICATE_ISSUE';

-- AlterEnum
ALTER TYPE "ClassStatus" ADD VALUE 'ENDED';

-- AlterTable
ALTER TABLE "course_class" ADD COLUMN     "endedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "certificate" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "enrolmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "courseTitle" TEXT NOT NULL,
    "wording" TEXT NOT NULL,
    "awardedOn" DATE NOT NULL,
    "issuedByName" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "certificate_number_key" ON "certificate"("number");

-- CreateIndex
CREATE UNIQUE INDEX "certificate_enrolmentId_key" ON "certificate"("enrolmentId");

-- CreateIndex
CREATE INDEX "certificate_userId_idx" ON "certificate"("userId");

-- AddForeignKey
ALTER TABLE "certificate" ADD CONSTRAINT "certificate_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "enrolment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate" ADD CONSTRAINT "certificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

