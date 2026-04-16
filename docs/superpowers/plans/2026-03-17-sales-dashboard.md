# Sales Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive sales panel to the admin dashboard that shows per-product sales quantity, revenue, and profit for a selected date or date range.

**Architecture:** A new `GET /api/admin/sales-report` route queries completed orders and their settled commissions, aggregates by product, and returns the result. A `DashboardSalesPanel` client component manages date state and fetches from that route using TanStack Query. The panel is inserted at the top of the dashboard page above existing sections.

**Tech Stack:** Next.js App Router, Prisma, TanStack Query (`useQuery`), shadcn/ui (`Input`, `Button`, `Card`), `date-fns-tz` (already installed), Jest + `jest-mock-extended` for API tests.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `app/api/admin/sales-report/route.ts` | API: auth, param validation, DB query, aggregation |
| Create | `app/admin/(main)/dashboard/dashboard-sales-panel.tsx` | Client component: date state, fetch, render |
| Modify | `app/admin/(main)/dashboard/page.tsx` | Import and insert `<DashboardSalesPanel />` at top |
| Create | `__tests__/api/admin/sales-report.test.ts` | Unit tests for the API route |

---

## Task 1: API Route — Tests First

**Files:**
- Create: `__tests__/api/admin/sales-report.test.ts`
- Create: `app/api/admin/sales-report/route.ts`

- [ ] **Step 1: Write the failing test file**

Create `__tests__/api/admin/sales-report.test.ts`:

```typescript
import { prismaMock } from "@/__mocks__/prisma"

jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
jest.mock("@/lib/auth-guard", () => ({ getAdminSession: jest.fn() }))

import { getAdminSession } from "@/lib/auth-guard"
import { GET } from "@/app/api/admin/sales-report/route"

const mockSession = { user: { id: "u1", email: "admin@test.com" } }

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/admin/sales-report")
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new Request(url)
}

describe("GET /api/admin/sales-report", () => {
  it("returns 401 when not authenticated", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const res = await GET(makeRequest({ from: "2025-03-17", to: "2025-03-17" }))
    expect(res.status).toBe(401)
  })

  it("returns 400 when from param is missing", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const res = await GET(makeRequest({ to: "2025-03-17" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when to param is missing", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const res = await GET(makeRequest({ from: "2025-03-17" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when from > to", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const res = await GET(makeRequest({ from: "2025-03-18", to: "2025-03-17" }))
    expect(res.status).toBe(400)
  })

  it("returns empty data when no orders in range", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.order.findMany.mockResolvedValue([])
    const res = await GET(makeRequest({ from: "2025-03-17", to: "2025-03-17" }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.summary).toEqual({ orderCount: 0, totalQuantity: 0, revenue: 0, profit: 0 })
    expect(body.products).toEqual([])
  })

  it("aggregates orders by product with commissions", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)

    prismaMock.order.findMany.mockResolvedValue([
      {
        id: "o1",
        productId: "p1",
        productNameSnapshot: "王者荣耀点券",
        quantity: 2,
        amount: "129.60" as any,
        product: { name: "王者荣耀点券" },
      },
      {
        id: "o2",
        productId: "p1",
        productNameSnapshot: "王者荣耀点券",
        quantity: 1,
        amount: "64.80" as any,
        product: { name: "王者荣耀点券" },
      },
      {
        id: "o3",
        productId: "p2",
        productNameSnapshot: null,
        quantity: 1,
        amount: "38.00" as any,
        product: { name: "网易云会员" },
      },
    ] as any)

    // commissions: only o1 has a settled commission
    prismaMock.commission.groupBy.mockResolvedValue([
      { orderId: "o1", _sum: { amount: "13.00" as any } },
    ] as any)

    const res = await GET(makeRequest({ from: "2025-03-17", to: "2025-03-17" }))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.summary.orderCount).toBe(3)
    expect(body.summary.totalQuantity).toBe(4)
    expect(body.summary.revenue).toBeCloseTo(232.4, 2)
    expect(body.summary.profit).toBeCloseTo(219.4, 2)

    const p1 = body.products.find((p: any) => p.productId === "p1")
    expect(p1.productName).toBe("王者荣耀点券")
    expect(p1.quantity).toBe(3)
    expect(p1.revenue).toBeCloseTo(194.4, 2)
    expect(p1.commission).toBeCloseTo(13, 2)
    expect(p1.profit).toBeCloseTo(181.4, 2)
    expect(p1.avgPrice).toBeCloseTo(64.8, 2)

    const p2 = body.products.find((p: any) => p.productId === "p2")
    expect(p2.productName).toBe("网易云会员")
    expect(p2.quantity).toBe(1)
    expect(p2.revenue).toBeCloseTo(38, 2)
    expect(p2.commission).toBe(0)
    expect(p2.profit).toBeCloseTo(38, 2)
  })

  it("sorts products by profit descending", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.order.findMany.mockResolvedValue([
      { id: "o1", productId: "p1", productNameSnapshot: "A", quantity: 1, amount: "10.00" as any, product: { name: "A" } },
      { id: "o2", productId: "p2", productNameSnapshot: "B", quantity: 1, amount: "50.00" as any, product: { name: "B" } },
    ] as any)
    prismaMock.commission.groupBy.mockResolvedValue([])

    const res = await GET(makeRequest({ from: "2025-03-17", to: "2025-03-17" }))
    const body = await res.json()
    expect(body.products[0].productId).toBe("p2") // higher profit first
    expect(body.products[1].productId).toBe("p1")
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail (route doesn't exist yet)**

```bash
npx jest __tests__/api/admin/sales-report.test.ts --no-coverage
```

Expected: All tests fail with "Cannot find module" or similar.

- [ ] **Step 3: Implement the API route**

Create `app/api/admin/sales-report/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, badRequest } from "@/lib/api-response"
import { fromZonedTime } from "date-fns-tz"

