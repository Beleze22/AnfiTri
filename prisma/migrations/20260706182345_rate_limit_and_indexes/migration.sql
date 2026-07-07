-- CreateTable
CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "amenities_property_id_idx" ON "amenities"("property_id");

-- CreateIndex
CREATE INDEX "bookings_property_id_status_idx" ON "bookings"("property_id", "status");

-- CreateIndex
CREATE INDEX "bookings_user_id_idx" ON "bookings"("user_id");

-- CreateIndex
CREATE INDEX "magic_link_tokens_user_id_idx" ON "magic_link_tokens"("user_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_read_idx" ON "messages"("conversation_id", "read");

-- CreateIndex
CREATE INDEX "photos_property_id_idx" ON "photos"("property_id");

-- CreateIndex
CREATE INDEX "price_rules_property_id_idx" ON "price_rules"("property_id");
