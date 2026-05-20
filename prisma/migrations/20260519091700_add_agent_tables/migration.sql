-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'TOOL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MessageFeedback" AS ENUM ('POSITIVE', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('PENDING_CONTACT', 'NEW', 'CONTACTED', 'RESOLVED', 'DROPPED');

-- CreateEnum
CREATE TYPE "LeadUrgency" AS ENUM ('LOW', 'MED', 'HIGH');

-- CreateEnum
CREATE TYPE "KnowledgeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "AgentSession" (
    "id" TEXT NOT NULL,
    "fingerprintHash" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "tokenBudget" INTEGER NOT NULL DEFAULT 2000,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "parts" JSONB NOT NULL,
    "contentText" TEXT NOT NULL,
    "toolName" TEXT,
    "citations" JSONB,
    "feedback" "MessageFeedback",
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentLead" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "wechatId" TEXT,
    "orderNo" TEXT,
    "reason" TEXT NOT NULL,
    "urgency" "LeadUrgency" NOT NULL DEFAULT 'MED',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "contactedBy" TEXT,
    "contactedAt" TIMESTAMP(3),
    "notes" TEXT,
    "conversationSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentKnowledge" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT[],
    "productId" TEXT,
    "status" "KnowledgeStatus" NOT NULL DEFAULT 'DRAFT',
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "embedding" DOUBLE PRECISION[],

    CONSTRAINT "AgentKnowledge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentSession_expiresAt_idx" ON "AgentSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AgentMessage_sessionId_createdAt_idx" ON "AgentMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentMessage_feedback_idx" ON "AgentMessage"("feedback");

-- CreateIndex
CREATE UNIQUE INDEX "AgentLead_sessionId_key" ON "AgentLead"("sessionId");

-- CreateIndex
CREATE INDEX "AgentLead_status_createdAt_idx" ON "AgentLead"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AgentKnowledge_status_productId_idx" ON "AgentKnowledge"("status", "productId");

-- CreateIndex
CREATE INDEX "AgentKnowledge_tags_idx" ON "AgentKnowledge"("tags");

-- AddForeignKey
ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentLead" ADD CONSTRAINT "AgentLead_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentKnowledge" ADD CONSTRAINT "AgentKnowledge_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentKnowledge" ADD CONSTRAINT "AgentKnowledge_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
