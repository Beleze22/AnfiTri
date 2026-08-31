-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "net_amount" DECIMAL(10,2),
ADD COLUMN     "platform_fee" DECIMAL(10,2);
