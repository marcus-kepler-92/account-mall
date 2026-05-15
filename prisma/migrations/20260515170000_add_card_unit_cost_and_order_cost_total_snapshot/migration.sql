-- Per-card procurement cost. Imported value for NORMAL cards; 0 for AUTO_FETCH cards (scraped, no cost).
ALTER TABLE "Card" ADD COLUMN "unitCost" DECIMAL(10, 2);

-- Authoritative order-level cost: sum of unitCost across cards consumed by this order.
-- Written when the order transitions to COMPLETED. Replaces the legacy costSnapshot field,
-- which remains for historical orders (read-only, fallback path).
ALTER TABLE "Order" ADD COLUMN "costTotalSnapshot" DECIMAL(10, 2);