const HKT = "Asia/Hong_Kong"
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function parseHKTRange(from: string, to: string): { startUTC: Date; endUTC: Date } {
  const [fy, fm, fd] = from.split("-").map(Number)
  const [ty, tm, td] = to.split("-").map(Number)
  const startUTC = fromZonedTime(new Date(fy, fm - 1, fd, 0, 0, 0, 0), HKT)
  // next day 00:00 HKT → exclusive upper bound
  const endUTC = fromZonedTime(new Date(ty, tm - 1, td + 1, 0, 0, 0, 0), HKT)
  return { startUTC, endUTC }
}

export type SalesReportProduct = {
  productId: string
  productName: string
  quantity: number
  avgPrice: number
  revenue: number
  commission: number
  profit: number
}

export type SalesReportResponse = {
  summary: {
    orderCount: number
    totalQuantity: number
    revenue: number
    profit: number
  }
  products: SalesReportProduct[]
}

export async function GET(request: Request): Promise<NextResponse> {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { searchParams } = new URL(request.url)
  const from = searchParams.get("from") ?? ""
  const to = searchParams.get("to") ?? ""

  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return badRequest("from and to must be YYYY-MM-DD")
  }
  if (from > to) {
    return badRequest("from must not be after to")
  }

  const { startUTC, endUTC } = parseHKTRange(from, to)

  const orders = await prisma.order.findMany({
    where: { status: "COMPLETED", paidAt: { gte: startUTC, lt: endUTC } },
    select: {
      id: true,
      productId: true,
      productNameSnapshot: true,
      quantity: true,
      amount: true,
      product: { select: { name: true } },
    },
  })

  if (orders.length === 0) {
    return NextResponse.json<SalesReportResponse>({
      summary: { orderCount: 0, totalQuantity: 0, revenue: 0, profit: 0 },
      products: [],
    })
  }

  const orderIds = orders.map((o) => o.id)
  const commissionRows = await prisma.commission.groupBy({
    by: ["orderId"],
    where: { orderId: { in: orderIds }, status: "SETTLED" },
    _sum: { amount: true },
  })

  const commissionByOrder = new Map<string, number>()
  for (const row of commissionRows) {
    commissionByOrder.set(row.orderId, Number(row._sum.amount ?? 0))
  }

  // Aggregate by product
  const productMap = new Map<
    string,
    { productName: string; quantity: number; revenue: number; commission: number }
  >()

  for (const order of orders) {
    const existing = productMap.get(order.productId)
    const name = order.productNameSnapshot ?? order.product.name
    const revenue = Number(order.amount)
    const commission = commissionByOrder.get(order.id) ?? 0
    if (existing) {
      existing.quantity += order.quantity
      existing.revenue += revenue
      existing.commission += commission
    } else {
      productMap.set(order.productId, {
        productName: name,
        quantity: order.quantity,
        revenue,
        commission,
      })
    }
  }

  const products: SalesReportProduct[] = Array.from(productMap.entries())
    .map(([productId, data]) => ({
      productId,
      productName: data.productName,
      quantity: data.quantity,
      avgPrice: data.quantity > 0 ? data.revenue / data.quantity : 0,
      revenue: data.revenue,
      commission: data.commission,
      profit: data.revenue - data.commission,
    }))
    .sort((a, b) => b.profit - a.profit)

  const totalRevenue = products.reduce((s, p) => s + p.revenue, 0)
  const totalCommission = products.reduce((s, p) => s + p.commission, 0)

  return NextResponse.json<SalesReportResponse>({
    summary: {
      orderCount: orders.length,
      totalQuantity: products.reduce((s, p) => s + p.quantity, 0),
      revenue: totalRevenue,
      profit: totalRevenue - totalCommission,
    },
    products,
  })
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest __tests__/api/admin/sales-report.test.ts --no-coverage
```

Expected: All 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/sales-report/route.ts __tests__/api/admin/sales-report.test.ts
git commit -m "feat(sales-report): add admin sales report API with tests"
```

