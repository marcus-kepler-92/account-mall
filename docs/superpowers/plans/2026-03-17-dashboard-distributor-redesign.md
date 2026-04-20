# Dashboard Distributor Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增分销员看板 section，同时删除与销售看板重叠的 KPI 区块和低价值的订单状态分布饼图。

**Architecture:** 新增 `GET /api/admin/distributor-report` 端点（同 `sales-report` 模式），新建 `DashboardDistributorPanel` client component（同 `DashboardSalesPanel` 模式）。`page.tsx` 删除"财务核心"、"运营效率"、"待办事项"三个 section 和订单状态分布饼图，插入 `DashboardDistributorPanel`。最后清理 `dashboard-data.ts` / `types.ts` / 测试文件中已无引用的代码。

**Tech Stack:** Next.js 16 App Router, TanStack Query, Prisma, date-fns-tz, Jest + jest-mock-extended

---

## File Map

| 操作 | 路径 |
|------|------|
| Create | `app/api/admin/distributor-report/route.ts` |
| Create | `__tests__/api/admin/distributor-report/route.test.ts` |
| Create | `app/admin/(main)/dashboard/dashboard-distributor-panel.tsx` |
| Modify | `app/admin/(main)/dashboard/page.tsx` |
| Modify | `app/admin/(main)/dashboard/dashboard-data.ts` |
| Modify | `app/admin/(main)/dashboard/types.ts` |
| Modify | `app/admin/(main)/dashboard/dashboard-charts.tsx` |
| Modify | `__tests__/admin/dashboard-data.test.ts` |
| Delete | `app/admin/(main)/dashboard/dashboard-order-status-chart.tsx` |

---

## Task 1: Create `/api/admin/distributor-report` route + tests

**Files:**
- Create: `app/api/admin/distributor-report/route.ts`
- Create: `__tests__/api/admin/distributor-report/route.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/api/admin/distributor-report/route.test.ts
import { prismaMock } from "@/__mocks__/prisma"

jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
jest.mock("@/lib/auth-guard", () => ({ getAdminSession: jest.fn() }))

import { getAdminSession } from "@/lib/auth-guard"
import { GET } from "@/app/api/admin/distributor-report/route"

const mockSession = { user: { id: "u1", email: "admin@test.com" } }

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/admin/distributor-report")
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new Request(url)
}

const zeroWithdrawalAgg = {
  _count: { id: 0 },
  _sum: { amount: null },
  _avg: null, _min: null, _max: null,
} as any
const zeroCommissionAgg = {
  _sum: { amount: null },
  _count: { id: 0 },
  _avg: null, _min: null, _max: null,
} as any

describe("GET /api/admin/distributor-report", () => {
  it("returns 401 when not authenticated", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const res = await GET(makeRequest({ from: "2026-03-01", to: "2026-03-17" }))
    expect(res.status).toBe(401)
  })

  it("returns 400 when from is missing", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const res = await GET(makeRequest({ to: "2026-03-17" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when to is missing", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const res = await GET(makeRequest({ from: "2026-03-01" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when from > to", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const res = await GET(makeRequest({ from: "2026-03-17", to: "2026-03-01" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when from is not a valid date", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const res = await GET(makeRequest({ from: "2026-02-30", to: "2026-03-17" }))
    expect(res.status).toBe(400)
  })

  it("returns empty leaderboard when no distributor orders", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.withdrawal.aggregate.mockResolvedValueOnce(zeroWithdrawalAgg)
    prismaMock.commission.aggregate
      .mockResolvedValueOnce(zeroCommissionAgg)   // pendingCommissionAmount
      .mockResolvedValueOnce(zeroCommissionAgg)   // monthlySettledCommission
    prismaMock.user.count.mockResolvedValueOnce(5)
    prismaMock.order.groupBy.mockResolvedValueOnce([])

    const res = await GET(makeRequest({ from: "2026-03-01", to: "2026-03-17" }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.summary.distributorCount).toBe(5)
    expect(body.summary.pendingWithdrawalCount).toBe(0)
    expect(body.leaderboard).toEqual([])
  })

  it("returns leaderboard sorted by revenue with pending commission", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.withdrawal.aggregate.mockResolvedValueOnce({
      _count: { id: 2 },
      _sum: { amount: "500.00" },
      _avg: null, _min: null, _max: null,
    } as any)
    prismaMock.commission.aggregate
      .mockResolvedValueOnce({
        _sum: { amount: "300.00" },
        _count: { id: 0 }, _avg: null, _min: null, _max: null,
      } as any)  // pendingCommissionAmount
      .mockResolvedValueOnce({
        _sum: { amount: "150.00" },
        _count: { id: 0 }, _avg: null, _min: null, _max: null,
      } as any)  // monthlySettledCommission
    prismaMock.user.count.mockResolvedValueOnce(3)
    prismaMock.order.groupBy.mockResolvedValueOnce([
      { distributorId: "d1", _sum: { amount: "2000.00" }, _count: { id: 10 } } as any,
      { distributorId: "d2", _sum: { amount: "800.00" }, _count: { id: 4 } } as any,
    ])
    prismaMock.user.findMany.mockResolvedValueOnce([
      { id: "d1", name: "Alice", email: "alice@test.com" } as any,
      { id: "d2", name: null, email: "bob@test.com" } as any,
    ])
    prismaMock.commission.groupBy.mockResolvedValueOnce([
      { distributorId: "d1", _sum: { amount: "60.00" } } as any,
    ])

    const res = await GET(makeRequest({ from: "2026-03-01", to: "2026-03-17" }))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.summary.pendingWithdrawalCount).toBe(2)
    expect(body.summary.pendingWithdrawalAmount).toBe(500)
    expect(body.summary.pendingCommissionAmount).toBe(300)
    expect(body.summary.monthlySettledCommission).toBe(150)
    expect(body.summary.distributorCount).toBe(3)

    expect(body.leaderboard).toHaveLength(2)
    expect(body.leaderboard[0].distributorId).toBe("d1")
    expect(body.leaderboard[0].revenue).toBe(2000)
    expect(body.leaderboard[0].orderCount).toBe(10)
    expect(body.leaderboard[0].pendingCommission).toBe(60)
    expect(body.leaderboard[0].name).toBe("Alice")
    expect(body.leaderboard[1].distributorId).toBe("d2")
    expect(body.leaderboard[1].pendingCommission).toBe(0)  // no pending commission
    expect(body.leaderboard[1].name).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/api/admin/distributor-report/route.test.ts --no-coverage
```

