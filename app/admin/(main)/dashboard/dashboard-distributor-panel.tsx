"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"
import { TrendingDown, BadgeDollarSign, Users, UserPlus } from "lucide-react"
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
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)

  const { data, isLoading, isError } = useQuery<DistributorReportResponse>({
    queryKey: ["distributor-report", from, to],
    queryFn: () => fetchDistributorReport(from, to),
    staleTime: 30_000,
  })

  const summary = data?.summary
  const leaderboard = data?.leaderboard ?? []
  const newDistributors = data?.newDistributors ?? []

  const presets = [
    { label: "今日", from: today, to: today },
    { label: "近7天", from: offsetDaysHKT(-6), to: today },
    { label: "近30天", from: offsetDaysHKT(-29), to: today },
    { label: "本月", from: firstDayOfMonthHKT(), to: today },
  ]
  const selectedPreset = presets.find((p) => p.from === from && p.to === to)?.label ?? ""

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
                  variant={selectedPreset === preset.label ? "default" : "outline"}
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
                  if (e.target.value <= to) {
                    setFrom(e.target.value)
                  }
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
                  if (e.target.value >= from) {
                    setTo(e.target.value)
                  }
                }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))
            ) : (
              <>
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
                      <BadgeDollarSign className="size-3" /> 已结佣金
                    </p>
                    <p className="mt-1 text-lg font-bold">
                      {formatCurrency(summary?.settledCommission ?? 0)}
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

          {/* New distributors in range */}
          {!isError && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <UserPlus className="size-3" />
                新增分销员
                {!isLoading && (
                  <span className="font-normal">（{summary?.newDistributorCount ?? 0} 人）</span>
                )}
              </p>
              {isLoading ? (
                <Skeleton className="h-20 w-full rounded-lg" />
              ) : newDistributors.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">该时段暂无新增分销员</p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                        <th className="px-3 py-2 text-left font-medium">分销员</th>
                        <th className="px-3 py-2 text-left font-medium">来自</th>
                        <th className="px-3 py-2 text-right font-medium">注册时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {newDistributors.map((d) => (
                        <tr key={d.id} className="border-b last:border-0">
                          <td className="px-3 py-2">
                            <span className="font-medium">{d.name ?? d.email}</span>
                            {d.name && (
                              <span className="ml-1 text-xs text-muted-foreground">{d.email}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {d.inviterName ?? d.inviterEmail ?? (
                              <span className="italic">直接注册</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                            {new Date(d.createdAt).toLocaleString("zh-CN", {
                              timeZone: "Asia/Hong_Kong",
                              month: "numeric",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
