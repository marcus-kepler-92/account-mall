# Admin 通知系统重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 admin 顶栏 Bell 改为聚合通知中心 Popover，引入 NotificationSource 注册表 + 单一聚合 API + 单一前端 hook，接入提现 / 客服跟进 / 库存预警三类待办，并联动子管理员 `allowedMenus`。

**Architecture:** `lib/admin-notifications/` 注册表集中声明 source；`GET /api/admin/notifications` 校验 admin、按 `allowedMenus` 过滤后并行执行各 source 的 fetch；`useAdminNotifications()` 单一 hook 驱动顶栏 Popover 与侧边栏 badge。

**Tech Stack:** Next.js 16 App Router · React 19 · Prisma 6 · TanStack Query · shadcn/ui (Popover, Separator, ScrollArea) · Jest + Testing Library.

参考 spec：`docs/superpowers/specs/2026-05-21-admin-notifications-design.md`

---

## 文件结构总览

**新建**
```
lib/inventory.ts                                           常量与 subtype 判定（前置）
lib/admin-notifications/index.ts                           类型 + SOURCES 注册表 + sourceFor
lib/admin-notifications/sources/withdrawals.ts             提现 source
lib/admin-notifications/sources/agent-leads.ts             客服 lead source
lib/admin-notifications/sources/inventory-alerts.ts        库存预警 source
app/api/admin/notifications/route.ts                       聚合 GET API
app/admin/hooks/use-admin-notifications.ts                 单一 React Query hook
app/admin/components/notification-center-popover.tsx       Popover UI
app/admin/components/sidebar-item-badge.tsx                Sidebar 通用 badge
__tests__/lib/admin-notifications/withdrawals.test.ts      source 单元测试
__tests__/lib/admin-notifications/agent-leads.test.ts
__tests__/lib/admin-notifications/inventory-alerts.test.ts
__tests__/api/admin-notifications.test.ts                  聚合 API 集成测试
```

**修改**
```
app/admin/(main)/dashboard/types.ts                        改为 re-export from "@/lib/inventory"
app/components/admin-topbar-actions.tsx                    Bell 改为 PopoverTrigger
app/components/admin-sidebar.tsx                           换用新 hook + SidebarItemBadge
app/admin/(main)/products/page.tsx                         支持 ?notice=inventory
app/admin/(main)/products/products-columns.tsx             ProductRow 加 subscriberCount/hasAlert + 隐藏列
app/admin/(main)/products/products-table-wrapper.tsx       接受 defaultFilters
app/admin/(main)/products/products-data-table.tsx          初始化 columnFilters
app/admin/components/index.ts                              barrel 导出新组件
```

**删除**
```
app/admin/hooks/use-pending-withdrawals.ts
app/admin/hooks/use-pending-leads.ts
app/api/admin/withdrawals/count/route.ts
app/api/admin/agent/leads/count/route.ts
__tests__/api/admin-agent-leads-count.test.ts              对应测试一并删除
```

---

## Task 0: 前置 — 迁移 `LOW_STOCK_THRESHOLD` 到 `lib/inventory.ts`

**Files:**
- Create: `lib/inventory.ts`
- Modify: `app/admin/(main)/dashboard/types.ts:12`

独立 commit，与本次主体改动解耦。

- [ ] **Step 1: 创建 `lib/inventory.ts`**

写入：

```ts
// lib/inventory.ts
// Admin 后端库存预警阈值。前端商品卡使用 configClient.lowStockThreshold
// 是另一套配置（受 NEXT_PUBLIC_LOW_STOCK_THRESHOLD 控制，由站长 env 调）。
export const LOW_STOCK_THRESHOLD = 3

export type InventorySubtype = "RESTOCK_WAITING" | "OUT_OF_STOCK" | "LOW_STOCK"

/**
 * 互斥优先级：RESTOCK_WAITING > OUT_OF_STOCK > LOW_STOCK。
 * 返回 null 表示库存正常。
 */
export function resolveInventorySubtype(
  unsoldCount: number,
  subscriberCount: number,
): InventorySubtype | null {
  if (unsoldCount === 0 && subscriberCount > 0) return "RESTOCK_WAITING"
  if (unsoldCount === 0) return "OUT_OF_STOCK"
  if (unsoldCount < LOW_STOCK_THRESHOLD) return "LOW_STOCK"
  return null
}
```

- [ ] **Step 2: 改 dashboard `types.ts` 为 re-export**

`app/admin/(main)/dashboard/types.ts:12` 原本是 `export const LOW_STOCK_THRESHOLD = 3`。改为：

```ts
export { LOW_STOCK_THRESHOLD } from "@/lib/inventory"
```

保留文件中其它内容不变。

- [ ] **Step 3: typecheck + 跑相关测试**

```bash
npm run lint
npm test -- __tests__/lib
```

预期：通过。

- [ ] **Step 4: Commit**

```bash
git add lib/inventory.ts app/admin/\(main\)/dashboard/types.ts
git commit -m "refactor(inventory): 提升 LOW_STOCK_THRESHOLD 到 lib 共享 + 引入 resolveInventorySubtype"
```

---

## Task 1: NotificationSource 类型 + 注册表骨架

**Files:**
- Create: `lib/admin-notifications/index.ts`

只建类型 + 空 SOURCES + sourceFor mapping，后续任务填具体 source。

- [ ] **Step 1: 创建 `lib/admin-notifications/index.ts`**

```ts
import type { PrismaClient } from "@prisma/client"
import type { LucideIcon } from "lucide-react"
import type { InventorySubtype } from "@/lib/inventory"

export type SourceKey = "withdrawals" | "agentLeads" | "inventoryAlerts"

export type WithdrawalItem = {
  id: string
  distributorName: string
  amount: number
  createdAt: string
}

export type AgentLeadItem = {
  id: string
  displayName: string
  status: "NEW" | "CONTACTED"
  urgency: "LOW" | "MED" | "HIGH"
  createdAt: string
}

export type InventoryAlertItem = {
  productId: string
  productName: string
  unsoldCount: number
  subscriberCount: number
  subtype: InventorySubtype
}

export type SourceResult =
  | { key: "withdrawals"; count: number; items: WithdrawalItem[] }
  | { key: "agentLeads"; count: number; items: AgentLeadItem[] }
  | {
      key: "inventoryAlerts"
      count: number
      breakdown: { outOfStock: number; lowStock: number; restockWaiting: number }
      items: InventoryAlertItem[]
    }

export type NotificationSource = {
  key: SourceKey
  label: string
  icon: LucideIcon
  menuHref: string
  viewAllHref: string
  fetch(prisma: PrismaClient): Promise<Omit<SourceResult, "key">>
}

// Populated by subsequent tasks.
export const SOURCES: NotificationSource[] = []

const HREF_TO_KEY = new Map<string, SourceKey>()
export function registerSource(source: NotificationSource): void {
  SOURCES.push(source)
  HREF_TO_KEY.set(source.menuHref, source.key)
}

export function sourceFor(menuHref: string): SourceKey | undefined {
  return HREF_TO_KEY.get(menuHref)
}
```

