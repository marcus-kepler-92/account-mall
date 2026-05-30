-- DropColumn
-- excludeFromAttribution has been superseded by commissionMode=NONE (migrated in
-- 20260530000000_add_commission_mode). All code now reads commissionMode.
ALTER TABLE "Product" DROP COLUMN "excludeFromAttribution";
