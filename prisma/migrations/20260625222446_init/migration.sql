-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('rascunho', 'publicada', 'pausada');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('airbnb', 'manual', 'site');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pendente', 'confirmado', 'cancelado', 'expirado');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('gestor', 'hospede');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('aberta', 'encerrada');

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "max_guests" INTEGER NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "base_price" DECIMAL(10,2) NOT NULL,
    "airbnb_ical_url" TEXT,
    "status" "PropertyStatus" NOT NULL DEFAULT 'rascunho',

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "is_cover" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "check_in" DATE NOT NULL,
    "check_out" DATE NOT NULL,
    "source" "BookingSource" NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "airbnb_ref" TEXT,
    "expires_at" TIMESTAMP(3),
    "total_price" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_rules" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rule_type" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "multiplier" DECIMAL(4,2) NOT NULL,

    CONSTRAINT "price_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amenities" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,

    CONSTRAINT "amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT,
    "role" "UserRole" NOT NULL,
    "default_expiry_hours" INTEGER,
    "quiet_hours_start" TIME,
    "quiet_hours_end" TIME,
    "grace_period_hours" INTEGER,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'aberta',

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "properties_slug_key" ON "properties"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_airbnb_ref_key" ON "bookings"("airbnb_ref");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_booking_id_key" ON "conversations"("booking_id");

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amenities" ADD CONSTRAINT "amenities_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
