-- CreateTable
CREATE TABLE "SiteSetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "wechatQrUrl" TEXT,
    "wechatId" TEXT,
    "businessHoursStart" INTEGER,
    "businessHoursEnd" INTEGER,
    "businessHoursTimezone" TEXT,
    "businessName" TEXT,
    "businessLicenseNo" TEXT,
    "contactEmail" TEXT,
    "escalateWebhookUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("id")
);
