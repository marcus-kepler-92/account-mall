-- DropForeignKey
ALTER TABLE "AgentKnowledge" DROP CONSTRAINT "AgentKnowledge_productId_fkey";

-- DropIndex
DROP INDEX "AgentKnowledge_status_productId_idx";

-- AlterTable
ALTER TABLE "AgentKnowledge" DROP COLUMN "productId";

-- CreateIndex
CREATE INDEX "AgentKnowledge_status_idx" ON "AgentKnowledge"("status");
