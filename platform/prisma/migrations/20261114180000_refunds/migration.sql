-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('APPROVED', 'PAID');

-- AlterEnum
ALTER TYPE "ApprovalType" ADD VALUE 'REFUND';

-- AlterEnum
ALTER TYPE "ChargeKind" ADD VALUE 'CREDIT';

-- CreateTable
CREATE TABLE "refund" (
    "id" TEXT NOT NULL,
    "enrolmentId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'APPROVED',
    "approvedByName" TEXT NOT NULL,
    "method" "PaymentMethod",
    "reference" TEXT,
    "paidOn" DATE,
    "paidById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refund_requestId_key" ON "refund"("requestId");

-- CreateIndex
CREATE INDEX "refund_enrolmentId_idx" ON "refund"("enrolmentId");

-- CreateIndex
CREATE INDEX "refund_status_idx" ON "refund"("status");

-- AddForeignKey
ALTER TABLE "refund" ADD CONSTRAINT "refund_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "enrolment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund" ADD CONSTRAINT "refund_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

