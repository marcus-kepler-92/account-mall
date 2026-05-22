-- CreateTable
CREATE TABLE "AdminNotificationDismissal" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "sourceKey" VARCHAR(32) NOT NULL,
    "itemId" VARCHAR(64) NOT NULL,
    "fingerprint" VARCHAR(128) NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNotificationDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminNotificationDismissal_adminId_sourceKey_itemId_key" ON "AdminNotificationDismissal"("adminId", "sourceKey", "itemId");

-- AddForeignKey
ALTER TABLE "AdminNotificationDismissal" ADD CONSTRAINT "AdminNotificationDismissal_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
