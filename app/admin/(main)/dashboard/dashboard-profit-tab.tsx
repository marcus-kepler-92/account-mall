"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
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
        onPresetSelect={(p) => {
          setFrom(p.from)
          setTo(p.to)
        }}
      >
        <Input
          type="date"
          value={from}
          max={to}
          className="h-7 w-[9.5rem] px-2 text-xs md:text-xs"
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
          className="h-7 w-[9.5rem] px-2 text-xs md:text-xs"
          onChange={(e) => {
            if (e.target.value >= from) setTo(e.target.value)
          }}
        />
      </DashboardDateRangePresets>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-3 h-8 w-28" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">总营收</p>
                <p className="mt-1 text-xl font-bold">{formatCurrency(s?.revenue ?? 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
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
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">佣金支出</p>
                <p className="mt-1 text-xl font-bold text-amber-600">{formatCurrency(commission)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">里程碑奖金</p>
                <p className="mt-1 text-xl font-bold text-amber-600">
                  {formatCurrency(s?.milestoneBonus ?? 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
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
              <CardContent className="pt-4">
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
          <CardHeader>
            <CardTitle className="text-base">利润构成</CardTitle>
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
        <CardHeader>
          <CardTitle className="text-base">商品利润明细</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : products.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">该时段暂无数据</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left">商品</th>
                    <th className="px-3 py-2 text-right">营收</th>
                    <th className="px-3 py-2 text-right">成本</th>
                    <th className="px-3 py-2 text-right">佣金</th>
                    <th className="px-3 py-2 text-right">净利润</th>
                    <th className="px-3 py-2 text-right">利润率</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.productId} className="border-b last:border-0">
                      <td className="max-w-[160px] truncate px-3 py-2">{p.productName}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(p.revenue)}</td>
                      <td className="px-3 py-2 text-right text-amber-600">
                        {p.hasMissingCost ? (
                          <span title="部分订单无成本数据">—⚠</span>
                        ) : (
                          formatCurrency(p.cost)
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-amber-600">
                        {formatCurrency(p.commission)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-green-600">
                        {formatCurrency(p.profit)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {Math.round(p.margin * 100)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Distributor leaderboard */}
      {leaderboard.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">分销员贡献排行</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left">分销员</th>
                    <th className="px-3 py-2 text-right">贡献营收</th>
                    <th className="px-3 py-2 text-right">期间佣金</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((d) => (
                    <tr key={d.distributorId} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <Link href="/admin/distributors" className="hover:underline">
                          {d.name ?? d.email}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {formatCurrency(d.revenue)}
                      </td>
                      <td className="px-3 py-2 text-right text-amber-600">
                        {formatCurrency(d.periodCommission)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