Expected: FAIL — module not found or similar.

- [ ] **Step 3: Create the route handler**

```typescript
// app/api/admin/distributor-report/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, badRequest } from "@/lib/api-response"
import { fromZonedTime } from "date-fns-tz"

const HKT = "Asia/Hong_Kong"
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidCalendarDate(y: number, m: number, d: number): boolean {
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

export type DistributorReportResponse = {
  summary: {
    pendingWithdrawalCount: number
    pendingWithdrawalAmount: number
    pendingCommissionAmount: number
    monthlySettledCommission: number
    distributorCount: number
  }
  leaderboard: Array<{
    distributorId: string
    name: string | null
    email: string
    revenue: number
    orderCount: number
    pendingCommission: number
  }>
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

  const [fy, fm, fd] = from.split("-").map(Number)
  const [ty, tm, td] = to.split("-").map(Number)
  if (!isValidCalendarDate(fy, fm, fd) || !isValidCalendarDate(ty, tm, td)) {
    return badRequest("from and to must be valid calendar dates")
  }

  // Convert HKT date range to UTC for Prisma queries
  const startUTC = fromZonedTime(new Date(fy, fm - 1, fd, 0, 0, 0, 0), HKT)
  const endUTC = fromZonedTime(new Date(ty, tm - 1, td + 1, 0, 0, 0, 0), HKT)

  // First day of current month in HKT → UTC
  const nowHKTStr = new Date().toLocaleDateString("en-CA", { timeZone: HKT })
  const [ny, nm] = nowHKTStr.split("-").map(Number)
  const firstDayOfMonthUTC = fromZonedTime(new Date(ny, nm - 1, 1, 0, 0, 0, 0), HKT)

  const [
    pendingWithdrawalAgg,
    pendingCommissionAgg,
    distributorCount,
    monthlySettledCommissionAgg,
    ordersByDistributor,
  ] = await Promise.all([
    prisma.withdrawal.aggregate({
      where: { status: "PENDING" },
      _count: { id: true },
      _sum: { amount: true },
    }),
    prisma.commission.aggregate({
      where: { status: "PENDING" },
      _sum: { amount: true },
    }),
    prisma.user.count({ where: { role: "DISTRIBUTOR" } }),
    prisma.commission.aggregate({
      where: { status: "SETTLED", createdAt: { gte: firstDayOfMonthUTC } },
      _sum: { amount: true },
    }),
    prisma.order.groupBy({
      by: ["distributorId"],
      where: {
        status: "COMPLETED",
        distributorId: { not: null },
        paidAt: { gte: startUTC, lt: endUTC },
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
  ])

  const distributorIds = ordersByDistributor.map((r) => r.distributorId as string)

  const [distributors, pendingCommissions] =
    distributorIds.length > 0
      ? await Promise.all([
          prisma.user.findMany({
            where: { id: { in: distributorIds } },
            select: { id: true, name: true, email: true },
          }),
          prisma.commission.groupBy({
            by: ["distributorId"],
            where: { distributorId: { in: distributorIds }, status: "PENDING" },
            _sum: { amount: true },
          }),
        ])
      : ([] as [typeof distributors, typeof pendingCommissions])

  const nameMap = new Map(distributors.map((d) => [d.id, { name: d.name, email: d.email }]))
  const pendingCommissionMap = new Map(
    pendingCommissions.map((c) => [c.distributorId, Number(c._sum.amount ?? 0)])
  )

  const leaderboard = ordersByDistributor
    .map((r) => {
      const info = nameMap.get(r.distributorId as string)
      return {
        distributorId: r.distributorId as string,
        name: info?.name ?? null,
        email: info?.email ?? "",
        revenue: Number(r._sum.amount ?? 0),
        orderCount: r._count.id,
        pendingCommission: pendingCommissionMap.get(r.distributorId as string) ?? 0,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)

  return NextResponse.json<DistributorReportResponse>({
    summary: {
      pendingWithdrawalCount: pendingWithdrawalAgg._count.id,
      pendingWithdrawalAmount: Number(pendingWithdrawalAgg._sum.amount ?? 0),
      pendingCommissionAmount: Number(pendingCommissionAgg._sum.amount ?? 0),
      monthlySettledCommission: Number(monthlySettledCommissionAgg._sum.amount ?? 0),
      distributorCount,
    },
    leaderboard,
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/api/admin/distributor-report/route.test.ts --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/distributor-report/route.ts __tests__/api/admin/distributor-report/route.test.ts
git commit -m "feat(dashboard): add distributor-report API endpoint"
```

