-- AlterTable
ALTER TABLE "alerts" ADD COLUMN     "dedupe_key" TEXT;

-- CreateIndex
CREATE INDEX "alerts_dedupe_key_resolved_at_idx" ON "alerts"("dedupe_key", "resolved_at");