- [ ] **Step 2: typecheck**

```bash
npx tsc --noEmit
```

预期：通过。

- [ ] **Step 3: Commit**

```bash
git add lib/admin-notifications/index.ts
git commit -m "feat(admin-notifications): 注册表骨架与类型定义"
```

---

## Task 2: `withdrawals` source

**Files:**
- Create: `lib/admin-notifications/sources/withdrawals.ts`
- Create: `__tests__/lib/admin-notifications/withdrawals.test.ts`
- Modify: `lib/admin-notifications/index.ts`（在末尾 import + 注册）

- [ ] **Step 1: 写失败测试**

`__tests__/lib/admin-notifications/withdrawals.test.ts`：

```ts
import { withdrawalsSource } from "@/lib/admin-notifications/sources/withdrawals"

const findMany = jest.fn()
const count = jest.fn()

const prisma = {
  withdrawal: { findMany, count },
} as unknown as Parameters<typeof withdrawalsSource.fetch>[0]

beforeEach(() => {
  findMany.mockReset()
  count.mockReset()
})

describe("withdrawalsSource", () => {
  it("counts PENDING withdrawals and returns up to 3 latest items with distributor names", async () => {
    count.mockResolvedValue(7)
    findMany.mockResolvedValue([
      { id: "w1", amount: { toString: () => "200" }, createdAt: new Date("2026-05-21T10:00:00Z"), distributor: { name: "张三" } },
      { id: "w2", amount: { toString: () => "80" }, createdAt: new Date("2026-05-21T09:00:00Z"), distributor: { name: "李四" } },
      { id: "w3", amount: { toString: () => "150" }, createdAt: new Date("2026-05-21T08:00:00Z"), distributor: { name: null, email: "wang@example.com" } },
    ])

    const result = await withdrawalsSource.fetch(prisma)

    expect(count).toHaveBeenCalledWith({ where: { status: "PENDING" } })
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "PENDING" },
        take: 3,
        orderBy: { createdAt: "desc" },
      }),
    )
    expect(result.count).toBe(7)
    expect(result.items).toHaveLength(3)
    expect(result.items[0]).toEqual({
      id: "w1",
      distributorName: "张三",
      amount: 200,
      createdAt: "2026-05-21T10:00:00.000Z",
    })
    expect(result.items[2].distributorName).toBe("wang@example.com")
  })

  it("returns empty items when no pending withdrawals", async () => {
    count.mockResolvedValue(0)
    findMany.mockResolvedValue([])
    const result = await withdrawalsSource.fetch(prisma)
    expect(result.count).toBe(0)
    expect(result.items).toEqual([])
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx jest __tests__/lib/admin-notifications/withdrawals.test.ts
```

预期：FAIL（模块不存在）。

- [ ] **Step 3: 实现 source**

`lib/admin-notifications/sources/withdrawals.ts`：

```ts
import { Wallet } from "lucide-react"
import type { NotificationSource } from "@/lib/admin-notifications"

export const withdrawalsSource: NotificationSource = {
  key: "withdrawals",
  label: "提现待审核",
  icon: Wallet,
  menuHref: "/admin/withdrawals",
  viewAllHref: "/admin/withdrawals?status=PENDING",
  async fetch(prisma) {
    const where = { status: "PENDING" as const }
    const [count, rows] = await Promise.all([
      prisma.withdrawal.count({ where }),
      prisma.withdrawal.findMany({
        where,
        take: 3,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          amount: true,
          createdAt: true,
          distributor: { select: { name: true, email: true } },
        },
      }),
    ])

    return {
      count,
      items: rows.map((row) => ({
        id: row.id,
        distributorName: row.distributor.name || row.distributor.email || "未知",
        amount: Number(row.amount),
        createdAt: row.createdAt.toISOString(),
      })),
    }
  },
}
```

- [ ] **Step 4: 在注册表里登记**

`lib/admin-notifications/index.ts` 末尾：

```ts
import { withdrawalsSource } from "./sources/withdrawals"
registerSource(withdrawalsSource)
```

- [ ] **Step 5: 跑测试确认通过**

```bash
npx jest __tests__/lib/admin-notifications/withdrawals.test.ts
```

预期：PASS。

- [ ] **Step 6: Commit**

```bash
git add lib/admin-notifications/ __tests__/lib/admin-notifications/withdrawals.test.ts
git commit -m "feat(admin-notifications): 提现 source"
```

---

## Task 3: `agent-leads` source

**Files:**
- Create: `lib/admin-notifications/sources/agent-leads.ts`
- Create: `__tests__/lib/admin-notifications/agent-leads.test.ts`
- Modify: `lib/admin-notifications/index.ts`

- [ ] **Step 1: 写失败测试**