---

## Task 2: Create `DashboardDistributorPanel` component

**Files:**
- Create: `app/admin/(main)/dashboard/dashboard-distributor-panel.tsx`

- [ ] **Step 1: Create the component**

```typescript
// app/admin/(main)/dashboard/dashboard-distributor-panel.tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"
import { Wallet, TrendingDown, BadgeDollarSign, Users } from "lucide-react"
import type { DistributorReportResponse } from "@/app/api/admin/distributor-report/route"

const HKT_TZ = "Asia/Hong_Kong"

function todayHKT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: HKT_TZ })
}

function offsetDaysHKT(days: number): string {
  const d = new Date()
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000)
  return d.toLocaleDateString("en-CA", { timeZone: HKT_TZ })
}

function firstDayOfMonthHKT(): string {
  return todayHKT().slice(0, 8) + "01"
}

async function fetchDistributorReport(from: string, to: string): Promise<DistributorReportResponse> {
  const res = await fetch(`/api/admin/distributor-report?from=${from}&to=${to}`)
  if (!res.ok) throw new Error("加载失败")
  return res.json()
}

export function DashboardDistributorPanel() {
  const today = todayHKT()
  const defaultFrom = offsetDaysHKT(-6)
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(today)

  const { data, isLoading, isError } = useQuery<DistributorReportResponse>({
    queryKey: ["distributor-report", from, to],
    queryFn: () => fetchDistributorReport(from, to),
    staleTime: 30_000,
  })

  const summary = data?.summary
  const leaderboard = data?.leaderboard ?? []

  const presets = [
    { label: "近7天", from: offsetDaysHKT(-6), to: today },
    { label: "近30天", from: offsetDaysHKT(-29), to: today },
    { label: "本月", from: firstDayOfMonthHKT(), to: today },
  ]

  return (
    <section aria-label="分销员看板">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        分销员看板
      </h3>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base sm:text-lg">分销员数据</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {presets.map((preset) => (
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
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* KPI row — always reflects current state, not time-range */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))
            ) : (
              <>
                <Link href="/admin/withdrawals?status=PENDING" className="block h-full">
                  <div className="h-full cursor-pointer rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50">
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Wallet className="size-3" /> 待处理提现
                    </p>
                    <p className="mt-1 text-lg font-bold">
                      {summary?.pendingWithdrawalCount ?? 0} 笔
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(summary?.pendingWithdrawalAmount ?? 0)}
                    </p>
                  </div>
                </Link>
                <Link href="/admin/distributors" className="block h-full">
                  <div className="h-full cursor-pointer rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50">
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <TrendingDown className="size-3" /> 待结算佣金
                    </p>
                    <p className="mt-1 text-lg font-bold text-amber-600">
                      {formatCurrency(summary?.pendingCommissionAmount ?? 0)}
                    </p>
                  </div>
                </Link>
                <Link href="/admin/distributors" className="block h-full">
                  <div className="h-full cursor-pointer rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50">
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <BadgeDollarSign className="size-3" /> 本月已结佣金
                    </p>
                    <p className="mt-1 text-lg font-bold">
                      {formatCurrency(summary?.monthlySettledCommission ?? 0)}
                    </p>
                  </div>
                </Link>
                <Link href="/admin/distributors" className="block h-full">
                  <div className="h-full cursor-pointer rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50">
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="size-3" /> 分销员
                    </p>
                    <p className="mt-1 text-lg font-bold">
                      {summary?.distributorCount ?? 0} 人
                    </p>
                  </div>
                </Link>
              </>
            )}
          </div>

          {/* Leaderboard */}
          {isLoading ? (
            <Skeleton className="h-32 w-full rounded-lg" />
          ) : isError ? (
            <p className="py-6 text-center text-sm text-muted-foreground">加载失败，请稍后重试</p>
          ) : leaderboard.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">该时段暂无分销成交记录</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">排名</th>
                    <th className="px-3 py-2 text-left font-medium">分销员</th>
                    <th className="px-3 py-2 text-right font-medium">贡献营收</th>
                    <th className="px-3 py-2 text-right font-medium">订单数</th>
                    <th className="px-3 py-2 text-right font-medium">待结算佣金</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((d, i) => (
                    <tr key={d.distributorId} className="border-b last:border-0">
                      <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2">
                        <span className="font-medium">{d.name ?? d.email}</span>
                        {d.name && (
                          <span className="ml-1 text-xs text-muted-foreground">{d.email}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {formatCurrency(d.revenue)}
                      </td>
                      <td className="px-3 py-2 text-right">{d.orderCount}</td>
                      <td className="px-3 py-2 text-right text-amber-600">
                        {formatCurrency(d.pendingCommission)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors from the new file.

- [ ] **Step 3: Commit**

```bash
git add app/admin/(main)/dashboard/dashboard-distributor-panel.tsx
git commit -m "feat(dashboard): add DashboardDistributorPanel component"
```

---

## Task 3: Refactor `page.tsx`

**Files:**
- Modify: `app/admin/(main)/dashboard/page.tsx`

Remove "财务核心"、"运营效率"、"待办事项" 三个 section，移除订单状态分布图（`DashboardOrderStatusChart`），将趋势图与商品表现并排，插入 `DashboardDistributorPanel`。

- [ ] **Step 1: Replace page.tsx**

```typescript
// app/admin/(main)/dashboard/page.tsx
import Link from "next/link"
import { formatDateTimeShort } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getDashboardData } from "./dashboard-data"
import { ORDER_STATUS_LABEL } from "./types"
import { DashboardInventoryAlerts } from "./dashboard-inventory-alerts"
import { DashboardRestockPending } from "./dashboard-restock-pending"
import { DashboardTrendSection, DashboardTopProductsChart } from "./dashboard-charts"
import { DashboardSalesPanel } from "./dashboard-sales-panel"
import { DashboardDistributorPanel } from "./dashboard-distributor-panel"
import { config } from "@/lib/config"
import { PageHeader } from "@/app/admin/components"

