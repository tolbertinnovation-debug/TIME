-- CreateEnum
CREATE TYPE "IntakeStatus" AS ENUM ('PLANNED', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "Track" AS ENUM ('WEEKDAY', 'SATURDAY');

-- CreateEnum
CREATE TYPE "ClassStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ClassStaffRole" AS ENUM ('LECTURER', 'FACILITATOR');

-- CreateEnum
CREATE TYPE "EnrolmentStatus" AS ENUM ('ACTIVE', 'WITHDRAWN', 'DEFERRED', 'COMPLETED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApprovalType" ADD VALUE 'APPLICATION';
ALTER TYPE "ApprovalType" ADD VALUE 'ENROLMENT_CHANGE';

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "county" TEXT,
ADD COLUMN     "studentNumber" TEXT;

-- CreateTable
CREATE TABLE "intake" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "registerBy" DATE,
    "status" "IntakeStatus" NOT NULL DEFAULT 'PLANNED',

    CONSTRAINT "intake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_centre" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "study_centre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_class" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "intakeId" TEXT NOT NULL,
    "track" "Track" NOT NULL,
    "mode" "DeliveryMode" NOT NULL,
    "studyCentreId" TEXT,
    "capacity" INTEGER,
    "status" "ClassStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_staff" (
    "classId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ClassStaffRole" NOT NULL,

    CONSTRAINT "class_staff_pkey" PRIMARY KEY ("classId","userId")
);

-- CreateTable
CREATE TABLE "enrolment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "status" "EnrolmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrolment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "intake_name_key" ON "intake"("name");

-- CreateIndex
CREATE UNIQUE INDEX "study_centre_name_key" ON "study_centre"("name");

-- CreateIndex
CREATE INDEX "course_class_intakeId_idx" ON "course_class"("intakeId");

-- CreateIndex
CREATE UNIQUE INDEX "course_class_courseId_intakeId_track_key" ON "course_class"("courseId", "intakeId", "track");

-- CreateIndex
CREATE INDEX "class_staff_userId_idx" ON "class_staff"("userId");

-- CreateIndex
CREATE INDEX "enrolment_classId_status_idx" ON "enrolment"("classId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "enrolment_userId_classId_key" ON "enrolment"("userId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "user_studentNumber_key" ON "user"("studentNumber");

-- AddForeignKey
ALTER TABLE "course_class" ADD CONSTRAINT "course_class_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_class" ADD CONSTRAINT "course_class_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "intake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_class" ADD CONSTRAINT "course_class_studyCentreId_fkey" FOREIGN KEY ("studyCentreId") REFERENCES "study_centre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_staff" ADD CONSTRAINT "class_staff_classId_fkey" FOREIGN KEY ("classId") REFERENCES "course_class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_staff" ADD CONSTRAINT "class_staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrolment" ADD CONSTRAINT "enrolment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrolment" ADD CONSTRAINT "enrolment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "course_class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Student numbers come from a sequence so two enrolments can never get the same one.
CREATE SEQUENCE "student_number_seq" START 1;
