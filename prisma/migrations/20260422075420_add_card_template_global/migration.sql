-- CreateTable
CREATE TABLE "CardTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CardTemplateToProduct" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CardTemplateToProduct_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "CardTemplate_sortOrder_idx" ON "CardTemplate"("sortOrder");

-- CreateIndex
CREATE INDEX "_CardTemplateToProduct_B_index" ON "_CardTemplateToProduct"("B");

-- AddForeignKey
ALTER TABLE "_CardTemplateToProduct" ADD CONSTRAINT "_CardTemplateToProduct_A_fkey" FOREIGN KEY ("A") REFERENCES "CardTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CardTemplateToProduct" ADD CONSTRAINT "_CardTemplateToProduct_B_fkey" FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