```ts
// __tests__/lib/admin-notifications/agent-leads.test.ts
import { agentLeadsSource } from "@/lib/admin-notifications/sources/agent-leads"

const findMany = jest.fn()
const count = jest.fn()

const prisma = {
  agentLead: { findMany, count },
} as unknown as Parameters<typeof agentLeadsSource.fetch>[0]

beforeEach(() => {
  findMany.mockReset()
  count.mockReset()
})

describe("agentLeadsSource", () => {
  it("counts NEW + CONTACTED, sorts HIGH urgency first then createdAt desc, take 3", async () => {
    count.mockResolvedValue(4)
    findMany.mockResolvedValue([
      { id: "l1", displayName: "陈", status: "NEW", urgency: "HIGH", createdAt: new Date("2026-05-21T10:00:00Z") },
      { id: "l2", displayName: "Anon", status: "CONTACTED", urgency: "MED", createdAt: new Date("2026-05-21T09:00:00Z") },
      { id: "l3", displayName: "王", status: "NEW", urgency: "LOW", createdAt: new Date("2026-05-21T08:00:00Z") },
    ])

    const result = await agentLeadsSource.fetch(prisma)

    expect(count).toHaveBeenCalledWith({ where: { status: { in: ["NEW", "CONTACTED"] } } })
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { in: ["NEW", "CONTACTED"] } },
        orderBy: { createdAt: "desc" },
      }),
    )
    // Implementation overfetches (take ≥ 3) then sorts by urgency in JS.
    // Prisma enum sort uses string ordering which gets HIGH wrong, so
    // priority is applied at the app layer.
    expect((findMany.mock.calls[0][0] as { take: number }).take).toBeGreaterThanOrEqual(3)
    expect(result.count).toBe(4)
    expect(result.items[0].urgency).toBe("HIGH")
    expect(result.items[0].createdAt).toBe("2026-05-21T10:00:00.000Z")
  })

  it("returns empty items when no actionable leads", async () => {
    count.mockResolvedValue(0)
    findMany.mockResolvedValue([])
    const result = await agentLeadsSource.fetch(prisma)
    expect(result).toEqual({ count: 0, items: [] })
  })

  it("excludes PENDING_CONTACT (matches the 主待办 default filter on /admin/agent/leads)", async () => {
    count.mockResolvedValue(0)
    findMany.mockResolvedValue([])
    await agentLeadsSource.fetch(prisma)
    const where = count.mock.calls[0][0].where
    expect(where.status.in).not.toContain("PENDING_CONTACT")
  })
})
```

> Prisma 对 enum 排序 `urgency: "desc"` 的字典序是 `MED > LOW > HIGH`（按字母），**不正确**。测试通过 mock 不会暴露真实数据库行为。实现里用 SQL CASE / 应用层排序较安全。改为：在 fetch 内先 `findMany take: 9` 拉一批，再 JS 内按 urgency 优先级排序取前 3。下面 Step 3 实现按这个思路。

- [ ] **Step 2: 跑测试确认失败**

```bash
npx jest __tests__/lib/admin-notifications/agent-leads.test.ts
```

预期：FAIL（模块不存在）。

- [ ] **Step 3: 实现 source**

```ts
// lib/admin-notifications/sources/agent-leads.ts
import { UserSearch } from "lucide-react"
import type { NotificationSource, AgentLeadItem } from "@/lib/admin-notifications"

const URGENCY_RANK = { HIGH: 3, MED: 2, LOW: 1 } as const

export const agentLeadsSource: NotificationSource = {
  key: "agentLeads",
  label: "客服跟进",
  icon: UserSearch,
  menuHref: "/admin/agent/leads",
  viewAllHref: "/admin/agent/leads",
  async fetch(prisma) {
    const where = { status: { in: ["NEW", "CONTACTED"] as const } }
    const [count, rows] = await Promise.all([
      prisma.agentLead.count({ where }),
      prisma.agentLead.findMany({
        where,
        take: 9,                          // overfetch for app-layer sort
        orderBy: { createdAt: "desc" },
        select: { id: true, displayName: true, status: true, urgency: true, createdAt: true },
      }),
    ])

    const items: AgentLeadItem[] = rows
      .map((r) => ({
        id: r.id,
        displayName: r.displayName ?? "匿名",
        status: r.status as "NEW" | "CONTACTED",
        urgency: r.urgency as "LOW" | "MED" | "HIGH",
        createdAt: r.createdAt.toISOString(),
      }))
      .sort((a, b) => {
        const byUrgency = URGENCY_RANK[b.urgency] - URGENCY_RANK[a.urgency]
        if (byUrgency !== 0) return byUrgency
        return b.createdAt.localeCompare(a.createdAt)
      })
      .slice(0, 3)

    return { count, items }
  },
}
```

- [ ] **Step 4: 在注册表里登记**

`lib/admin-notifications/index.ts` 末尾：

```ts
import { agentLeadsSource } from "./sources/agent-leads"
registerSource(agentLeadsSource)
```

- [ ] **Step 5: 跑测试确认通过**

```bash
npx jest __tests__/lib/admin-notifications/agent-leads.test.ts
```

预期：PASS。

- [ ] **Step 6: Commit**

```bash
git add lib/admin-notifications/ __tests__/lib/admin-notifications/agent-leads.test.ts
git commit -m "feat(admin-notifications): 客服 lead source（应用层 urgency 排序）"
```

---

## Task 4: `inventory-alerts` source（最复杂）

**Files:**
- Create: `lib/admin-notifications/sources/inventory-alerts.ts`
- Create: `__tests__/lib/admin-notifications/inventory-alerts.test.ts`
- Modify: `lib/admin-notifications/index.ts`

- [ ] **Step 1: 写失败测试**