export const dynamic = "force-dynamic"

const cardGrid = "grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-[repeat(2,minmax(0,1fr))]"

export default async function AdminDashboardPage() {
  const data = await getDashboardData()
  const { trend7, trend30, topProducts, inventory, restockPending, recentOrders } = data

  return (
    <div className="space-y-6">
      <PageHeader title="概览" description={`欢迎使用 ${config.siteName} ${config.adminPanelLabel}`} />

      <DashboardSalesPanel />

      <DashboardDistributorPanel />

      <section className={`min-w-0 ${cardGrid}`} aria-label="趋势与商品">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">近 7 / 30 日趋势</CardTitle>
            <CardDescription>订单数与营收</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <DashboardTrendSection trend7={trend7} trend30={trend30} />
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">商品表现 Top 8</CardTitle>
            <CardDescription>按营收排序</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <DashboardTopProductsChart data={topProducts} />
          </CardContent>
        </Card>
      </section>

      <section className={`min-w-0 ${cardGrid}`} aria-label="库存与补货">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">库存预警</CardTitle>
            <CardDescription>各商品未售出卡密数量</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <DashboardInventoryAlerts data={inventory} />
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">待通知补货提醒</CardTitle>
            <CardDescription>缺货商品的订阅人数</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <DashboardRestockPending data={restockPending} />
          </CardContent>
        </Card>
      </section>

      <section className="min-w-0" aria-label="最近订单">
        <Card className="min-w-0">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg">最近订单</CardTitle>
              <CardDescription>最新 10 笔订单</CardDescription>
            </div>
            <Link
              href="/admin/orders"
              className="shrink-0 text-sm text-muted-foreground hover:underline"
            >
              查看全部
            </Link>
          </CardHeader>
          <CardContent className="min-w-0">
            {recentOrders.length > 0 ? (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>订单号</TableHead>
                      <TableHead>商品</TableHead>
                      <TableHead>金额</TableHead>
                      <TableHead className="hidden sm:table-cell">下单时间</TableHead>
                      <TableHead>状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-xs sm:text-sm">
                          {order.orderNo}
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate sm:max-w-none">
                          {order.productNameSnapshot ?? order.product.name}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          ¥{Number(order.amount).toFixed(2)}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground text-sm sm:table-cell">
                          {formatDateTimeShort(order.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              order.status === "COMPLETED"
                                ? "default"
                                : order.status === "PENDING"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {ORDER_STATUS_LABEL[order.status]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">暂无订单</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/(main)/dashboard/page.tsx
git commit -m "feat(dashboard): replace KPI sections with distributor panel"
```

---

## Task 4: Clean up — remove unused data/types/tests/chart

**Files:**
- Modify: `app/admin/(main)/dashboard/dashboard-data.ts`
- Modify: `app/admin/(main)/dashboard/types.ts`
- Modify: `app/admin/(main)/dashboard/dashboard-charts.tsx`
- Modify: `__tests__/admin/dashboard-data.test.ts`
- Delete: `app/admin/(main)/dashboard/dashboard-order-status-chart.tsx`

- [ ] **Step 1: Simplify `types.ts` — remove `DashboardKpis` and `OrderStatusCount`**

Replace the full contents of `app/admin/(main)/dashboard/types.ts` with:

```typescript
import type { OrderStatus } from "@prisma/client"

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "待支付",
  COMPLETED: "已完成",
  CLOSED: "已关闭",
}

export const DASHBOARD_TREND_DAYS = [7, 30] as const
export type DashboardTrendDays = (typeof DASHBOARD_TREND_DAYS)[number]

export const LOW_STOCK_THRESHOLD = 3

export type DashboardTrendPoint = {
  date: string
  订单: number
  营收: number
  净收入: number
}

export type TopProductRow = {
  productId: string
  productName: string
  revenue: number
  orderCount: number
}

export type InventoryRow = {
  productId: string
  productName: string
  unsoldCount: number
  isLowStock: boolean
}

export type RestockPendingRow = {
  productId: string
  productName: string
  pendingCount: number
}
```

- [ ] **Step 2: Simplify `dashboard-data.ts` — remove `getDashboardKpis`, `getOrderStatusDistribution`, simplify `getDashboardData`**

Replace the full contents of `app/admin/(main)/dashboard/dashboard-data.ts` with:

```typescript
import { prisma } from "@/lib/prisma"
import { getHKTDayStart } from "@/lib/utils"
import {
  type DashboardTrendPoint,
  type TopProductRow,
  type InventoryRow,
  type RestockPendingRow,
} from "./types"
import { getDaysForTrend } from "./dashboard-utils"
import { ADMIN_DASHBOARD_RECENT_ORDERS_LIMIT, ADMIN_DASHBOARD_TOP_PRODUCTS_LIMIT } from "@/app/admin/constants"

/**
 * 按日聚合的订单数、营收、净收入（用于趋势图）
 */
export async function getDashboardTrend(days: number): Promise<DashboardTrendPoint[]> {
  const now = new Date()
  const todayStart = getHKTDayStart(now)
  const start = new Date(todayStart)
  start.setDate(todayStart.getDate() - days)

  type AmountGroupRow = { createdAt: Date; _sum: { amount: unknown } }
  type FeeGroupRow = { processedAt: Date | null; _sum: { feeAmount?: unknown } }

  const dayList = getDaysForTrend(days)
  const [chartRaw, commissionRaw, withdrawalFeeRaw] = await Promise.all([
    prisma.order.groupBy({
      by: ["createdAt"],
      where: { createdAt: { gte: start }, status: "COMPLETED" },
      _sum: { amount: true },
      _count: { id: true },
    }),
    (prisma as any).commission.groupBy({
      by: ["createdAt"],
      where: { createdAt: { gte: start }, status: "SETTLED" },
      _sum: { amount: true },
    }),
    (prisma as any).withdrawal.groupBy({
      by: ["processedAt"],
      where: { processedAt: { gte: start }, status: "PAID" },
      _sum: { feeAmount: true },
    }),
  ])

  return dayList.map((d) => {
    const next = new Date(d)
    next.setDate(next.getDate() + 1)
    const inDay = chartRaw.filter((r) => r.createdAt >= d && r.createdAt < next)
    const dayRevenue = inDay.reduce((s: number, r) => s + Number(r._sum?.amount ?? 0), 0)
    const dayOrders = inDay.reduce((s: number, r) => s + r._count.id, 0)
    const dayCommission = commissionRaw
      .filter((r: AmountGroupRow) => r.createdAt >= d && r.createdAt < next)
      .reduce((s: number, r: AmountGroupRow) => s + Number(r._sum.amount ?? 0), 0)
    const dayFee = withdrawalFeeRaw
      .filter((r: FeeGroupRow) => r.processedAt && r.processedAt >= d && r.processedAt < next)
      .reduce((s: number, r: FeeGroupRow) => s + Number(r._sum.feeAmount ?? 0), 0)
    const dayNetIncome = Math.round((dayRevenue - dayCommission + dayFee) * 100) / 100
    return {
      date: d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }),
      订单: dayOrders,
      营收: dayRevenue,
      净收入: dayNetIncome,
    }
  })
}

/**
 * 按营收排序的商品 Top N
 */
export async function getTopProductsByRevenue(
  limit: number = ADMIN_DASHBOARD_TOP_PRODUCTS_LIMIT
): Promise<TopProductRow[]> {
  const [byProduct, products] = await Promise.all([
    prisma.order.groupBy({
      by: ["productId"],
      where: { status: "COMPLETED" },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.product.findMany({
      select: { id: true, name: true },
    }),
  ])
  const nameMap = new Map(products.map((p) => [p.id, p.name]))
  return byProduct
    .map((r) => ({
      productId: r.productId,
      productName: nameMap.get(r.productId) ?? "",
      revenue: Number(r._sum.amount ?? 0),
      orderCount: r._count.id,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
}

/**
 * 各商品 UNSOLD 卡密数量，用于库存预警
 */
export async function getInventoryByProduct(): Promise<InventoryRow[]> {
  const [byProduct, products] = await Promise.all([
    prisma.card.groupBy({
      by: ["productId"],
      where: { status: "UNSOLD" },
      _count: { id: true },
    }),
    prisma.product.findMany({
      select: { id: true, name: true },
    }),
  ])
  const nameMap = new Map(products.map((p) => [p.id, p.name]))
  return byProduct.map((r) => ({
    productId: r.productId,
    productName: nameMap.get(r.productId) ?? "",
    unsoldCount: r._count.id,
    isLowStock: r._count.id < 3,
  }))
}

/**
 * 待通知的补货提醒数量（按商品）
 */
export async function getRestockPending(): Promise<RestockPendingRow[]> {
  const [byProduct, products] = await Promise.all([
    prisma.restockSubscription.groupBy({
      by: ["productId"],
      where: { status: "PENDING" },
      _count: { id: true },
    }),
    prisma.product.findMany({
      select: { id: true, name: true },
    }),
  ])
  const nameMap = new Map(products.map((p) => [p.id, p.name]))
  return byProduct.map((r) => ({
    productId: r.productId,
    productName: nameMap.get(r.productId) ?? "",
    pendingCount: r._count.id,
  }))
}

/**
 * 最近订单列表
 */
export async function getRecentOrders(limit: number = ADMIN_DASHBOARD_RECENT_ORDERS_LIMIT) {
  return prisma.order.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNo: true,
      email: true,
      amount: true,
      status: true,
      createdAt: true,
      productNameSnapshot: true,
      product: { select: { id: true, name: true } },
    },
  })
}

export type DashboardData = {
  trend7: DashboardTrendPoint[]
  trend30: DashboardTrendPoint[]
  topProducts: TopProductRow[]
  inventory: InventoryRow[]
  restockPending: RestockPendingRow[]
  recentOrders: Awaited<ReturnType<typeof getRecentOrders>>
}

/**
 * 一次性拉取仪表盘所需全部数据（并行请求）
 */
export async function getDashboardData(): Promise<DashboardData> {
  const [trend7, trend30, topProducts, inventory, restockPending, recentOrders] =
    await Promise.all([
      getDashboardTrend(7),
      getDashboardTrend(30),
      getTopProductsByRevenue(),
      getInventoryByProduct(),
      getRestockPending(),
      getRecentOrders(),
    ])
  return { trend7, trend30, topProducts, inventory, restockPending, recentOrders }
}
```

- [ ] **Step 3: Remove `DashboardOrderStatusChart` from `dashboard-charts.tsx`**

Replace `app/admin/(main)/dashboard/dashboard-charts.tsx` with:

```typescript
"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

export const DashboardTrendSection = dynamic(
  () => import("./dashboard-trend-section").then((m) => m.DashboardTrendSection),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full" /> }
)

export const DashboardTopProductsChart = dynamic(
  () => import("./dashboard-top-products-chart").then((m) => m.DashboardTopProductsChart),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full" /> }
)
```

- [ ] **Step 4: Delete the order-status chart file**

```bash
rm app/admin/(main)/dashboard/dashboard-order-status-chart.tsx
```

- [ ] **Step 5: Update `__tests__/admin/dashboard-data.test.ts`**

Replace the full contents with:

```typescript
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../__mocks__/prisma")
  return { __esModule: true, prisma: prismaMock }
})

import {
  getDashboardTrend,
  getTopProductsByRevenue,
  getInventoryByProduct,
  getRestockPending,
  getRecentOrders,
  getDashboardData,
} from "@/app/admin/(main)/dashboard/dashboard-data"

const now = new Date("2024-02-14T12:00:00.000Z")

describe("dashboard-data", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(now)
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  describe("getDashboardTrend", () => {
    it("returns array of length equal to days with 净收入 field", async () => {
      prismaMock.order.groupBy.mockResolvedValueOnce([])
      prismaMock.commission.groupBy.mockResolvedValueOnce([])
      prismaMock.withdrawal.groupBy.mockResolvedValueOnce([])

      const result = await getDashboardTrend(7)

      expect(result).toHaveLength(7)
      expect(
        result.every(
          (r) =>
            typeof r.date === "string" &&
            typeof r.订单 === "number" &&
            typeof r.营收 === "number" &&
            typeof r.净收入 === "number",
        ),
      ).toBe(true)
    })

    it("calculates 净收入 as revenue minus commission plus fee for each day", async () => {
      const testDay = new Date("2024-02-13T12:00:00.000Z")
      prismaMock.order.groupBy.mockResolvedValueOnce([
        { createdAt: testDay, _sum: { amount: 100 }, _count: { id: 1 } } as any,
      ])
      prismaMock.commission.groupBy.mockResolvedValueOnce([
        { createdAt: testDay, _sum: { amount: 20 } } as any,
      ])
      prismaMock.withdrawal.groupBy.mockResolvedValueOnce([
        { processedAt: testDay, _sum: { feeAmount: 2 } } as any,
      ])

      const result = await getDashboardTrend(7)
      const dayResult = result.find((r) => r.营收 === 100)
      expect(dayResult?.净收入).toBe(82)
    })
  })

  describe("getTopProductsByRevenue", () => {
    it("returns products sorted by revenue with names", async () => {
      prismaMock.order.groupBy.mockResolvedValueOnce([
        { productId: "p1", _sum: { amount: 500 }, _count: { id: 5 } } as any,
        { productId: "p2", _sum: { amount: 300 }, _count: { id: 3 } } as any,
      ])
      prismaMock.product.findMany.mockResolvedValueOnce([
        { id: "p1", name: "Product A" } as any,
        { id: "p2", name: "Product B" } as any,
      ])

      const result = await getTopProductsByRevenue(5)

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({ productId: "p1", productName: "Product A", revenue: 500, orderCount: 5 })
      expect(result[1].revenue).toBe(300)
    })
  })

  describe("getInventoryByProduct", () => {
    it("returns inventory rows with isLowStock flag", async () => {
      prismaMock.card.groupBy.mockResolvedValueOnce([
        { productId: "p1", _count: { id: 2 } } as any,
        { productId: "p2", _count: { id: 10 } } as any,
      ])
      prismaMock.product.findMany.mockResolvedValueOnce([
        { id: "p1", name: "Low Stock" } as any,
        { id: "p2", name: "OK Stock" } as any,
      ])

      const result = await getInventoryByProduct()

      expect(result).toHaveLength(2)
      expect(result.find((r) => r.productId === "p1")?.isLowStock).toBe(true)
      expect(result.find((r) => r.productId === "p2")?.isLowStock).toBe(false)
    })
  })

  describe("getRestockPending", () => {
    it("returns pending count per product with names", async () => {
      prismaMock.restockSubscription.groupBy.mockResolvedValueOnce([
        { productId: "p1", _count: { id: 4 } } as any,
      ])
      prismaMock.product.findMany.mockResolvedValueOnce([
        { id: "p1", name: "Out of Stock" } as any,
      ])

      const result = await getRestockPending()

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ productId: "p1", productName: "Out of Stock", pendingCount: 4 })
    })
  })

  describe("getRecentOrders", () => {
    it("returns orders with product relation", async () => {
      prismaMock.order.findMany.mockResolvedValueOnce([
        {
          id: "o1",
          orderNo: "NO001",
          productId: "p1",
          amount: 99,
          status: "COMPLETED",
          product: { id: "p1", name: "Prod" },
        } as any,
      ])

      const result = await getRecentOrders(10)

      expect(result).toHaveLength(1)
      expect(prismaMock.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          orderBy: { createdAt: "desc" },
          select: expect.objectContaining({ product: { select: { id: true, name: true } } }),
        }),
      )
    })
  })

  describe("getDashboardData", () => {
    it("returns all sections without kpis", async () => {
      prismaMock.order.groupBy.mockResolvedValue([])
      prismaMock.commission.groupBy.mockResolvedValue([])
      prismaMock.withdrawal.groupBy.mockResolvedValue([])
      prismaMock.card.groupBy.mockResolvedValue([])
      prismaMock.restockSubscription.groupBy.mockResolvedValue([])
      prismaMock.product.findMany.mockResolvedValue([])
      prismaMock.order.findMany.mockResolvedValue([])

      const result = await getDashboardData()

      expect(result).toHaveProperty("trend7")
      expect(result).toHaveProperty("trend30")
      expect(result).toHaveProperty("topProducts")
      expect(result).toHaveProperty("inventory")
      expect(result).toHaveProperty("restockPending")
      expect(result).toHaveProperty("recentOrders")
      expect(result).not.toHaveProperty("kpis")
      expect(result).not.toHaveProperty("orderStatusDistribution")
      expect(result.trend7).toHaveLength(7)
      expect(result.trend30).toHaveLength(30)
    })
  })
})
```

- [ ] **Step 6: Run all dashboard tests to verify**

```bash
npx jest __tests__/admin/dashboard-data.test.ts --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 7: Run full test suite to check for regressions**

