-- DropIndex
DROP INDEX "AgentKnowledge_tags_idx";

-- AlterTable
ALTER TABLE "AgentKnowledge" ALTER COLUMN "embedding" SET DEFAULT ARRAY[]::DOUBLE PRECISION[];

-- CreateIndex
CREATE INDEX "AgentKnowledge_tags_idx" ON "AgentKnowledge" USING GIN ("tags");
