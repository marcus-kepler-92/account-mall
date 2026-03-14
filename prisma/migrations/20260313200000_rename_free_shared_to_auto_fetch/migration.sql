-- Rename ProductType enum value FREE_SHARED → AUTO_FETCH
-- 必须先删除列默认值（依赖枚举类型），再 DROP TYPE，否则报 2BP01

-- Step 1: 先删除列的默认值（它依赖旧枚举，不删则 DROP TYPE 失败）
ALTER TABLE "Product" ALTER COLUMN "productType" DROP DEFAULT;

-- Step 2: 将列改为 text，脱离枚举约束
ALTER TABLE "Product" ALTER COLUMN "productType" TYPE text;

-- Step 3: 删除旧枚举类型
DROP TYPE "ProductType";

-- Step 4: 创建新枚举类型（用 AUTO_FETCH 替换 FREE_SHARED）
CREATE TYPE "ProductType" AS ENUM ('NORMAL', 'AUTO_FETCH');

-- Step 5: 迁移现有数据
UPDATE "Product" SET "productType" = 'AUTO_FETCH' WHERE "productType" = 'FREE_SHARED';

-- Step 6: 将列改回枚举类型
ALTER TABLE "Product" ALTER COLUMN "productType" TYPE "ProductType" USING "productType"::"ProductType";

-- Step 7: 恢复默认值
ALTER TABLE "Product" ALTER COLUMN "productType" SET DEFAULT 'NORMAL';
