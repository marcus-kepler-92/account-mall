# Order Unit Price Snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Order 表新增 `unitPriceSnapshot` 字段，在下单时固化商品单价，消除所有展示层对 `product.price`（当前价格）的依赖。

**Architecture:** 三步走——①schema + 迁移引入字段，②一次性 backfill 脚本用逆推公式填充存量数据，③在三条下单路径写入快照，并更新所有展示层改用快照。历史订单若有折扣则反推 `amount / qty / (1 - discount/100)`，无折扣则直接 `amount / qty`，免费订单存 `0`。

**Tech Stack:** Prisma 6 + PostgreSQL 17, Next.js 16 App Router, TypeScript, tsx (脚本运行)

---

## 文件变更清单

| 操作 | 文件 | 职责 |
|------|------|------|
| 修改 | `prisma/schema.prisma` | 新增 `unitPriceSnapshot` 字段 |
| 自动生成 | `prisma/migrations/*/migration.sql` | DDL（`npm run db:migrate` 产生） |
| 新建 | `scripts/backfill-unit-price-snapshot.ts` | 存量数据逆推脚本（一次性） |
| 修改 | `app/api/orders/route.ts` | 三条创建路径写入快照 |
| 修改 | `app/admin/(main)/orders/orders-columns.tsx` | 商品格改用 `unitPriceSnapshot` |
| 修改 | `app/admin/(main)/orders/page.tsx` | 序列化带出 `unitPriceSnapshot`，移除不再需要的 `product.price` |
| 修改 | `app/admin/(main)/orders/[orderId]/page.tsx` | 详情页展示原始单价，移除 `product.price` 查询 |

---

### Task 1: Schema 新增字段 + 迁移

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 在 Order model 中 `productNameSnapshot` 下方加入新字段**

```prisma
// prisma/schema.prisma，Order model 内
productNameSnapshot       String?     @db.VarChar(500) // 下单时商品名称快照，便于历史订单展示
unitPriceSnapshot         Decimal?    @db.Decimal(10, 2) // 下单时商品单价快照（不含折扣）
```

- [ ] **Step 2: 生成迁移**

```bash
npm run db:migrate
# 提示输入迁移名称时填写：add_unit_price_snapshot
```

期望输出：`Your database is now in sync with your schema.`

- [ ] **Step 3: 确认迁移 SQL 正确**

打开 `prisma/migrations/*/migration.sql`，确认包含：

```sql
ALTER TABLE "Order" ADD COLUMN "unitPriceSnapshot" DECIMAL(10,2);
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add unitPriceSnapshot to Order"
```

---

### Task 2: Backfill 脚本（存量数据）

**Files:**
- Create: `scripts/backfill-unit-price-snapshot.ts`

背景：存量订单没有 `unitPriceSnapshot`。逆推公式：
- 免费订单（`amount = 0`）→ `unitPriceSnapshot = 0`
- 有折扣（`discountPercentApplied != null`）→ `amount / quantity / (1 - discountPercentApplied / 100)`
- 无折扣 → `amount / quantity`

逆推结果四舍五入到分（`Math.round(...* 100) / 100`）。

- [ ] **Step 1: 新建脚本文件**

```typescript
// scripts/backfill-unit-price-snapshot.ts
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  // Only process orders without a snapshot
  const orders = await prisma.order.findMany({
    where: { unitPriceSnapshot: null },
    select: {
      id: true,
      amount: true,
      quantity: true,
      discountPercentApplied: true,
    },
  })

  console.log(`Found ${orders.length} orders to backfill`)

  let updated = 0
  const BATCH = 500

  for (let i = 0; i < orders.length; i += BATCH) {
    const batch = orders.slice(i, i + BATCH)

    await prisma.$transaction(
      batch.map((o) => {
        const amount = Number(o.amount)
        const qty = o.quantity
        const discountPct = o.discountPercentApplied != null ? Number(o.discountPercentApplied) : null

        let unitPrice: number
        if (amount === 0) {
          unitPrice = 0
        } else if (discountPct != null && discountPct > 0 && discountPct < 100) {
          unitPrice = amount / qty / (1 - discountPct / 100)
        } else {
          unitPrice = amount / qty
        }

        const unitPriceSnapshot = Math.round(unitPrice * 100) / 100

        return prisma.order.update({
          where: { id: o.id },
          data: { unitPriceSnapshot },
        })
      }),
    )

    updated += batch.length
    console.log(`Backfilled ${updated}/${orders.length}`)
  }

  console.log("Done.")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 2: 运行脚本**

```bash
npx tsx scripts/backfill-unit-price-snapshot.ts
```

期望输出：
```
Found N orders to backfill
Backfilled N/N
Done.
```

- [ ] **Step 3: 验证（Prisma Studio 或 SQL）**

```bash
npm run db:studio
# 检查 Order 表，确认旧记录 unitPriceSnapshot 不为 null
```

或直接查询：

```bash
npx prisma db execute --stdin <<'SQL'
SELECT COUNT(*) FROM "Order" WHERE "unitPriceSnapshot" IS NULL;
SQL
```

期望返回 `0`（无遗漏）。

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-unit-price-snapshot.ts
git commit -m "feat(script): backfill unitPriceSnapshot for historical orders"
```

---

### Task 3: 下单路径写入快照

**Files:**
- Modify: `app/api/orders/route.ts`

共三处 `prisma.order.create`：

| 路径 | 位置（当前行号） | 写入值 |
|------|--------|--------|
| 普通付费订单 | ~660 | `Number(product.price)` |
| AUTO_FETCH 免费 | ~186 | `0` |
| AUTO_FETCH 收费 | ~234 | `params.price`（折前单价） |

