/*
  Warnings:

  - You are about to drop the column `hasSwitchedAccount` on the `Order` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Order" DROP COLUMN "hasSwitchedAccount",
ADD COLUMN     "switchAccountCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "accountSwitchLimit" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "allowAccountSwitch" BOOLEAN NOT NULL DEFAULT true;
