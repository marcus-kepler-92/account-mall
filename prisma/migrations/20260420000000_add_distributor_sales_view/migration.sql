-- CreateView
CREATE VIEW "DistributorSalesView" AS
SELECT
  u.id AS "userId",
  COALESCE(
    SUM(CASE WHEN o.status = 'COMPLETED' THEN o.amount ELSE 0 END),
    0
  ) AS "salesTotal"
FROM "User" u
LEFT JOIN "Order" o ON o."distributorId" = u.id
WHERE u.role = 'DISTRIBUTOR'
GROUP BY u.id;
