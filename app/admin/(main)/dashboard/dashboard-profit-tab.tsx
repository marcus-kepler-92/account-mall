"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency } from "@/lib/utils"
import type { SalesReportResponse } from "@/app/api/admin/sales-report/route"
import type { DistributorReportResponse } from "@/app/api/admin/distributor-report/route"
import { todayHKT } from "./dashboard-hkt"
import { DashboardDateRangePresets } from "./dashboard-date-range-presets"
import { DashboardProfitTrendChart } from "./dashboard-charts"
import { DashboardProfitCompositionBar } from "./dashboard-profit-composition-bar"

export function DashboardProfitTab() {
  const today = todayHKT()
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)

  const { data, isLoading } = useQuery<SalesReportResponse>({
    queryKey: ["sales-report", from, to],
    queryFn: () =>
      fetch(`/api/admin/sales-report?from=${from}&to=${to}`).then((r) => r.json()),
    staleTime: 30_000,
  })

  const { data: distData } = useQuery<DistributorReportResponse>({
    queryKey: ["distributor-report", from, to],
    queryFn: () =>
      fetch(`/api/admin/distributor-report?from=${from}&to=${to}`).then((r) => r.json()),
    staleTime: 30_000,
  })

  const s = data?.summary
  const products = data?.products ?? []
  const series = data?.series ?? []
  const leaderboard = distData?.leaderboard ?? []
  const hasMissing = s?.hasMissingCost ?? false

  // commission = revenue - cost - milestoneBonus - profit
  const commission = s ? s.revenue - s.profit - s.cost - s.milestoneBonus : 0

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

      {/* Headline + composition — the single place that tells "revenue → net profit". */}
      <Card>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-72" />
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : s ? (
            <DashboardProfitCompositionBar
              revenue={s.revenue}
              cost={s.cost}
              commission={commission}
              milestoneBonus={s.milestoneBonus}
              profit={s.profit}
              hasMissingCost={hasMissing}
            />
          ) : null}
        </CardContent>
      </Card>

      {/* Trend — the only place that shows the time axis. */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">趋势</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : (
            <DashboardProfitTrendChart data={series} />
          )}
        </CardContent>
      </Card>

      {/* Drill-down — by product or by distributor. */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">明细分布</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="products">
            <TabsList>
              <TabsTrigger value="products">按商品</TabsTrigger>
              <TabsTrigger value="distributors">按分销员</TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="mt-3">
              {isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : products.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">该时段暂无数据</p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>商品</TableHead>
                        <TableHead className="text-right">营收</TableHead>
                        <TableHead className="text-right">成本</TableHead>
                        <TableHead className="text-right">佣金</TableHead>
                        <TableHead className="text-right">净利润</TableHead>
                        <TableHead className="text-right">利润率</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((p) => (
                        <TableRow key={p.productId}>
                          <TableCell className="max-w-[160px] truncate">{p.productName}</TableCell>
                          <TableCell className="text-right">{formatCurrency(p.revenue)}</TableCell>
                          <TableCell className="text-right text-amber-600">
                            {p.hasMissingCost ? (
                              <span title="部分订单无成本数据">—⚠</span>
                            ) : (
                              formatCurrency(p.cost)
                            )}
                          </TableCell>
                          <TableCell className="text-right text-amber-600">
                            {formatCurrency(p.commission)}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-500">
                            {formatCurrency(p.profit)}
                          </TableCell>
                          <TableCell className="text-right">
                            {Math.round(p.margin * 100)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="distributors" className="mt-3">
              {leaderboard.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">该时段暂无分销员数据</p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>分销员</TableHead>
                        <TableHead className="text-right">贡献营收</TableHead>
                        <TableHead className="text-right">期间佣金</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaderboard.map((d) => (
                        <TableRow key={d.distributorId}>
                          <TableCell>
                            <Link href="/admin/distributors" className="hover:underline">
                              {d.name ?? d.email}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(d.revenue)}
                          </TableCell>
                          <TableCell className="text-right text-amber-600">
                            {formatCurrency(d.periodCommission)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
