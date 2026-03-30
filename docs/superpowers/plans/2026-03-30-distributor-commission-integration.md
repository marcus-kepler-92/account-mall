# Distributor Assignment Commission Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让分销员内联编辑操作与佣金体系正确集成——分配/撤回/换人时原子地处理所有佣金记录，保证提现余额账本不出错。

**Architecture:**
1. Schema 加 `CANCELLED` 状态保留审计记录
2. 把 `completePendingOrder` 里的佣金计算逻辑提取为独立函数，两处复用
3. 重写 distributor PATCH 端点，加两层卡口（PENDING 提现 + 余额不变负）并在事务内原子处理佣金
4. Cell 组件加 `orderStatus` prop，非 COMPLETED 订单退化为纯文本

**Tech Stack:** Prisma 6, Next.js 16, Zod, TypeScript

**余额公式（不变）：**
```
可提现余额 = SUM(commission.SETTLED) − SUM(withdrawal.PAID) − SUM(withdrawal.PENDING)
```
CANCELLED 佣金天然不在 SETTLED 内，无需改提现流程。

---

## File Map

| 文件 | 操作 | 职责 |
|------|------|------|
| `prisma/schema.prisma` | **修改** | CommissionStatus 加 CANCELLED |
| `lib/calculate-order-commission.ts` | **新建** | 佣金计算 + 创建（含防刷、level2、阶梯） |
| `lib/complete-pending-order.ts` | **修改** | 调用上面提取的函数，移除内联计算 |
| `app/api/admin/orders/[orderId]/distributor/route.ts` | **重写** | 加卡口 + 事务内佣金处理 |
| `app/admin/(main)/orders/order-distributor-cell.tsx` | **修改** | 加 orderStatus prop；修 catch 关 Popover；修清除空判断 |
| `app/admin/(main)/orders/orders-columns.tsx` | **修改** | 给 cell 传 orderStatus |

---

## Task 1: Schema — 加 CANCELLED 状态

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 修改 schema**

找到：
```prisma
enum CommissionStatus {
  PENDING
  SETTLED
  WITHDRAWN
}
```

改为：
```prisma
enum CommissionStatus {
  PENDING
  SETTLED
  WITHDRAWN
  CANCELLED
}
```

- [ ] **Step 2: 运行迁移**

```bash
npm run db:migrate
```

在迁移名称提示处输入：`add_commission_cancelled_status`

Expected: 迁移文件生成 + 数据库更新成功

- [ ] **Step 3: 重新生成 Prisma Client**

```bash
npm run db:generate
```

- [ ] **Step 4: 确认类型可用**

```bash
npm run lint 2>&1 | head -5
```

Expected: 无新增错误

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add CANCELLED status to CommissionStatus enum"
```

---

## Task 2: 提取佣金计算为独立函数

**Files:**
- Create: `lib/calculate-order-commission.ts`
- Modify: `lib/complete-pending-order.ts`

### 背景

`complete-pending-order.ts` 里从第 85 行到第 209 行是完整的佣金计算逻辑，包含：
- `toNumber` / `getWeekStart` 工具函数
- 防刷检查（order email = distributor email）
- 当周销售额累计 + 阶梯档位查询
- pre-discount 佣金基数计算
- level 2 拆分逻辑
- `tx.commission.create` 调用

这些需要提取出来，让 distributor PATCH 端点也能复用。

- [ ] **Step 1: 新建 `lib/calculate-order-commission.ts`**

```typescript
import type { Prisma } from "@prisma/client"
import { getConfig } from "@/lib/config"

/** Prisma Decimal 等转为 number */
export function toNumber(value: unknown): number {
  if (typeof value === "number" && !Number.isNaN(value)) return value
  const d = value as { toNumber?: () => number }
  if (typeof d?.toNumber === "function") return d.toNumber()
  const n = Number(value)
  return Number.isNaN(n) ? 0 : n
}

