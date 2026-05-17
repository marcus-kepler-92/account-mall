"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
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

type WaterfallRow = {
  label: string
  value: number
  deduction: boolean
}

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
  const leaderboard = distData?.leaderboard ?? []
  const hasMissing = s?.hasMissingCost

  // commission = revenue - cost - milestoneBonus - profit
  const commission = s ? s.revenue - s.profit - s.cost - s.milestoneBonus : 0

  const waterfallRows: WaterfallRow[] = s
    ? [
        { label: "营收", value: s.revenue, deduction: false },
        { label: "采购成本", value: s.cost, deduction: true },
        { label: "佣金支出", value: commission, deduction: true },
        { label: "里程碑奖金", value: s.milestoneBonus, deduction: true },
      ]
    : []

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

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent>
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-3 h-8 w-28" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardContent>
                <p className="text-xs text-muted-foreground">总营收</p>
                <p className="mt-1 text-xl font-bold">{formatCurrency(s?.revenue ?? 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  采购成本
                  {hasMissing && (
                    <span title="部分商品未设成本" className="cursor-help">
                      ⚠
                    </span>
                  )}
                </p>
                <p className="mt-1 text-xl font-bold text-amber-600">
                  {s?.cost ? formatCurrency(s.cost) : "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-xs text-muted-foreground">佣金支出</p>
                <p className="mt-1 text-xl font-bold text-amber-600">{formatCurrency(commission)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-xs text-muted-foreground">里程碑奖金</p>
                <p className="mt-1 text-xl font-bold text-amber-600">
                  {formatCurrency(s?.milestoneBonus ?? 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  净利润
                  {hasMissing && (
                    <span title="部分商品未设成本，利润偏高" className="cursor-help">
                      ⚠
                    </span>
                  )}
                </p>
                <p className="mt-1 text-xl font-bold text-green-600">
                  {formatCurrency(s?.profit ?? 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-xs text-muted-foreground">利润率</p>
                <p className="mt-1 text-xl font-bold text-green-600">
                  {s && s.revenue > 0
                    ? `${Math.round((s.profit / s.revenue) * 100)}%`
                    : "—"}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Profit waterfall */}
      {s && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">利润构成</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 text-sm">
              {waterfallRows.map((row) => (
                <div key={row.label} className="flex justify-between">
                  <span className={row.deduction ? "text-amber-600" : ""}>
                    {row.deduction ? "− " : ""}
                    {row.label}
                  </span>
                  <span className={row.deduction ? "text-amber-600" : "font-semibold"}>
                    {row.deduction ? "−" : ""}
                    {formatCurrency(row.value)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-1.5 font-semibold">
                <span className="flex items-center gap-1">
                  净利润
                  {hasMissing && (
                    <span
                      title="部分商品未设成本，利润偏高"
                      className="cursor-help text-amber-500"
                    >
                      ⚠
                    </span>
                  )}
                </span>
                <span className="text-green-600">{formatCurrency(s.profit)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product profit table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">商品利润明细</CardTitle>
        </CardHeader>
        <CardContent>
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
                      <TableCell className="text-right font-semibold text-green-600">
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
        </CardContent>
      </Card>

      {/* Distributor leaderboard */}
      {leaderboard.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">分销员贡献排行</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      {/* Pending withdrawals banner */}
      <PendingWithdrawalsBanner />
    </div>
  )
}

function PendingWithdrawalsBanner() {
  const { data } = useQuery<{ pending: number } | null>({
    queryKey: ["pending-withdrawals-count"],
    queryFn: async () => {
      const res = await fetch("/api/admin/withdrawals/count")
      if (!res.ok) return null
      return res.json() as Promise<{ pending: number }>
    },
    staleTime: 30_000,
  })

  if (!data || data.pending === 0) return null

  return (
    <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <span className="flex items-center gap-2">
        <AlertTriangle className="size-4" />
        待处理提现 <strong>{data.pending} 笔</strong>，请及时审核
      </span>
      <Link href="/admin/withdrawals" className="underline hover:no-underline">
        去处理
      </Link>
    </div>
  )
}
