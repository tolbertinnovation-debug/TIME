-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('CHOICE', 'TRUE_FALSE', 'SHORT');

-- AlterTable
ALTER TABLE "question" ADD COLUMN     "accepted" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "type" "QuestionType" NOT NULL DEFAULT 'CHOICE';

