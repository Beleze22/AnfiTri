-- CreateEnum
CREATE TYPE "AlertKind" AS ENUM ('parser_sem_referencia', 'divergencia_airbnb');

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "kind" "AlertKind" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "booking_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alerts_resolved_at_idx" ON "alerts"("resolved_at");

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