- [ ] **Step 1: 普通付费订单（~660）**

在 `tx.order.create` 的 `data` 中，`productNameSnapshot` 后加一行：

```typescript
productNameSnapshot: product.name,
unitPriceSnapshot: Number(product.price),   // ← 新增
```

- [ ] **Step 2: AUTO_FETCH 免费订单（~186）**

在 `tx.order.create` 的 `data` 中，`productNameSnapshot` 后加：

```typescript
productNameSnapshot: product.name,
unitPriceSnapshot: 0,                        // ← 新增（免费商品单价为 0）
```

- [ ] **Step 3: AUTO_FETCH 收费订单（~234）**

在 `tx.order.create` 的 `data` 中，`productNameSnapshot` 后加：

```typescript
productNameSnapshot: product.name,
unitPriceSnapshot: params.price,             // ← 新增（折前配置价格）
```

- [ ] **Step 4: 验证构建无类型错误**

```bash
npm run build 2>&1 | tail -20
```

期望：无 TypeScript 报错。

- [ ] **Step 5: Commit**

```bash
git add app/api/orders/route.ts
git commit -m "feat(orders): write unitPriceSnapshot on order creation"
```

---

### Task 4: Admin 订单列表展示快照价格

**Files:**
- Modify: `app/admin/(main)/orders/orders-columns.tsx`
- Modify: `app/admin/(main)/orders/page.tsx`

- [ ] **Step 1: 更新 `OrderRow` 类型**

在 `orders-columns.tsx` 中，`OrderRow` 的 `product` 字段删除 `price`，改为顶层 `unitPriceSnapshot`：

```typescript
// Before
export type OrderRow = {
  // ...
  product: {
    id: string
    name: string
    price: number       // ← 删除
  }
  // ...
}

// After
export type OrderRow = {
  // ...
  product: {
    id: string
    name: string
  }
  unitPriceSnapshot: number | null   // ← 新增
  // ...
}
```

- [ ] **Step 2: 更新商品列的 cell 渲染**

```typescript
// orders-columns.tsx，商品列 cell
cell: ({ row }) => {
    const product = row.original.product
    const unitPrice = row.original.unitPriceSnapshot
    return (
        <div className="flex flex-col">
            <span className="font-medium">{product.name}</span>
            {unitPrice != null && (
                <span className="text-xs text-muted-foreground">
                    {formatCurrency(unitPrice)}
                </span>
            )}
        </div>
    )
},
```

- [ ] **Step 3: 更新 `page.tsx` 的 Prisma 查询**

在 `prisma.order.findMany` 的 `include.product.select` 中，移除 `price: true`（不再需要）：

```typescript
product: {
    select: {
        id: true,
        name: true,
        // price: true  ← 删除
    },
},
```

- [ ] **Step 4: 更新 `page.tsx` 的序列化**

```typescript
// serializedOrders map 内
return {
    // ...
    product: {
        id: order.product.id,
        name: order.product.name,
        // price: Number(order.product.price),  ← 删除
    },
    unitPriceSnapshot: order.unitPriceSnapshot != null
        ? Number(order.unitPriceSnapshot)
        : null,
    // ...
}
```

- [ ] **Step 5: 验证构建**

```bash
npm run build 2>&1 | tail -20
```

期望：无报错。

- [ ] **Step 6: Commit**

```bash
git add app/admin/(main)/orders/orders-columns.tsx app/admin/(main)/orders/page.tsx
git commit -m "feat(admin/orders): display unitPriceSnapshot instead of current product price"
```

---

### Task 5: Admin 订单详情展示原始单价

**Files:**
- Modify: `app/admin/(main)/orders/[orderId]/page.tsx`

- [ ] **Step 1: 更新 Prisma 查询，移除 `product.price` 的 select**

```typescript
const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
        product: {
            select: {
                id: true,
                name: true,
                slug: true,
                // price: true  ← 删除
            },
        },
        cards: {
            orderBy: { createdAt: "asc" },
        },
    },
})
```

- [ ] **Step 2: 在订单信息网格中，"金额"格下方新增"原始单价"格**

找到现有的金额展示块：

```tsx
<div>
    <p className="text-muted-foreground">金额</p>
    <p className="font-medium">
        ¥{Number(order.amount).toFixed(2)}
    </p>
</div>
```

在其后插入：

```tsx
{order.unitPriceSnapshot != null && (
    <div>
        <p className="text-muted-foreground">原始单价</p>
        <p>¥{Number(order.unitPriceSnapshot).toFixed(2)}</p>
    </div>
)}
```

- [ ] **Step 3: 验证构建**

```bash
npm run build 2>&1 | tail -20
```

期望：无报错，无 TypeScript 类型错误。

- [ ] **Step 4: 端到端验证**

1. `npm run dev` 启动开发服务器
2. 访问 `/admin/orders`，确认旧订单的商品格显示快照价格（38），而不是当前价格（42）
3. 访问某订单详情页，确认"原始单价"字段显示正确

- [ ] **Step 5: Commit**

```bash
git add app/admin/(main)/orders/[orderId]/page.tsx
git commit -m "feat(admin/orders/detail): show unitPriceSnapshot, remove stale product.price fetch"
```

---

## 验收标准

- [ ] 改价前下的订单，列表和详情页显示下单时的单价，不随商品现价变化
- [ ] 新下订单后，`unitPriceSnapshot` 与下单时 `product.price` 一致
- [ ] 所有展示层不再依赖 `product.price` 作为历史价格来源
- [ ] `npm run build` 零错误，`npm test` 无回归