```ts
// __tests__/lib/admin-notifications/inventory-alerts.test.ts
import { inventoryAlertsSource } from "@/lib/admin-notifications/sources/inventory-alerts"

const productFindMany = jest.fn()
const cardGroupBy = jest.fn()
const subGroupBy = jest.fn()

const prisma = {
  product: { findMany: productFindMany },
  card: { groupBy: cardGroupBy },
  restockSubscription: { groupBy: subGroupBy },
} as unknown as Parameters<typeof inventoryAlertsSource.fetch>[0]

beforeEach(() => {
  productFindMany.mockReset()
  cardGroupBy.mockReset()
  subGroupBy.mockReset()
})

describe("inventoryAlertsSource", () => {
  function setup(opts: {
    products: { id: string; name: string }[]
    unsoldByProduct: Record<string, number>
    subscribersByProduct: Record<string, number>
  }) {
    productFindMany.mockResolvedValue(opts.products)
    cardGroupBy.mockResolvedValue(
      Object.entries(opts.unsoldByProduct).map(([productId, n]) => ({ productId, _count: { id: n } })),
    )
    subGroupBy.mockResolvedValue(
      Object.entries(opts.subscribersByProduct).map(([productId, n]) => ({ productId, _count: { id: n } })),
    )
  }

  it("filters to productType=NORMAL via INVENTORY_PRODUCT_WHERE", async () => {
    setup({ products: [], unsoldByProduct: {}, subscribersByProduct: {} })
    await inventoryAlertsSource.fetch(prisma)
    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productType: "NORMAL", status: "ACTIVE" },
      }),
    )
    expect(cardGroupBy.mock.calls[0][0].where.product).toEqual({ productType: "NORMAL", status: "ACTIVE" })
    expect(subGroupBy.mock.calls[0][0].where.product).toEqual({ productType: "NORMAL", status: "ACTIVE" })
  })

  it("classifies subtype with priority RESTOCK_WAITING > OUT_OF_STOCK > LOW_STOCK", async () => {
    setup({
      products: [
        { id: "p1", name: "缺货+等候" },
        { id: "p2", name: "纯缺货" },
        { id: "p3", name: "低库存" },
        { id: "p4", name: "充足" },
      ],
      unsoldByProduct: { p3: 1, p4: 10 },           // p1, p2 unsold=0
      subscribersByProduct: { p1: 3 },              // 只有 p1 有人等
    })

    const result = await inventoryAlertsSource.fetch(prisma)

    expect(result.count).toBe(3)                    // p4 不计入
    const byId = Object.fromEntries(result.items.map((i) => [i.productId, i]))
    expect(byId.p1.subtype).toBe("RESTOCK_WAITING")
    expect(byId.p2.subtype).toBe("OUT_OF_STOCK")
    expect(byId.p3.subtype).toBe("LOW_STOCK")
    expect(byId.p4).toBeUndefined()
  })

  it("returns breakdown counts (overlapping by design)", async () => {
    setup({
      products: [
        { id: "a", name: "a" }, // unsold=0, subs=2  → RESTOCK_WAITING; outOfStock+restockWaiting+1
        { id: "b", name: "b" }, // unsold=0, subs=0  → OUT_OF_STOCK; outOfStock+1
        { id: "c", name: "c" }, // unsold=1, subs=0  → LOW_STOCK; lowStock+1
      ],
      unsoldByProduct: { c: 1 },
      subscribersByProduct: { a: 2 },
    })

    const result = await inventoryAlertsSource.fetch(prisma)

    expect(result.breakdown).toEqual({ outOfStock: 2, lowStock: 1, restockWaiting: 1 })
    expect(result.count).toBe(3)
  })

  it("sorts items: RESTOCK_WAITING first, then OUT_OF_STOCK, then LOW_STOCK; within group by subscriberCount desc", async () => {
    setup({
      products: [
        { id: "low", name: "low" },
        { id: "out2", name: "out2" },
        { id: "out1", name: "out1" },
        { id: "wait", name: "wait" },
      ],
      unsoldByProduct: { low: 2 },
      subscribersByProduct: { wait: 5, out1: 1, out2: 3 },  // out1/out2 subs > 0 but unsold=0 → wait subtype
    })

    const result = await inventoryAlertsSource.fetch(prisma)
    // wait: subs=5, unsold=0 → RESTOCK_WAITING
    // out2: subs=3, unsold=0 → RESTOCK_WAITING (also has subs)
    // out1: subs=1, unsold=0 → RESTOCK_WAITING (also has subs)
    // low: LOW_STOCK
    expect(result.items.map((i) => i.productId)).toEqual(["wait", "out2", "out1"])
  })

  it("returns zero state with empty items + zero breakdown", async () => {
    setup({ products: [], unsoldByProduct: {}, subscribersByProduct: {} })
    const result = await inventoryAlertsSource.fetch(prisma)
    expect(result).toEqual({ count: 0, breakdown: { outOfStock: 0, lowStock: 0, restockWaiting: 0 }, items: [] })
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npx jest __tests__/lib/admin-notifications/inventory-alerts.test.ts
```

预期：FAIL。

- [ ] **Step 3: 实现 source**

```ts
// lib/admin-notifications/sources/inventory-alerts.ts
import { Package } from "lucide-react"
import type { NotificationSource, InventoryAlertItem } from "@/lib/admin-notifications"
import {
  LOW_STOCK_THRESHOLD,
  resolveInventorySubtype,
  type InventorySubtype,
} from "@/lib/inventory"

const INVENTORY_PRODUCT_WHERE = {
  productType: "NORMAL" as const,
  status: "ACTIVE" as const,
}

const SUBTYPE_RANK: Record<InventorySubtype, number> = {
  RESTOCK_WAITING: 3,
  OUT_OF_STOCK: 2,
  LOW_STOCK: 1,
}

export const inventoryAlertsSource: NotificationSource = {
  key: "inventoryAlerts",
  label: "库存预警",
  icon: Package,
  menuHref: "/admin/products",
  viewAllHref: "/admin/products?notice=inventory",
  async fetch(prisma) {
    const [products, unsoldRows, subRows] = await Promise.all([
      prisma.product.findMany({
        where: INVENTORY_PRODUCT_WHERE,
        select: { id: true, name: true },
      }),
      prisma.card.groupBy({
        by: ["productId"],
        where: { status: "UNSOLD", product: INVENTORY_PRODUCT_WHERE },
        _count: { id: true },
      }),
      prisma.restockSubscription.groupBy({
        by: ["productId"],
        where: { status: "PENDING", product: INVENTORY_PRODUCT_WHERE },
        _count: { id: true },
      }),
    ])

    const unsoldMap = new Map(unsoldRows.map((r) => [r.productId, r._count.id]))
    const subMap = new Map(subRows.map((r) => [r.productId, r._count.id]))

    const items: InventoryAlertItem[] = []
    const breakdown = { outOfStock: 0, lowStock: 0, restockWaiting: 0 }

    for (const p of products) {
      const unsold = unsoldMap.get(p.id) ?? 0
      const subscribers = subMap.get(p.id) ?? 0
      const subtype = resolveInventorySubtype(unsold, subscribers)
      if (!subtype) continue

      items.push({
        productId: p.id,
        productName: p.name,
        unsoldCount: unsold,
        subscriberCount: subscribers,
        subtype,
      })

      if (subtype === "RESTOCK_WAITING") {
        breakdown.outOfStock += 1
        breakdown.restockWaiting += 1
      } else if (subtype === "OUT_OF_STOCK") {
        breakdown.outOfStock += 1
      } else {
        breakdown.lowStock += 1
      }
    }

    items.sort((a, b) => {
      const byRank = SUBTYPE_RANK[b.subtype] - SUBTYPE_RANK[a.subtype]
      if (byRank !== 0) return byRank
      if (b.subscriberCount !== a.subscriberCount) return b.subscriberCount - a.subscriberCount
      return a.unsoldCount - b.unsoldCount
    })

    return {
      count: items.length,
      breakdown,
      items: items.slice(0, 3),
    }
  },
}

export { LOW_STOCK_THRESHOLD }
```

