"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"
import type { SalesReportResponse } from "@/app/api/admin/sales-report/route"

const HKT_TZ = "Asia/Hong_Kong"

// en-CA locale produces ISO YYYY-MM-DD format
function todayHKT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: HKT_TZ })
}

function offsetDaysHKT(days: number): string {
  const d = new Date()
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000)
  return d.toLocaleDateString("en-CA", { timeZone: HKT_TZ })
}

function mondayOfCurrentWeekHKT(): string {
  const today = todayHKT() // "YYYY-MM-DD" in HKT — timezone-safe via Intl
  const [y, m, d] = today.split("-").map(Number)
  const day = new Date(y, m - 1, d).getDay() // day-of-week for a known date is timezone-independent
  const diff = day === 0 ? -6 : 1 - day
  return offsetDaysHKT(diff)
}

function firstDayOfMonthHKT(): string {
  return todayHKT().slice(0, 8) + "01" // "YYYY-MM-01"
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))
            ) : (
              <>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">总订单</p>
                  <p className="mt-1 text-xl font-bold">{summary?.orderCount ?? 0}</p>
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
