-- AlterTable
ALTER TABLE "enrolment" ADD COLUMN     "evaluatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "course_evaluation" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "teaching" INTEGER NOT NULL,
    "materials" INTEGER NOT NULL,
    "support" INTEGER NOT NULL,
    "overall" INTEGER NOT NULL,
    "wentWell" TEXT,
    "improve" TEXT,

    CONSTRAINT "course_evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_evaluation_classId_idx" ON "course_evaluation"("classId");

-- AddForeignKey
ALTER TABLE "course_evaluation" ADD CONSTRAINT "course_evaluation_classId_fkey" FOREIGN KEY ("classId") REFERENCES "course_class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