- [ ] **Step 4: 注册**

`lib/admin-notifications/index.ts` 末尾：

```ts
import { inventoryAlertsSource } from "./sources/inventory-alerts"
registerSource(inventoryAlertsSource)
```

- [ ] **Step 5: 跑测试确认通过**

```bash
npx jest __tests__/lib/admin-notifications/inventory-alerts.test.ts
```

预期：PASS。

- [ ] **Step 6: Commit**

```bash
git add lib/admin-notifications/ __tests__/lib/admin-notifications/inventory-alerts.test.ts
git commit -m "feat(admin-notifications): 库存预警 source（缺货/低库存/到货等待合并）"
```

---

## Task 5: 聚合 API `GET /api/admin/notifications`

**Files:**
- Create: `app/api/admin/notifications/route.ts`
- Create: `__tests__/api/admin-notifications.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// __tests__/api/admin-notifications.test.ts
import { GET } from "@/app/api/admin/notifications/route"

jest.mock("@/lib/auth-guard", () => ({
  __esModule: true,
  getAdminSession: jest.fn(),
}))

jest.mock("@/lib/admin-permissions", () => ({
  __esModule: true,
  getAdminPermissions: jest.fn(),
}))

jest.mock("@/lib/admin-notifications", () => {
  const fetchWith = jest.fn(async () => ({ count: 1, items: [] }))
  const fetchAgent = jest.fn(async () => ({ count: 2, items: [] }))
  const fetchInv = jest.fn(async () => ({ count: 3, breakdown: { outOfStock: 1, lowStock: 1, restockWaiting: 1 }, items: [] }))
  return {
    __esModule: true,
    SOURCES: [
      { key: "withdrawals",      menuHref: "/admin/withdrawals",   fetch: fetchWith },
      { key: "agentLeads",       menuHref: "/admin/agent/leads",   fetch: fetchAgent },
      { key: "inventoryAlerts",  menuHref: "/admin/products",      fetch: fetchInv },
    ],
    __fetchSpies: { fetchWith, fetchAgent, fetchInv },
  }
})

const { getAdminSession } = jest.requireMock("@/lib/auth-guard") as { getAdminSession: jest.Mock }
const { getAdminPermissions } = jest.requireMock("@/lib/admin-permissions") as { getAdminPermissions: jest.Mock }
const spies = (jest.requireMock("@/lib/admin-notifications") as { __fetchSpies: Record<string, jest.Mock> }).__fetchSpies

beforeEach(() => {
  getAdminSession.mockReset()
  getAdminPermissions.mockReset()
  Object.values(spies).forEach((s) => s.mockClear())
})

describe("GET /api/admin/notifications", () => {
  it("returns 401 when unauthenticated", async () => {
    getAdminSession.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns all sources when allowedMenus is null (super admin)", async () => {
    getAdminSession.mockResolvedValue({ user: { id: "admin_1" } })
    getAdminPermissions.mockResolvedValue({ allowedMenus: null })
    const res = await GET()
    const body = await res.json()
    expect(body.sources.map((s: { key: string }) => s.key).sort()).toEqual(
      ["agentLeads", "inventoryAlerts", "withdrawals"],
    )
  })

  it("filters sources by allowedMenus", async () => {
    getAdminSession.mockResolvedValue({ user: { id: "admin_2" } })
    getAdminPermissions.mockResolvedValue({ allowedMenus: ["/admin/products"] })
    const res = await GET()
    const body = await res.json()
    expect(body.sources).toHaveLength(1)
    expect(body.sources[0].key).toBe("inventoryAlerts")
    expect(spies.fetchWith).not.toHaveBeenCalled()
    expect(spies.fetchAgent).not.toHaveBeenCalled()
  })

  it("omits a source when its fetch throws (does not 500)", async () => {
    getAdminSession.mockResolvedValue({ user: { id: "admin_1" } })
    getAdminPermissions.mockResolvedValue({ allowedMenus: null })
    spies.fetchWith.mockRejectedValueOnce(new Error("boom"))
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.sources.map((s: { key: string }) => s.key).sort()).toEqual(["agentLeads", "inventoryAlerts"])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npx jest __tests__/api/admin-notifications.test.ts
```

预期：FAIL。

- [ ] **Step 3: 实现 route handler**

```ts
// app/api/admin/notifications/route.ts
import { NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { getAdminPermissions } from "@/lib/admin-permissions"
import { unauthorized } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { SOURCES } from "@/lib/admin-notifications"

export async function GET() {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const perms = await getAdminPermissions()
  const allowed = perms?.allowedMenus ?? null

  const enabled = SOURCES.filter((s) => !allowed || allowed.includes(s.menuHref))

  const results = await Promise.all(
    enabled.map(async (s) => {
      try {
        const result = await s.fetch(prisma)
        return { key: s.key, ...result }
      } catch (err) {
        console.error(`[admin-notifications] source ${s.key} failed`, err)
        return null
      }
    }),
  )

  return NextResponse.json({ sources: results.filter((r) => r !== null) })
}

export const runtime = "nodejs"
```

- [ ] **Step 4: 跑测试确认通过**

```bash
npx jest __tests__/api/admin-notifications.test.ts
```

预期：4 个 case 全 PASS。

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/notifications/ __tests__/api/admin-notifications.test.ts
git commit -m "feat(admin-notifications): 聚合 GET API + allowedMenus 过滤 + 错误回退"
```

---

## Task 6: 前端 hook `useAdminNotifications`

**Files:**
- Create: `app/admin/hooks/use-admin-notifications.ts`

- [ ] **Step 1: 实现 hook**

```ts
// app/admin/hooks/use-admin-notifications.ts
"use client"

import { useQuery } from "@tanstack/react-query"
import type { SourceKey, SourceResult } from "@/lib/admin-notifications"

type Response = { sources: SourceResult[] }