---

## Task 2: Client Component

**Files:**
- Create: `app/admin/(main)/dashboard/dashboard-sales-panel.tsx`

- [ ] **Step 1: Create the client component**

Create `app/admin/(main)/dashboard/dashboard-sales-panel.tsx`:

```typescript
"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"
import type { SalesReportResponse } from "@/app/api/admin/sales-report/route"

// en-CA locale produces ISO YYYY-MM-DD format
function todayHKT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" })
}

function offsetDaysHKT(days: number): string {
  const d = new Date()
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000)
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" })
}

function mondayOfCurrentWeekHKT(): string {
  const nowHKT = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Hong_Kong" })
  )
  const day = nowHKT.getDay() // 0=Sun,1=Mon,...
  const diff = day === 0 ? -6 : 1 - day
  return offsetDaysHKT(diff)
}

function firstDayOfMonthHKT(): string {
  const nowHKT = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Hong_Kong" })
  )
  const y = nowHKT.getFullYear()
  const m = String(nowHKT.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}-01`
}

async function fetchSalesReport(from: string, to: string): Promise<SalesReportResponse> {
  const res = await fetch(`/api/admin/sales-report?from=${from}&to=${to}`)
  if (!res.ok) throw new Error("加载失败")
  return res.json()
}

export function DashboardSalesPanel() {
  const today = todayHKT()
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)

  const { data, isLoading, isError } = useQuery<SalesReportResponse>({
    queryKey: ["sales-report", from, to],
    queryFn: () => fetchSalesReport(from, to),
    staleTime: 30_000,
  })

  const summary = data?.summary
  const products = data?.products ?? []

  const totalRevenue = products.reduce((s, p) => s + p.revenue, 0)
  const totalQuantity = products.reduce((s, p) => s + p.quantity, 0)
  const totalCommission = products.reduce((s, p) => s + p.commission, 0)
  const totalProfit = products.reduce((s, p) => s + p.profit, 0)

  return (
    <section aria-label="销售看板">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        销售看板
      </h3>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base sm:text-lg">按商品销售明细</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { label: "今日", from: today, to: today },
                { label: "昨日", from: offsetDaysHKT(-1), to: offsetDaysHKT(-1) },
                { label: "本周", from: mondayOfCurrentWeekHKT(), to: today },
                { label: "本月", from: firstDayOfMonthHKT(), to: today },
              ].map((preset) => (
                <Button
                  key={preset.label}
                  variant={from === preset.from && to === preset.to ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setFrom(preset.from)
                    setTo(preset.to)
                  }}
                >
                  {preset.label}
                </Button>
              ))}
              <Input
                type="date"
                value={from}
                max={to}
                className="h-7 w-36 text-xs"
                onChange={(e) => {
                  if (e.target.value <= to) setFrom(e.target.value)
                }}
              />
              <span className="text-xs text-muted-foreground">至</span>
              <Input
                type="date"
                value={to}
                min={from}
                max={today}
                className="h-7 w-36 text-xs"
                onChange={(e) => {
                  if (e.target.value >= from) setTo(e.target.value)
                }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary KPI row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))
            ) : (
              <>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">总订单</p>
                  <p className="mt-1 text-xl font-bold">{summary?.orderCount ?? 0}</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">总销量（卡密）</p>
                  <p className="mt-1 text-xl font-bold">{totalQuantity}</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">总营收</p>
                  <p className="mt-1 text-xl font-bold">{formatCurrency(summary?.revenue ?? 0)}</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">总利润</p>
                  <p className="mt-1 text-xl font-bold text-green-600">
                    {formatCurrency(summary?.profit ?? 0)}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Product table */}
          {isLoading ? (
            <Skeleton className="h-32 w-full rounded-lg" />
          ) : isError ? (
            <p className="py-6 text-center text-sm text-muted-foreground">加载失败，请稍后重试</p>
          ) : products.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">该时段暂无已完成订单</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">商品</th>
                    <th className="px-3 py-2 text-right font-medium">销量</th>
                    <th className="px-3 py-2 text-right font-medium">均价</th>
                    <th className="px-3 py-2 text-right font-medium">营收</th>
                    <th className="px-3 py-2 text-right font-medium">已结算佣金</th>
                    <th className="px-3 py-2 text-right font-medium">利润</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.productId} className="border-b last:border-0">
                      <td className="max-w-[180px] truncate px-3 py-2">{p.productName}</td>
                      <td className="px-3 py-2 text-right">{p.quantity}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(p.avgPrice)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(p.revenue)}</td>
                      <td className="px-3 py-2 text-right text-amber-600">
                        {formatCurrency(p.commission)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-green-600">
                        {formatCurrency(p.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/30 font-semibold">
                    <td className="px-3 py-2">合计</td>
                    <td className="px-3 py-2 text-right">{totalQuantity}</td>
                    <td className="px-3 py-2 text-right">—</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(totalRevenue)}</td>
                    <td className="px-3 py-2 text-right text-amber-600">
                      {formatCurrency(totalCommission)}
                    </td>
                    <td className="px-3 py-2 text-right text-green-600">
                      {formatCurrency(totalProfit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "sales-panel\|sales-report" | head -20
```

Expected: No errors for these files.

- [ ] **Step 3: Commit**

```bash
git add app/admin/(main)/dashboard/dashboard-sales-panel.tsx
git commit -m "feat(dashboard): add DashboardSalesPanel client component"
```

---

## Task 3: Wire into Dashboard Page

**Files:**
- Modify: `app/admin/(main)/dashboard/page.tsx`

- [ ] **Step 1: Add the import and insert the component**

In `app/admin/(main)/dashboard/page.tsx`, add the import after the existing imports:

```typescript
import { DashboardSalesPanel } from "./dashboard-sales-panel"
```

Then in the JSX, inside `<div className="space-y-6">`, insert `<DashboardSalesPanel />` as the first child, before the `{/* 第一层：财务核心 */}` section comment:

```tsx
return (
  <div className="space-y-6">
    <PageHeader title="概览" description={`欢迎使用 ${config.siteName} ${config.adminPanelLabel}`} />

    <DashboardSalesPanel />

    {/* 第一层：财务核心 */}
    <section className="min-w-0" aria-label="财务核心指标">
    ...
```

- [ ] **Step 2: Run the dev server and verify**

```bash
npm run dev
```

Open `http://localhost:3000/admin/dashboard`. Confirm:
- "销售看板" section appears at the top
- "今日" button is pre-selected
- KPI cards show today's data (or "0" if no orders today)
- Switching to "本月" loads monthly data
- Custom date range inputs work and update the table

- [ ] **Step 3: Run full test suite to confirm nothing broken**

```bash
npm test -- --passWithNoTests --no-coverage 2>&1 | tail -20
```

Expected: All tests pass, no regressions.

- [ ] **Step 4: Commit**

```bash
git add app/admin/(main)/dashboard/page.tsx
git commit -m "feat(dashboard): wire DashboardSalesPanel into dashboard page"
```
