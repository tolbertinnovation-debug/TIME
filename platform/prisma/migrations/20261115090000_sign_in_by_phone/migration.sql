-- AlterTable
ALTER TABLE "user" ADD COLUMN     "phoneKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "user_phoneKey_key" ON "user"("phoneKey");