export function useAdminNotifications() {
  const { data, isLoading } = useQuery<Response>({
    queryKey: ["admin", "notifications"],
    queryFn: () => fetch("/api/admin/notifications").then((r) => r.json()),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  })

  const sources = data?.sources ?? []
  const byKey = Object.fromEntries(sources.map((s) => [s.key, s])) as Partial<
    Record<SourceKey, SourceResult>
  >
  const totalCount = sources.reduce((sum, s) => sum + s.count, 0)

  return { sources, byKey, totalCount, isLoading }
}
```

- [ ] **Step 2: typecheck**

```bash
npx tsc --noEmit
```

预期：通过。

- [ ] **Step 3: Commit**

```bash
git add app/admin/hooks/use-admin-notifications.ts
git commit -m "feat(admin-notifications): useAdminNotifications hook"
```

---

## Task 7: `NotificationCenterPopover` 组件

**Files:**
- Create: `app/admin/components/notification-center-popover.tsx`
- Modify: `app/admin/components/index.ts`

- [ ] **Step 1: 写 Popover 主体**

```tsx
// app/admin/components/notification-center-popover.tsx
"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { Bell } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { NotificationBadge } from "./notification-badge"
import { useAdminNotifications } from "@/app/admin/hooks/use-admin-notifications"
import { SOURCES, type SourceResult } from "@/lib/admin-notifications"
import { formatCurrency } from "@/lib/utils"

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return "刚刚"
  if (min < 60) return `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小时前`
  const day = Math.floor(hr / 24)
  return `${day} 天前`
}

function renderItems(source: SourceResult): ReactNode {
  switch (source.key) {
    case "withdrawals":
      return source.items.map((it) => (
        <div key={it.id} className="flex items-center justify-between gap-2 py-1 text-sm">
          <span className="truncate">{it.distributorName} · {formatCurrency(it.amount)}</span>
          <span className="text-muted-foreground tabular-nums shrink-0">{timeAgo(it.createdAt)}</span>
        </div>
      ))
    case "agentLeads":
      return source.items.map((it) => (
        <div key={it.id} className="flex items-center justify-between gap-2 py-1 text-sm">
          <span className="truncate">
            {it.displayName} · {it.status}
            {it.urgency === "HIGH" ? " · 紧急" : ""}
          </span>
          <span className="text-muted-foreground tabular-nums shrink-0">{timeAgo(it.createdAt)}</span>
        </div>
      ))
    case "inventoryAlerts":
      return source.items.map((it) => {
        const label =
          it.subtype === "RESTOCK_WAITING"
            ? `缺货 · ${it.subscriberCount} 人等待`
            : it.subtype === "OUT_OF_STOCK"
              ? "缺货"
              : `低库存（剩 ${it.unsoldCount}）`
        return (
          <div key={it.productId} className="py-1 text-sm">
            <span className="truncate">{it.productName} · {label}</span>
          </div>
        )
      })
  }
}

