-- Add ip column with default for existing rows, then backfill so (productId, ip) is unique
ALTER TABLE "RestockSubscription" ADD COLUMN "ip" TEXT NOT NULL DEFAULT 'unknown';

UPDATE "RestockSubscription" SET "ip" = 'legacy-' || "id" WHERE "ip" = 'unknown';

ALTER TABLE "RestockSubscription" ALTER COLUMN "ip" DROP DEFAULT;

-- Switch unique from (productId, email) to (productId, ip)
DROP INDEX IF EXISTS "RestockSubscription_productId_email_key";

CREATE UNIQUE INDEX "RestockSubscription_productId_ip_key" ON "RestockSubscription"("productId", "ip");