```bash
npm test -- --no-coverage 2>&1 | tail -20
```

Expected: All tests pass. If any test references `getDashboardKpis`, `getOrderStatusDistribution`, `DashboardKpis`, or `OrderStatusCount`, fix those imports now.

- [ ] **Step 8: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add app/admin/(main)/dashboard/dashboard-data.ts \
        app/admin/(main)/dashboard/types.ts \
        app/admin/(main)/dashboard/dashboard-charts.tsx \
        __tests__/admin/dashboard-data.test.ts
git rm app/admin/(main)/dashboard/dashboard-order-status-chart.tsx
git commit -m "refactor(dashboard): remove unused KPI data layer and order status chart"
```

---

## Self-Review

**Spec coverage:**
- ✅ 新增分销员看板（DashboardDistributorPanel）：Task 2
- ✅ 4 KPI 迷你卡（待处理提现、待结算佣金、本月已结佣金、分销员数）：Task 2
- ✅ Top 分销员排行榜（近7天/30天/本月）：Task 2
- ✅ `/api/admin/distributor-report` API：Task 1
- ✅ 删除财务核心/运营效率/待办事项 section：Task 3
- ✅ 删除订单状态分布饼图：Task 3 + Task 4
- ✅ 趋势图与商品表现并排：Task 3
- ✅ 清理 dashboard-data.ts / types.ts / 测试：Task 4

**Placeholder scan:** 无 TBD / TODO。

**Type consistency:** `DistributorReportResponse` 在 Task 1 route.ts 中定义，Task 2 component 通过 `import type` 引用，类型一致。`getDashboardData` 返回值在 Task 4 更新，Task 3 的 page.tsx 只解构其中字段，无冲突。
