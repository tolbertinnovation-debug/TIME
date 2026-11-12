-- CreateEnum
CREATE TYPE "AssessmentCategory" AS ENUM ('CONTINUOUS', 'ASSIGNMENT', 'MIDTERM', 'FINAL');

-- CreateEnum
CREATE TYPE "AssessmentKind" AS ENUM ('WRITTEN', 'QUIZ', 'OFFLINE');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('IN_REVIEW', 'PUBLISHED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApprovalType" ADD VALUE 'GRADES';
ALTER TYPE "ApprovalType" ADD VALUE 'GRADE_APPEAL';

-- CreateTable
CREATE TABLE "assessment" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "AssessmentCategory" NOT NULL,
    "kind" "AssessmentKind" NOT NULL,
    "instructions" TEXT NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "dueAt" TIMESTAMP(3),
    "timeLimitMinutes" INTEGER,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "options" TEXT[],
    "correctIndex" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "enrolmentId" TEXT NOT NULL,
    "text" TEXT,
    "link" TEXT,
    "answers" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "feedback" TEXT,
    "gradedById" TEXT,
    "gradedAt" TIMESTAMP(3),

    CONSTRAINT "submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result" (
    "enrolmentId" TEXT NOT NULL,
    "continuous" DOUBLE PRECISION NOT NULL,
    "assignments" DOUBLE PRECISION NOT NULL,
    "midterm" DOUBLE PRECISION NOT NULL,
    "final" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "status" "ResultStatus" NOT NULL DEFAULT 'IN_REVIEW',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "result_pkey" PRIMARY KEY ("enrolmentId")
);

-- CreateIndex
CREATE INDEX "assessment_classId_idx" ON "assessment"("classId");

-- CreateIndex
CREATE INDEX "question_assessmentId_sort_idx" ON "question"("assessmentId", "sort");

-- CreateIndex
CREATE INDEX "submission_enrolmentId_idx" ON "submission"("enrolmentId");

-- CreateIndex
CREATE UNIQUE INDEX "submission_assessmentId_enrolmentId_key" ON "submission"("assessmentId", "enrolmentId");

-- AddForeignKey
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "course_class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question" ADD CONSTRAINT "question_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission" ADD CONSTRAINT "submission_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission" ADD CONSTRAINT "submission_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "enrolment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission" ADD CONSTRAINT "submission_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result" ADD CONSTRAINT "result_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "enrolment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

