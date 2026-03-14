-- Rename ProductType enum value FREE_SHARED → AUTO_FETCH
-- PostgreSQL 不允许在同一事务内使用 ALTER TYPE ADD VALUE 新增的枚举值（55P04）。
-- 解决方案：先将列改为 text，重建枚举类型，再迁移数据，最后将列改回枚举类型，全程无需 ADD VALUE。

-- Step 1: 将列改为 text，脱离旧枚举约束
ALTER TABLE "Product" ALTER COLUMN "productType" TYPE text;

-- Step 2: 删除旧枚举类型
DROP TYPE "ProductType";

-- Step 3: 创建新枚举类型（用 AUTO_FETCH 替换 FREE_SHARED）
CREATE TYPE "ProductType" AS ENUM ('NORMAL', 'AUTO_FETCH');

-- Step 4: 迁移现有数据
UPDATE "Product" SET "productType" = 'AUTO_FETCH' WHERE "productType" = 'FREE_SHARED';

-- Step 5: 将列改回枚举类型
ALTER TABLE "Product" ALTER COLUMN "productType" TYPE "ProductType" USING "productType"::"ProductType";

-- Step 6: 恢复默认值
ALTER TABLE "Product" ALTER COLUMN "productType" SET DEFAULT 'NORMAL';
