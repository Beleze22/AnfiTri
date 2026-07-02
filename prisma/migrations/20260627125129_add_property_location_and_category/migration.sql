-- CreateEnum
CREATE TYPE "PropertyCategory" AS ENUM ('praia', 'montanha', 'campo', 'urbano', 'lago', 'outro');

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "category" "PropertyCategory" NOT NULL DEFAULT 'urbano',
ADD COLUMN     "location" TEXT NOT NULL DEFAULT 'São Paulo, SP';