export function NotificationCenterPopover() {
  const { byKey, totalCount } = useAdminNotifications()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative min-w-9 touch-manipulation"
          aria-label={totalCount > 0 ? `${totalCount} 项待办` : "通知中心"}
        >
          <Bell className="size-4" />
          <NotificationBadge variant="dot" count={totalCount} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="px-4 py-3 border-b">
          <div className="font-medium">通知中心</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {totalCount > 0 ? `你有 ${totalCount} 项待办` : "暂无待办"}
          </div>
        </div>
        <ScrollArea className="max-h-[calc(100vh-12rem)]">
          {totalCount === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              ✨ 暂无待办
            </div>
          ) : (
            SOURCES.map((src, idx) => {
              const data = byKey[src.key]
              if (!data || data.count === 0) return null
              const Icon = src.icon
              const breakdownLine =
                data.key === "inventoryAlerts" ? (
                  <div className="text-xs text-muted-foreground mb-2">
                    {[
                      data.breakdown.outOfStock > 0 ? `${data.breakdown.outOfStock} 款缺货` : null,
                      data.breakdown.lowStock > 0 ? `${data.breakdown.lowStock} 款低库存` : null,
                      data.breakdown.restockWaiting > 0
                        ? `${data.breakdown.restockWaiting} 款等到货提醒`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                ) : null
              return (
                <div key={src.key}>
                  {idx > 0 ? <Separator /> : null}
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Icon className="size-4" />
                        {src.label}
                      </div>
                      <NotificationBadge variant="inline" count={data.count} />
                    </div>
                    {breakdownLine}
                    <div className="space-y-0.5">{renderItems(data)}</div>
                    <Link
                      href={src.viewAllHref}
                      className="mt-2 inline-block text-xs text-primary hover:underline"
                    >
                      查看全部 →
                    </Link>
                  </div>
                </div>
              )
            })
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2: 安装 shadcn `scroll-area`**

仓库当前没有 `components/ui/scroll-area.tsx`，必须先装：

```bash
npx shadcn@latest add scroll-area
```

确认生成后再继续。

- [ ] **Step 3: 在 barrel 导出**

`app/admin/components/index.ts` 末尾追加：

```ts
export { NotificationCenterPopover } from "./notification-center-popover"
```

- [ ] **Step 4: typecheck**

```bash
npx tsc --noEmit
```

预期：通过。

- [ ] **Step 5: Commit**

```bash
git add app/admin/components/notification-center-popover.tsx app/admin/components/index.ts
git commit -m "feat(admin-notifications): NotificationCenterPopover 组件"
```

---

## Task 8: 顶栏 Bell 改为 Popover 触发器

**Files:**
- Modify: `app/components/admin-topbar-actions.tsx`

- [ ] **Step 1: 改写**

把现有 `app/components/admin-topbar-actions.tsx` 替换为：

```tsx
"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { ThemeToggle } from "@/app/components/theme-toggle"
import { TopbarUserMenu } from "@/app/components/topbar-user-menu"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"
import { NotificationCenterPopover } from "@/app/admin/components"

interface AdminTopbarActionsProps {
    name: string
    email: string
}

export function AdminTopbarActions({ name, email }: AdminTopbarActionsProps) {
    const router = useRouter()

    const handleSignOut = async () => {
        await authClient.signOut({
            fetchOptions: {
                onSuccess: () => {
                    router.push("/admin/login")
                },
            },
        })
    }

    const displayName = name || email || "管理员"
    const initial = displayName[0].toUpperCase()

    return (
        <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <NotificationCenterPopover />
            <Button variant="ghost" size="icon" className="min-w-9 touch-manipulation" asChild aria-label="前往商城">
                <Link href="/" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4" />
                </Link>
            </Button>
            <TopbarUserMenu
                initial={initial}
                displayName={displayName}
                subLabel={name ? email : undefined}
                onSignOut={handleSignOut}
            />
        </div>
    )
}
```

- [ ] **Step 2: 在 barrel 增加导出（如未导出过 NotificationCenterPopover）**

确认 `app/admin/components/index.ts` 包含 `NotificationCenterPopover` 导出（Task 7 已做）。

- [ ] **Step 3: typecheck + lint**

```bash
npx tsc --noEmit && npm run lint
```

预期：通过。

- [ ] **Step 4: Commit**

```bash
git add app/components/admin-topbar-actions.tsx
git commit -m "feat(admin-notifications): 顶栏 Bell 改为通知中心 Popover"
```

---

## Task 9: Sidebar 改用 `useAdminNotifications` + 接入 inventoryAlerts

**Files:**
- Modify: `app/components/admin-sidebar.tsx`

不抽通用 component：dot badge 嵌在 icon 的 `<span class="relative">` 内做绝对定位，inline badge 放在 menu item 外层右侧——两段位置不同，单组件无法同时控制。改造目标是用 `badgeFor(href)` 替代硬编码 `isWithdrawals` / `isLeads` 判断，sidebar 不再认识具体的 source key。

- [ ] **Step 1: 替换 import**

`app/components/admin-sidebar.tsx` 顶部：

```tsx
// 删除：
import { usePendingWithdrawals } from "@/app/admin/hooks/use-pending-withdrawals"
import { usePendingLeads } from "@/app/admin/hooks/use-pending-leads"

// 改为：
import { useAdminNotifications } from "@/app/admin/hooks/use-admin-notifications"
import { sourceFor } from "@/lib/admin-notifications"
```

- [ ] **Step 2: 替换 hook 调用 + 加 badgeFor 辅助**

第 104-105 行：

```tsx
// 删除：
const { count: pendingWithdrawals } = usePendingWithdrawals()
const { count: pendingLeads } = usePendingLeads()

// 改为：
const { byKey } = useAdminNotifications()

const badgeFor = (href: string): number => {
  const key = sourceFor(href)
  return key ? (byKey[key]?.count ?? 0) : 0
}
```

- [ ] **Step 3: 改写 navItems 循环**

替换约第 151-183 行 `navItems.map(...)` 整段为：

```tsx
{navItems.map((item) => {
  const badgeCount = badgeFor(item.href)
  return (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton
        asChild
        isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
        tooltip={item.title}
      >
        <Link href={item.href}>
          <span className="relative">
            <item.icon className="size-4 shrink-0" />
            {badgeCount > 0 && (
              <NotificationBadge
                variant="dot"
                count={badgeCount}
                className="hidden group-data-[collapsible=icon]:inline-flex"
              />
            )}
          </span>
          <span>{item.title}</span>
          {badgeCount > 0 && (
            <NotificationBadge
              variant="inline"
              count={badgeCount}
              className="ml-auto group-data-[collapsible=icon]:hidden"
            />
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
})}
```

- [ ] **Step 4: 同样改写 agentItems 循环**

约第 195-227 行 `agentItems.map(...)` 内的 `isLeads` 分支也改为 `badgeFor(item.href)` 通用写法，结构与 Step 3 一致。

- [ ] **Step 5: typecheck + lint**

```bash
npx tsc --noEmit && npm run lint
```

预期：通过。

- [ ] **Step 6: Commit**

```bash
git add app/components/admin-sidebar.tsx
git commit -m "feat(admin-notifications): sidebar badge 改用 useAdminNotifications + 接入 inventoryAlerts"
```

---

## Task 10: Products 页面接受 `?notice=inventory`

**Files:**
- Modify: `app/admin/(main)/products/page.tsx`
- Modify: `app/admin/(main)/products/products-columns.tsx`
- Modify: `app/admin/(main)/products/products-table-wrapper.tsx`
- Modify: `app/admin/(main)/products/products-data-table.tsx`

- [ ] **Step 1: 在 `products-columns.tsx` 扩展 ProductRow 类型**

```ts
export type ProductRow = {
    id: string
    name: string
    slug: string
    status: "ACTIVE" | "INACTIVE"
    productType: string
    price: number
    tags: { id: string; name: string; slug: string }[]
    stock: number
    sales: number
    subscriberCount: number   // 新增
    hasAlert: boolean         // 新增
}
```

并在 `createProductsColumns` 返回的列数组里**追加一个隐藏 column** 用于 filter：

```ts
{
    accessorKey: "hasAlert",
    header: () => null,
    cell: () => null,
    enableHiding: true,
    enableColumnFilter: true,
    enableSorting: false,
    size: 0,
    filterFn: (row, _id, value) => {
        if (value === undefined) return true
        return row.original.hasAlert === Boolean(value)
    },
},
```

- [ ] **Step 2: 改 `products-table-wrapper.tsx` 接受 defaultFilters**

```tsx
"use client"

import dynamic from "next/dynamic"
import type { ProductRow } from "./products-columns"

const ProductsDataTable = dynamic(
    () => import("./products-data-table").then((m) => ({ default: m.ProductsDataTable })),
    { ssr: false }
)

export function ProductsTableWrapper({
    data,
    isSuperAdmin = false,
    defaultFilters,
}: {
    data: ProductRow[]
    isSuperAdmin?: boolean
    defaultFilters?: { hasAlert?: boolean }
}) {
    return <ProductsDataTable data={data} isSuperAdmin={isSuperAdmin} defaultFilters={defaultFilters} />
}
```

- [ ] **Step 3: 改 `products-data-table.tsx` 用 defaultFilters 初始化 columnFilters**

在 `ProductsDataTable` 函数签名加 `defaultFilters` prop，然后修改 `useState<ColumnFiltersState>([])`：

```ts
const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => {
    if (!defaultFilters) return []
    const filters: ColumnFiltersState = []
    if (defaultFilters.hasAlert !== undefined) {
        filters.push({ id: "hasAlert", value: defaultFilters.hasAlert })
    }
    return filters
})
```

并把 hasAlert column 加入 `columnVisibility` 默认隐藏：

```ts
const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    hasAlert: false,
    // ... existing keys
})
```

- [ ] **Step 4: 改 `page.tsx` 查询 + 解析 query**

```tsx
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { getAdminPermissions } from "@/lib/admin-permissions"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { ProductsTableWrapper } from "./products-table-wrapper"
import type { ProductRow } from "./products-columns"
import { PageHeader } from "@/app/admin/components"
import { resolveInventorySubtype } from "@/lib/inventory"

export const dynamic = "force-dynamic"

export default async function AdminProductsPage({
    searchParams,
}: {
    searchParams: Promise<{ notice?: string }>
}) {
    const params = await searchParams
    const perms = await getAdminPermissions()
    const isSuperAdmin = perms?.isSuperAdmin ?? false

    const [products, stockCounts, salesCounts, subCounts] = await Promise.all([
        prisma.product.findMany({
            include: {
                tags: { select: { id: true, name: true, slug: true } },
            },
            orderBy: [{ sortOrder: "asc" }],
        }),
        prisma.card.groupBy({
            by: ["productId"],
            where: { status: "UNSOLD" },
            _count: { id: true },
        }),
        prisma.order.groupBy({
            by: ["productId"],
            where: { status: "COMPLETED" },
            _sum: { quantity: true },
        }),
        prisma.restockSubscription.groupBy({
            by: ["productId"],
            where: { status: "PENDING" },
            _count: { id: true },
        }),
    ])

    const stockMap = new Map(stockCounts.map((s) => [s.productId, s._count.id]))
    const salesMap = new Map(salesCounts.map((s) => [s.productId, s._sum.quantity ?? 0]))
    const subMap = new Map(subCounts.map((s) => [s.productId, s._count.id]))

    const data: ProductRow[] = products.map((p) => {
        const stock = stockMap.get(p.id) ?? 0
        const subscriberCount = subMap.get(p.id) ?? 0
        const isNormalActive = p.productType === "NORMAL" && p.status === "ACTIVE"
        const hasAlert = isNormalActive && resolveInventorySubtype(stock, subscriberCount) !== null
        return {
            id: p.id,
            name: p.name,
            slug: p.slug,
            status: p.status,
            productType: p.productType,
            price: Number(p.price),
            tags: p.tags,
            stock,
            sales: salesMap.get(p.id) ?? 0,
            subscriberCount,
            hasAlert,
        }
    })

    const defaultFilters = params.notice === "inventory" ? { hasAlert: true } : undefined

    return (
        // ... existing JSX, pass defaultFilters={defaultFilters} to ProductsTableWrapper
    )
}
```

> 保留原 JSX 大部分不变，只在 `<ProductsTableWrapper ... />` 添加 `defaultFilters={defaultFilters}` prop。

- [ ] **Step 5: typecheck + lint**

```bash
npx tsc --noEmit && npm run lint
```

- [ ] **Step 6: 手动验证**

启动 `npm run dev`，登录 admin，访问 `/admin/products?notice=inventory`，确认列表默认筛选了 hasAlert=true 的商品；访问 `/admin/products` 确认全量显示。

- [ ] **Step 7: Commit**

```bash
git add app/admin/\(main\)/products/
git commit -m "feat(admin-notifications): products 页面支持 ?notice=inventory 默认筛选预警商品"
```

---

## Task 11: 弃用清理（删除旧 hook / API / 测试）

**Files:**
- Delete: `app/admin/hooks/use-pending-withdrawals.ts`
- Delete: `app/admin/hooks/use-pending-leads.ts`
- Delete: `app/api/admin/withdrawals/count/route.ts`
- Delete: `app/api/admin/agent/leads/count/route.ts`
- Delete: `__tests__/api/admin-agent-leads-count.test.ts`

- [ ] **Step 1: 删除前 grep 全仓库确认无残留调用**

```bash
grep -rn "use-pending-withdrawals\|usePendingWithdrawals\|use-pending-leads\|usePendingLeads\|withdrawals/count\|agent/leads/count" \
  app/ lib/ e2e/ __tests__/ scripts/ 2>/dev/null
```

预期：所有命中都在以下文件内：
- 要删的 4 个源文件本身
- 要删的 1 个测试文件
- 已改写的 `app/components/admin-sidebar.tsx`（如已删除 import 应没有命中）

如有意外命中，**先处理那个文件**，再回到此步。

- [ ] **Step 2: 删除**

```bash
rm app/admin/hooks/use-pending-withdrawals.ts
rm app/admin/hooks/use-pending-leads.ts
rm app/api/admin/withdrawals/count/route.ts
rm app/api/admin/agent/leads/count/route.ts
rm __tests__/api/admin-agent-leads-count.test.ts
```

- [ ] **Step 3: typecheck + lint + 全量测试**

```bash
npx tsc --noEmit
npm run lint
npm test
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(admin-notifications): 删除旧 count API/hook 与对应测试"
```

---

## Task 12: 全量验证

- [ ] **Step 1: 全量 typecheck + lint**

```bash
npm run lint
npx tsc --noEmit
```

预期：通过。

- [ ] **Step 2: 全量单元测试**

```bash
npm test
```

预期：全部通过。

- [ ] **Step 3: 启动 dev 验证关键流程**

```bash
npm run dev
```

打开浏览器：

1. 用 super admin 登录 → 顶栏点击 Bell → Popover 显示 3 个 section
2. 任意一项点 「查看全部」 → 跳转目标页面正确
3. 库存预警 section 显示 breakdown 行（缺货/低/等到货）
4. 侧边栏「提现管理」「人工跟进」「商品管理」三个菜单项都显示 badge
5. 退出登录，用子管理员（仅 `/admin/products` 权限）登录 → Bell Popover 只显示库存预警
6. 把所有 PENDING 提现处理掉、所有 NEW/CONTACTED lead 关掉、所有商品调到正常库存 → Bell 角标消失，Popover 显示「✨ 暂无待办」

- [ ] **Step 4: 报告完成**

确认以上 6 步全部通过后才能宣告完成。如果哪一步失败，回到对应 Task 修复。

---

## 自检小结

实现完成后，对照 spec 检查：

- [x] 「前置改动」：Task 0
- [x] NotificationSource 注册表：Task 1
- [x] 3 个 source 实现：Task 2/3/4
- [x] 聚合 API + allowedMenus 过滤 + 错误回退：Task 5
- [x] 单一 hook：Task 6
- [x] Popover UI（empty state、breakdown、items 渲染）：Task 7
- [x] Bell Trigger：Task 8
- [x] Sidebar 改造 + inventoryAlerts 新 badge：Task 9
- [x] Products 页面 4 处改动：Task 10
- [x] 弃用清理：Task 11
- [x] 全量验证：Task 12