/** Natural week: Monday 00:00:00 UTC */
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export interface CreateOrderCommissionsParams {
  orderId: string
  distributorId: string
  orderEmail: string
  orderAmount: unknown
  discountPercentApplied: unknown
  paidAt: Date
}

/**
 * Calculate and create commission records for an order within a transaction.
 * Applies anti-fraud, tier lookup, level-2 split.
 * No-ops silently when anti-fraud triggers or commission amount is 0.
 */
export async function createOrderCommissions(
  tx: Prisma.TransactionClient,
  params: CreateOrderCommissionsParams,
): Promise<void> {
  const {
    orderId,
    distributorId,
    orderEmail,
    orderAmount,
    discountPercentApplied,
    paidAt,
  } = params

  const distributor = await tx.user.findUnique({
    where: { id: distributorId },
    select: { email: true, inviterId: true },
  })
  if (!distributor) return

  // Anti-fraud: self-purchase
  const orderEmailNorm = orderEmail?.trim().toLowerCase() ?? ""
  const distributorEmailNorm = distributor.email?.trim().toLowerCase() ?? ""
  if (orderEmailNorm && orderEmailNorm === distributorEmailNorm) return

  // Tier lookup (week-based)
  const weekStart = getWeekStart(paidAt)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)

  const weekOrders = await tx.order.findMany({
    where: {
      distributorId,
      status: "COMPLETED",
      paidAt: { gte: weekStart, lt: weekEnd },
    },
    select: { amount: true },
  })
  const weekTotal = weekOrders.reduce((sum, o) => sum + toNumber(o.amount), 0)

  const tiers = await tx.commissionTier.findMany({
    orderBy: { sortOrder: "asc" },
  })
  let ratePercent: number | null = null
  for (const tier of tiers) {
    const min = toNumber(tier.minAmount)
    const max = toNumber(tier.maxAmount)
    if (weekTotal >= min && weekTotal < max) {
      ratePercent = toNumber(tier.ratePercent)
      break
    }
  }
  if (ratePercent == null && tiers.length > 0) {
    ratePercent = toNumber(tiers[0].ratePercent)
  }

  // Commission base: pre-discount price
  const paidAmount = toNumber(orderAmount)
  const discountPct = toNumber(discountPercentApplied)
  const commissionBase =
    discountPct > 0 && discountPct < 100
      ? paidAmount / (1 - discountPct / 100)
      : paidAmount
  const totalCommission =
    ratePercent != null && commissionBase > 0
      ? Math.round((commissionBase * ratePercent) / 100 * 100) / 100
      : 0

  if (totalCommission <= 0) return

  // Level-2 split
  const inviterId = distributor.inviterId ?? null
  let inviter: { email: string; role: string; disabledAt: Date | null } | null = null
  if (inviterId) {
    inviter = await tx.user.findUnique({
      where: { id: inviterId },
      select: { email: true, role: true, disabledAt: true },
    }) as { email: string; role: string; disabledAt: Date | null } | null
  }

  const config = getConfig()
  const level2Rate = config.level2CommissionRatePercent
  const shouldSplitLevel2 =
    inviterId &&
    inviter &&
    inviter.role === "DISTRIBUTOR" &&
    !inviter.disabledAt &&
    orderEmailNorm !== inviter.email.trim().toLowerCase()

  if (shouldSplitLevel2) {
    const level2Amount = Math.round(totalCommission * level2Rate / 100 * 100) / 100
    const level1Amount = Math.round((totalCommission - level2Amount) * 100) / 100

    if (level1Amount > 0) {
      await tx.commission.create({
        data: {
          orderId,
          distributorId,
          amount: level1Amount,
          status: "SETTLED",
          level: 1,
        },
      })
    }
    if (level2Amount > 0) {
      await tx.commission.create({
        data: {
          orderId,
          distributorId: inviterId!,
          amount: level2Amount,
          status: "SETTLED",
          level: 2,
          sourceDistributorId: distributorId,
        },
      })
    }
  } else {
    await tx.commission.create({
      data: {
        orderId,
        distributorId,
        amount: totalCommission,
        status: "SETTLED",
        level: 1,
      },
    })
  }
}
```

- [ ] **Step 2: 更新 `lib/complete-pending-order.ts`**

对文件做以下 3 处修改：

1. 删除文件顶部的 `toNumber`（第 5-12 行）和 `getWeekStart`（第 14-22 行）两个工具函数。
2. 删除 `import { getConfig } from "@/lib/config"` 这行（提取后该文件不再直接调用 getConfig）。
3. 在顶部 import 区加：

```typescript
import { createOrderCommissions } from "@/lib/calculate-order-commission"
```

把事务回调内从 `if (!didUpdate) return;` 到 `if (distributorId) { ... }` 整个代码块（原文件第 86-210 行）替换为：
```typescript
if (!didUpdate) return
const distributorId = order.distributorId
if (distributorId) {
  await createOrderCommissions(tx, {
    orderId: order.id,
    distributorId,
    orderEmail: order.email ?? "",
    orderAmount: order.amount,
    discountPercentApplied: order.discountPercentApplied,
    paidAt,
  })
}
```

- [ ] **Step 3: 运行现有测试确认不退化**

```bash
npx jest --testPathPattern="complete-pending-order|commission" -v
```

Expected: 所有现有测试通过

- [ ] **Step 4: Commit**

```bash
git add lib/calculate-order-commission.ts lib/complete-pending-order.ts
git commit -m "refactor: extract commission calculation to lib/calculate-order-commission.ts"
```

---

## Task 3: 重写 distributor PATCH 端点

**Files:**
- Modify: `app/api/admin/orders/[orderId]/distributor/route.ts`
- Modify: `__tests__/api/admin/orders/orderId/distributor.test.ts`

### 新端点逻辑

```
1. Auth
2. Parse + validate body: { distributorId: string | null }
3. Find order → 404 if not found
4. Check order.status === "COMPLETED" → 400 if not
5. Find all existing commissions for orderId (status SETTLED or PENDING)
6. Group by distributorId → per-distributor amount map
7. For each affected distributorId:
   a. Check no PENDING withdrawal → 409
   b. Check (SETTLED_sum − this_amount − PAID_sum − PENDING_withdrawal_sum) >= 0 → 409
