-- Commission: add level and sourceDistributorId fields
ALTER TABLE "Commission" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Commission" ADD COLUMN "sourceDistributorId" TEXT;

-- Commission: add indexes for new fields
CREATE INDEX "Commission_distributorId_level_idx" ON "Commission"("distributorId", "level");
CREATE INDEX "Commission_sourceDistributorId_idx" ON "Commission"("sourceDistributorId");

-- DistributorInvitation: new table for invite-based registration
CREATE TABLE "DistributorInvitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DistributorInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DistributorInvitation_token_key" ON "DistributorInvitation"("token");
CREATE INDEX "DistributorInvitation_token_idx" ON "DistributorInvitation"("token");
CREATE INDEX "DistributorInvitation_email_idx" ON "DistributorInvitation"("email");

ALTER TABLE "DistributorInvitation" ADD CONSTRAINT "DistributorInvitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
