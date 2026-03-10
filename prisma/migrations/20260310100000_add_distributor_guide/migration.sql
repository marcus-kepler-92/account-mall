-- CreateTable
CREATE TABLE "DistributorGuide" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "tagId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorGuide_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DistributorGuide_status_sortOrder_idx" ON "DistributorGuide"("status", "sortOrder");

-- AddForeignKey
ALTER TABLE "DistributorGuide" ADD CONSTRAINT "DistributorGuide_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;
