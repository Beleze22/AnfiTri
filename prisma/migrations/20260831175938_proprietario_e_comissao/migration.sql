-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'proprietario';

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "management_fee_percent" DECIMAL(5,2),
ADD COLUMN     "owner_id" TEXT;

-- CreateIndex
CREATE INDEX "properties_owner_id_idx" ON "properties"("owner_id");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
