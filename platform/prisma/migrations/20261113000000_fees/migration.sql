-- CreateEnum
CREATE TYPE "ChargeKind" AS ENUM ('TUITION', 'REGISTRATION', 'EXAM', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MOBILE_MONEY', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('SUBMITTED', 'CONFIRMED', 'REJECTED');

-- AlterEnum
ALTER TYPE "ApprovalType" ADD VALUE 'PAYMENT_ARRANGEMENT';

-- AlterTable
ALTER TABLE "enrolment" ADD COLUMN     "arrangementUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "charge" (
    "id" TEXT NOT NULL,
    "enrolmentId" TEXT NOT NULL,
    "kind" "ChargeKind" NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "enrolmentId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT NOT NULL,
    "paidOn" DATE NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedById" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "receiptNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "charge_enrolmentId_idx" ON "charge"("enrolmentId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_receiptNumber_key" ON "payment"("receiptNumber");

-- CreateIndex
CREATE INDEX "payment_enrolmentId_idx" ON "payment"("enrolmentId");

-- CreateIndex
CREATE INDEX "payment_status_createdAt_idx" ON "payment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "payment_method_reference_idx" ON "payment"("method", "reference");

-- AddForeignKey
ALTER TABLE "charge" ADD CONSTRAINT "charge_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "enrolment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "enrolment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Receipt numbers come from a sequence so no two receipts share a number.
CREATE SEQUENCE "receipt_number_seq" START 1;