8. If new distributorId !== null → validate user.role === DISTRIBUTOR
9. Transaction:
   a. UPDATE commission SET status=CANCELLED WHERE orderId AND status IN (SETTLED,PENDING)
   b. UPDATE order SET distributorId
   c. If new distributorId → createOrderCommissions(tx, {...})
10. Return { ok: true }
```

- [ ] **Step 1: 写测试（先失败）**

完整替换 `__tests__/api/admin/orders/orderId/distributor.test.ts`：

```typescript
import { PATCH } from "@/app/api/admin/orders/[orderId]/distributor/route"
import { prismaMock } from "../../../../../__mocks__/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import * as commissionsModule from "@/lib/calculate-order-commission"
import { NextRequest } from "next/server"

jest.mock("@/lib/auth-guard", () => ({ getAdminSession: jest.fn() }))
jest.mock("@/lib/calculate-order-commission", () => ({
  createOrderCommissions: jest.fn(),
}))
jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../../../../__mocks__/prisma")
  return { __esModule: true, prisma: prismaMock }
})

const mockSession = { user: { id: "admin-1" } }

const mockCompletedOrder = {
  id: "order-1",
  orderNo: "ORD001",
  status: "COMPLETED",
  distributorId: null,
  email: "buyer@example.com",
  amount: "100",
  discountPercentApplied: "0",
  paidAt: new Date("2025-01-01"),
}

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/orders/order-1/distributor", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

