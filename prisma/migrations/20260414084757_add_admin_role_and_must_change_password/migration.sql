-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminRole" VARCHAR(64),
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
