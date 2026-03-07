-- CreateTable
CREATE TABLE "AutomationTaskLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "itemId" TEXT,
    "level" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationTaskLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationTaskLog_taskId_createdAt_idx" ON "AutomationTaskLog"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "AutomationTaskLog_itemId_idx" ON "AutomationTaskLog"("itemId");

-- AddForeignKey
ALTER TABLE "AutomationTaskLog" ADD CONSTRAINT "AutomationTaskLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "AutomationTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationTaskLog" ADD CONSTRAINT "AutomationTaskLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AutomationTaskItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