function makeContext(orderId = "order-1") {
  return { params: Promise.resolve({ orderId }) }
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
  prismaMock.order.findUnique.mockResolvedValue(mockCompletedOrder)
  prismaMock.commission.findMany.mockResolvedValue([])
  prismaMock.user.findUnique.mockResolvedValue({ id: "dist-1", role: "DISTRIBUTOR" })
  prismaMock.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
    fn(prismaMock)
  )
  prismaMock.commission.updateMany.mockResolvedValue({ count: 0 })
  prismaMock.order.update.mockResolvedValue({ ...mockCompletedOrder, distributorId: "dist-1" })
  ;(commissionsModule.createOrderCommissions as jest.Mock).mockResolvedValue(undefined)
})

describe("PATCH /api/admin/orders/[orderId]/distributor", () => {
  it("returns 401 when not admin", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const res = await PATCH(makeRequest({ distributorId: "dist-1" }), makeContext())
    expect(res.status).toBe(401)
  })

  it("returns 404 when order not found", async () => {
    prismaMock.order.findUnique.mockResolvedValue(null)
    const res = await PATCH(makeRequest({ distributorId: "dist-1" }), makeContext())
    expect(res.status).toBe(404)
  })

  it("returns 400 when order is not COMPLETED", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ ...mockCompletedOrder, status: "PENDING" })
    const res = await PATCH(makeRequest({ distributorId: "dist-1" }), makeContext())
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/COMPLETED/)
  })

  it("returns 400 when distributorId references non-DISTRIBUTOR user", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "dist-1", role: "ADMIN" })
    const res = await PATCH(makeRequest({ distributorId: "dist-1" }), makeContext())
    expect(res.status).toBe(400)
  })

  it("returns 409 when affected distributor has PENDING withdrawal", async () => {
    prismaMock.commission.findMany.mockResolvedValue([
      { id: "c-1", distributorId: "old-dist", amount: "50", status: "SETTLED" },
    ])
    prismaMock.withdrawal.count.mockResolvedValue(1)
    const res = await PATCH(makeRequest({ distributorId: null }), makeContext())
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toMatch(/提现/)
  })

  it("returns 409 when cancelling commission would make balance negative", async () => {
    prismaMock.commission.findMany.mockResolvedValue([
      { id: "c-1", distributorId: "old-dist", amount: "100", status: "SETTLED" },
    ])
    prismaMock.withdrawal.count.mockResolvedValue(0)
    // settled=100, commission_to_cancel=100, paid=80, pending=0 → 100-100-80-0 = -80 < 0
    prismaMock.commission.aggregate.mockResolvedValue({ _sum: { amount: "100" } })
    prismaMock.withdrawal.aggregate
      .mockResolvedValueOnce({ _sum: { amount: "80" } })  // PAID
      .mockResolvedValueOnce({ _sum: { amount: "0" } })   // PENDING
    const res = await PATCH(makeRequest({ distributorId: null }), makeContext())
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toMatch(/提现/)
  })

  it("cancels existing commissions and assigns new distributor in transaction", async () => {
    const res = await PATCH(makeRequest({ distributorId: "dist-1" }), makeContext())
    expect(res.status).toBe(200)
    expect(prismaMock.commission.updateMany).toHaveBeenCalledWith({
      where: { orderId: "order-1", status: { in: ["SETTLED", "PENDING"] } },
      data: { status: "CANCELLED" },
    })
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { distributorId: "dist-1" },
    })
    expect(commissionsModule.createOrderCommissions).toHaveBeenCalled()
  })

  it("clears distributor and cancels commissions when distributorId is null", async () => {
    const res = await PATCH(makeRequest({ distributorId: null }), makeContext())
    expect(res.status).toBe(200)
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { distributorId: null },
    })
    expect(commissionsModule.createOrderCommissions).not.toHaveBeenCalled()
  })

  it("returns 400 for invalid body schema (non-string distributorId)", async () => {
    const res = await PATCH(makeRequest({ distributorId: 123 }), makeContext())
    expect(res.status).toBe(400)
  })

  it("returns 500 when transaction throws", async () => {
    prismaMock.$transaction.mockRejectedValue(new Error("DB error"))
    const res = await PATCH(makeRequest({ distributorId: null }), makeContext())
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx jest __tests__/api/admin/orders/orderId/distributor.test.ts -v
```

Expected: 多个 FAIL（逻辑未实现）

- [ ] **Step 3: 重写 route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import {
  unauthorized,
  notFound,
  invalidJsonBody,
  validationError,
  badRequest,
  conflict,
  internalServerError,
} from "@/lib/api-response"
import { createOrderCommissions, toNumber } from "@/lib/calculate-order-commission"

const schema = z.object({
  distributorId: z.string().nullable(),
})

type RouteContext = { params: Promise<{ orderId: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { orderId } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalidJsonBody()
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const { distributorId } = parsed.data

  try {
    // 1. Find order
    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) return notFound("Order not found")
    if (order.status !== "COMPLETED") {
      return badRequest("只能对已完成订单修改分销员")
    }

    // 2. Validate new distributor
    if (distributorId !== null) {
      const user = await prisma.user.findUnique({ where: { id: distributorId } })
      if (!user || user.role !== "DISTRIBUTOR") {
        return badRequest("Invalid distributor")
      }
    }

    // 3. Find all existing commissions for this order
    const existingCommissions = await prisma.commission.findMany({
      where: { orderId, status: { in: ["SETTLED", "PENDING"] } },
      select: { id: true, distributorId: true, amount: true },
    })

    // 4. Check each affected distributor
    if (existingCommissions.length > 0) {
      // Group by distributorId
      const amountByDistributor = new Map<string, number>()
      for (const c of existingCommissions) {
        const prev = amountByDistributor.get(c.distributorId) ?? 0
        amountByDistributor.set(c.distributorId, prev + toNumber(c.amount))
      }

      for (const [distId, cancelAmount] of amountByDistributor) {
        // 4a. PENDING withdrawal check
        const pendingWithdrawals = await prisma.withdrawal.count({
          where: { distributorId: distId, status: "PENDING" },
        })
        if (pendingWithdrawals > 0) {
          return conflict("分销员存在待处理提现申请，无法修改分销归属")
        }

        // 4b. Balance check
        const [settledAgg, paidAgg, pendingAgg] = await Promise.all([
          prisma.commission.aggregate({
            where: { distributorId: distId, status: "SETTLED" },
            _sum: { amount: true },
          }),
          prisma.withdrawal.aggregate({
            where: { distributorId: distId, status: "PAID" },
            _sum: { amount: true },
          }),
          prisma.withdrawal.aggregate({
            where: { distributorId: distId, status: "PENDING" },
            _sum: { amount: true },
          }),
        ])
        const settled = toNumber(settledAgg._sum.amount)
        const paid = toNumber(paidAgg._sum.amount)
        const pendingW = toNumber(pendingAgg._sum.amount)
        const balanceAfter = settled - cancelAmount - paid - pendingW
        if (balanceAfter < 0) {
          return conflict("此订单佣金已被提现消耗，无法修改分销归属")
        }
      }
    }

    // 5. Transaction: cancel old commissions + update order + create new commissions
    await prisma.$transaction(async (tx) => {
      // Cancel all existing commissions for this order
      await tx.commission.updateMany({
        where: { orderId, status: { in: ["SETTLED", "PENDING"] } },
        data: { status: "CANCELLED" },
      })

      // Update order distributorId
      await tx.order.update({
        where: { id: orderId },
        data: { distributorId },
      })

      // Create new commissions if assigning a distributor
      if (distributorId !== null && order.paidAt) {
        await createOrderCommissions(tx, {
          orderId,
          distributorId,
          orderEmail: order.email ?? "",
          orderAmount: order.amount,
          discountPercentApplied: order.discountPercentApplied,
          paidAt: order.paidAt,
        })
      }
    })

    return NextResponse.json({ ok: true })
  } catch {
    return internalServerError()
  }
}

export const runtime = "nodejs"
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx jest __tests__/api/admin/orders/orderId/distributor.test.ts -v
```

Expected: 9/9 PASS

- [ ] **Step 5: 运行全量测试确认不退化**

```bash
npm test 2>&1 | tail -20
```

Expected: 无新增失败

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/orders/[orderId]/distributor/route.ts \
        __tests__/api/admin/orders/orderId/distributor.test.ts
git commit -m "feat: add commission guards and atomic handling to distributor PATCH endpoint"
```

---

## Task 4: 修复 Cell 组件 + 传入 orderStatus

**Files:**
- Modify: `app/admin/(main)/orders/order-distributor-cell.tsx`
- Modify: `app/admin/(main)/orders/orders-columns.tsx`

修复审计发现的 3 个问题，并加 disabled 状态支持。

- [ ] **Step 1: 更新 `order-distributor-cell.tsx`**

**变更 1 — 加 `orderStatus` prop，非 COMPLETED 时纯文本展示：**

在 `OrderDistributorCellProps` 接口加字段：
```typescript
interface OrderDistributorCellProps {
  orderId: string
  orderStatus: "PENDING" | "COMPLETED" | "CLOSED"
  distributor: { id: string; name: string; distributorCode: string | null } | null
  distributors: DistributorOption[]
}
```

在组件 return 之前加 disabled 短路：
```typescript
if (orderStatus !== "COMPLETED") {
  return distributor ? (
    <div className="flex flex-col text-xs">
      <span>{distributor.name}</span>
      {distributor.distributorCode && (
        <span className="text-muted-foreground font-mono">{distributor.distributorCode}</span>
      )}
    </div>
  ) : (
    <span className="text-muted-foreground">—</span>
  )
}
```

**变更 2 — 修 catch 块关闭 Popover（审计 #2）：**

在 `handleConfirm` 的 catch 块里加 `setOpen(false)`，保留 `finally` 不动：
```typescript
} catch {
  toast.error("操作失败")
  setOpen(false)
} finally {
  setLoading(false)
}
```

**变更 3 — 修清除空订单卡口（审计 #5）：**

`handleSelect` 开头加：
```typescript
if (selected === "clear" && !distributor) {
  setOpen(false)
  return
}
```

- [ ] **Step 2: 更新 `orders-columns.tsx`**

在 distributor 列的 cell 里传入 `orderStatus`：

```typescript
cell: ({ row }) => (
    <OrderDistributorCell
        orderId={row.original.id}
        orderStatus={row.original.status}
        distributor={row.original.distributor}
        distributors={distributors}
    />
),
```

- [ ] **Step 3: Lint 检查**

```bash
npm run lint 2>&1 | grep -E "(order-distributor-cell|orders-columns)" | head -20
```

Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add app/admin/(main)/orders/order-distributor-cell.tsx \
        app/admin/(main)/orders/orders-columns.tsx
git commit -m "fix: disable distributor cell for non-COMPLETED orders, fix catch/clear bugs"
```

---

## 自我检查

- [x] level 2 佣金：事务内 `commission.updateMany` 按 orderId 全量 cancel，level 1 + level 2 均覆盖
- [x] 余额卡口覆盖所有受影响方（Map 遍历 amountByDistributor）
- [x] PENDING 提现卡口覆盖所有受影响方（同 Map 遍历）
- [x] 防刷逻辑在 `createOrderCommissions` 内保持一致
- [x] paidAt 为 null 时不创建佣金（`order.paidAt` 判断）
- [x] 事务外加 try/catch → internalServerError（审计 #1）
- [x] catch 块关闭 Popover（审计 #2）
- [x] 清除空分销员短路（审计 #5）
- [x] 测试新增 schema 非法类型 + DB 异常用例（审计 #8）
- [x] 不改提现流程，余额公式天然兼容 CANCELLED
