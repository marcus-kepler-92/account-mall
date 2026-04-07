-- Backfill unitPriceSnapshot for historical orders
-- Idempotent: WHERE clause skips already-populated rows
UPDATE "Order"
SET "unitPriceSnapshot" = CASE
  WHEN amount = 0 THEN 0
  WHEN "discountPercentApplied" IS NOT NULL
       AND "discountPercentApplied" > 0
       AND "discountPercentApplied" < 100
  THEN ROUND(
    (amount / quantity / (1 - "discountPercentApplied" / 100))::numeric,
    2
  )
  ELSE ROUND((amount / quantity)::numeric, 2)
END
WHERE "unitPriceSnapshot" IS NULL;
