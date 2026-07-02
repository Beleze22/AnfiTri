-- AlterTable
ALTER TABLE "price_rules" ADD COLUMN     "days_of_week" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
