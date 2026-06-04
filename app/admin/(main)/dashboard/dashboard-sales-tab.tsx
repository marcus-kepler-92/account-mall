"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import type { getInventoryByProduct, getRestockPending, getRecentOrders } from "./dashboard-data"
import type { SalesReportResponse } from "@/app/api/admin/sales-report/route"
import type { TopProductRow } from "./types"
import { DashboardTopProductsChart } from "./dashboard-charts"
import { DashboardInventoryAlerts } from "./dashboard-inventory-alerts"
import { DashboardRestockPending } from "./dashboard-restock-pending"
import { ORDER_STATUS_LABEL } from "./types"
import { todayHKT } from "./dashboard-hkt"
import { DashboardDateRangePresets } from "./dashboard-date-range-presets"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatDateTimeShort } from "@/lib/utils"
import Link from "next/link"

type InventoryData = Awaited<ReturnType<typeof getInventoryByProduct>>
type RestockData = Awaited<ReturnType<typeof getRestockPending>>
type RecentOrdersData = Awaited<ReturnType<typeof getRecentOrders>>

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  COMPLETED: "default",
  PENDING: "secondary",
  CLOSED: "destructive",
}

export function DashboardSalesTab({
  inventory,
  restockPending,
  recentOrders,
}: {
  inventory: InventoryData
  restockPending: RestockData
  recentOrders: RecentOrdersData
}) {
  const today = todayHKT()
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)

  const { data, isLoading } = useQuery<SalesReportResponse>({
    queryKey: ["sales-report", from, to],
    queryFn: () =>
      fetch(`/api/admin/sales-report?from=${from}&to=${to}`).then((r) => r.json()),
    staleTime: 30_000,
  })

  const summary = data?.summary
  const avgPrice =
    summary && summary.totalQuantity > 0
      ? summary.revenue / summary.totalQuantity
      : 0
  // Conversion = paid / (free + paid). orderCount already counts both.
  const conversionRate =
    summary && summary.orderCount > 0
      ? summary.paidOrderCount / summary.orderCount
      : 0

  // Build TopProductRow[] for chart — sorted by revenue desc
  const topProducts: TopProductRow[] = (data?.products ?? [])
    .slice()
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map((p) => ({
      productId: p.productId,
      productName: p.productName,
      revenue: p.revenue,
      orderCount: p.quantity,
    }))

  // Build product ranking by quantity sold
  const rankingByQty = (data?.products ?? [])
    .slice()
    .sort((a, b) => b.quantity - a.quantity)

  return (
    <div className="space-y-6">
      <DashboardDateRangePresets
        from={from}
        to={to}
        onChange={(f, t) => {
          setFrom(f)
          setTo(t)
        }}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardContent>
            <p className="text-xs text-muted-foreground">总营收</p>
            {isLoading ? (
              <Skeleton className="mt-1 h-7 w-20" />
            ) : (
              <p className="mt-1 text-xl font-bold">{formatCurrency(summary?.revenue ?? 0)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-muted-foreground">订单数</p>
            {isLoading ? (
              <Skeleton className="mt-1 h-7 w-16" />
            ) : (
              <p className="mt-1 text-xl font-bold">{summary?.orderCount ?? 0}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-muted-foreground">卡密销量</p>
            {isLoading ? (
              <Skeleton className="mt-1 h-7 w-16" />
            ) : (
              <p className="mt-1 text-xl font-bold">{summary?.totalQuantity ?? 0}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-muted-foreground">均单价</p>
            {isLoading ? (
              <Skeleton className="mt-1 h-7 w-20" />
            ) : (
              <p className="mt-1 text-xl font-bold">{formatCurrency(avgPrice)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-muted-foreground">转化率</p>
            {isLoading ? (
              <Skeleton className="mt-1 h-7 w-16" />
            ) : (
              <>
                <p className="mt-1 text-xl font-bold">
                  {(conversionRate * 100).toFixed(1)}%
                </p>
                <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
                  付费 {summary?.paidOrderCount ?? 0} · 领取 {summary?.freeOrderCount ?? 0}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart + product ranking */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">商品营收排行</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : (
              <DashboardTopProductsChart data={topProducts} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">商品销量排行</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : rankingByQty.length === 0 ? (
              <p className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
                暂无销售数据
              </p>
            ) : (
              <div className="max-h-[240px] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>商品</TableHead>
                      <TableHead className="text-right">销量</TableHead>
                      <TableHead className="text-right">营收</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankingByQty.map((p, i) => (
                      <TableRow key={p.productId}>
                        <TableCell className="max-w-[160px] truncate">
                          <span className="mr-1.5 text-xs text-muted-foreground">
                            {i + 1}.
                          </span>
                          <Link
                            href={`/admin/products/${p.productId}`}
                            className="hover:underline"
                          >
                            {p.productName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">{p.quantity}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(p.revenue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Inventory alerts + restock pending */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">库存状态</CardTitle>
          </CardHeader>
          <CardContent>
            <DashboardInventoryAlerts data={inventory} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">催货订阅</CardTitle>
          </CardHeader>
          <CardContent>
            <DashboardRestockPending data={restockPending} />
          </CardContent>
        </Card>
      </div>

      {/* Recent orders */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">最近订单</CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">暂无订单</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>订单号</TableHead>
                    <TableHead>商品</TableHead>
                    <TableHead className="text-right">金额</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs">
                        <Link
                          href={`/admin/orders?q=${order.orderNo}`}
                          className="hover:underline"
                        >
                          {order.orderNo}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-sm">
                        {order.productNameSnapshot ?? order.product.name}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(order.amount))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[order.status] ?? "outline"}>
                          {ORDER_STATUS_LABEL[order.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTimeShort(order.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
