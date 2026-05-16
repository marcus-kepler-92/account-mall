"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Check } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, formatCurrency } from "@/lib/utils"
import type {
  MilestoneReportResponse,
  MilestoneTierStat,
  MilestoneLeaderboardEntry,
} from "@/app/api/admin/milestone-report/route"
import { DistributorDetailSheet } from "@/app/admin/(main)/distributors/distributor-detail-sheet"
import type { DistributorDetailResponse } from "@/app/api/admin/distributors/[id]/detail/route"

export function DashboardMilestoneTab() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery<MilestoneReportResponse>({
    queryKey: ["milestone-report"],
    queryFn: () => fetch("/api/admin/milestone-report").then((r) => r.json()),
    staleTime: 60_000,
  })

  const detailQuery = useQuery<DistributorDetailResponse>({
    queryKey: ["distributor-detail", selectedId],
    queryFn: () =>
      fetch(`/api/admin/distributors/${selectedId}/detail`).then((r) => r.json()),
    enabled: !!selectedId,
    staleTime: 30_000,
  })

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["milestone-report"] })
    if (selectedId) {
      queryClient.invalidateQueries({ queryKey: ["distributor-detail", selectedId] })
    }
  }

  if (isError) {
    return <p className="py-8 text-center text-sm text-muted-foreground">加载失败，请刷新重试</p>
  }

  const g = data?.global

  return (
    <div className="space-y-6">
      {/* Global stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)
          : (
            <>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">总分销员</p>
                  <p className="mt-1 text-xl font-bold">{g?.totalDistributors ?? 0} 人</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">本月新增</p>
                  <p className="mt-1 text-xl font-bold text-green-600">+{g?.newThisMonth ?? 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">里程碑奖金累计</p>
                  <p className="mt-1 text-xl font-bold text-amber-600">{formatCurrency(g?.totalBonusPaid ?? 0)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">已触发次数</p>
                  <p className="mt-1 text-xl font-bold">{g?.totalTriggerCount ?? 0} 次</p>
                </CardContent>
              </Card>
            </>
          )}
      </div>

      {/* Tier config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">档位配置</CardTitle>
          <p className="text-xs text-muted-foreground">N 位下线各自消费满指定金额即触发，每档每人仅发放一次</p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !data?.tiers.length ? (
            <p className="py-4 text-center text-sm text-muted-foreground">暂未配置里程碑</p>
          ) : (
            <TierTable tiers={data.tiers} />
          )}
        </CardContent>
      </Card>

      {/* Progress matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">分销员里程碑进度</CardTitle>
          <p className="text-xs text-muted-foreground">
            ✓ 已发放奖励 &nbsp;·&nbsp; 数字 = 已达标人数 / 目标人数
            {data?.tiers[0] ? `（达标：各自消费满 ${formatCurrency(data.tiers[0].thresholdAmount)}）` : ""}
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !data?.leaderboard.length ? (
            <p className="py-4 text-center text-sm text-muted-foreground">暂无数据</p>
          ) : (
            <ProgressMatrix tiers={data.tiers} leaderboard={data.leaderboard} onSelectId={setSelectedId} />
          )}
        </CardContent>
      </Card>

      {/* New distributors this month */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">本月新增分销员</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : !data?.newDistributors.length ? (
            <p className="py-4 text-center text-sm text-muted-foreground">本月暂无新增</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left">分销员</th>
                    <th className="px-3 py-2 text-left">来自</th>
                    <th className="px-3 py-2 text-right">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {data.newDistributors.map((d) => (
                    <tr key={d.id} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <button
                          onClick={() => setSelectedId(d.id)}
                          className="hover:underline underline-offset-2 text-left"
                        >
                          {d.name ?? d.email}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {d.inviterId ? (
                          <button
                            onClick={() => setSelectedId(d.inviterId!)}
                            className="hover:underline underline-offset-2 text-left"
                          >
                            {d.inviterName ?? d.inviterEmail}
                          </button>
                        ) : (
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
        </CardContent>
      </Card>

      <DistributorDetailSheet
        row={detailQuery.data?.row ?? null}
        tiers={detailQuery.data?.tiers ?? []}
        open={!!selectedId && !!detailQuery.data}
        onOpenChange={(o) => { if (!o) setSelectedId(null) }}
        onSuccess={handleSuccess}
      />
    </div>
  )
}

function TierTable({ tiers }: { tiers: MilestoneTierStat[] }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
            <th className="px-3 py-2 text-right">达标人数</th>
            <th className="px-3 py-2 text-right">每人消费</th>
            <th className="px-3 py-2 text-right">奖励</th>
            <th className="px-3 py-2 text-right">已触发</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((t) => (
            <tr key={t.id} className="border-b last:border-0">
              <td className="px-3 py-2 text-right font-medium">{t.thresholdCount} 人</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{formatCurrency(t.thresholdAmount)}</td>
              <td className="px-3 py-2 text-right font-medium text-green-600">+{formatCurrency(t.bonusAmount)}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{t.triggeredCount} 次</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ProgressMatrix({
  tiers,
  leaderboard,
  onSelectId,
}: {
  tiers: MilestoneTierStat[]
  leaderboard: MilestoneLeaderboardEntry[]
  onSelectId: (id: string) => void
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
            <th className="sticky left-0 z-10 border-r bg-muted/50 px-3 py-2 text-left">分销员</th>
            <th className="px-3 py-2 text-right">达标</th>
            {tiers.map((t) => (
              <th key={t.id} className="whitespace-nowrap px-2 py-2 text-center">
                {t.thresholdCount}人
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((entry) => (
            <tr key={entry.inviterId} className="border-b last:border-0">
              <td className="sticky left-0 z-10 border-r bg-card px-3 py-2 font-medium">
                <button
                  onClick={() => onSelectId(entry.inviterId)}
                  className="block max-w-28 truncate text-left hover:underline underline-offset-2 sm:max-w-40"
                >
                  {entry.name ?? entry.email}
                </button>
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                {entry.qualifiedCount}
              </td>
              {tiers.map((t) => {
                const triggered = entry.triggeredMilestoneIds.includes(t.id)
                return (
                  <td key={t.id} className="px-2 py-2 text-center">
                    {triggered ? (
                      <Check className="mx-auto size-3.5 text-green-600" />
                    ) : (
                      <span
                        className={cn(
                          "tabular-nums text-xs",
                          entry.qualifiedCount > 0 ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {entry.qualifiedCount}/{t.thresholdCount}
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
