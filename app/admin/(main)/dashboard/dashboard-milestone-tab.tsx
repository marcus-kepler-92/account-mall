"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Check } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
                <CardContent>
                  <p className="text-xs text-muted-foreground">总分销员</p>
                  <p className="mt-1 text-xl font-bold">{g?.totalDistributors ?? 0} 人</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <p className="text-xs text-muted-foreground">本月新增</p>
                  <p className="mt-1 text-xl font-bold text-green-600">+{g?.newThisMonth ?? 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <p className="text-xs text-muted-foreground">里程碑奖金累计</p>
                  <p className="mt-1 text-xl font-bold text-amber-600">{formatCurrency(g?.totalBonusPaid ?? 0)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <p className="text-xs text-muted-foreground">已触发次数</p>
                  <p className="mt-1 text-xl font-bold">{g?.totalTriggerCount ?? 0} 次</p>
                </CardContent>
              </Card>
            </>
          )}
      </div>

      {/* Tier config */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">档位配置</CardTitle>
          <CardDescription>N 位下线各自消费满指定金额即触发，每档每人仅发放一次</CardDescription>
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
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">分销员里程碑进度</CardTitle>
          <CardDescription>
            ✓ 已发放奖励 &nbsp;·&nbsp; 数字 = 已达标人数 / 目标人数
            {data?.tiers[0] ? `（达标：各自消费满 ${formatCurrency(data.tiers[0].thresholdAmount)}）` : ""}
          </CardDescription>
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
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">本月新增分销员</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : !data?.newDistributors.length ? (
            <p className="py-4 text-center text-sm text-muted-foreground">本月暂无新增</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>分销员</TableHead>
                    <TableHead>来自</TableHead>
                    <TableHead className="text-right">时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.newDistributors.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <button
                          onClick={() => setSelectedId(d.id)}
                          className="hover:underline underline-offset-2 text-left"
                        >
                          {d.name ?? d.email}
                        </button>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
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
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {new Date(d.createdAt).toLocaleString("zh-CN", {
                          timeZone: "Asia/Hong_Kong",
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">达标人数</TableHead>
            <TableHead className="text-right">每人消费</TableHead>
            <TableHead className="text-right">奖励</TableHead>
            <TableHead className="text-right">已触发</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tiers.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="text-right font-medium">{t.thresholdCount} 人</TableCell>
              <TableCell className="text-right text-muted-foreground">{formatCurrency(t.thresholdAmount)}</TableCell>
              <TableCell className="text-right font-medium text-green-600">+{formatCurrency(t.bonusAmount)}</TableCell>
              <TableCell className="text-right text-muted-foreground">{t.triggeredCount} 次</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 border-r bg-muted/50">分销员</TableHead>
            <TableHead className="text-right">达标</TableHead>
            {tiers.map((t) => (
              <TableHead key={t.id} className="whitespace-nowrap text-center">
                {t.thresholdCount}人
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {leaderboard.map((entry) => (
            <TableRow key={entry.inviterId}>
              <TableCell className="sticky left-0 z-10 border-r bg-card font-medium">
                <button
                  onClick={() => onSelectId(entry.inviterId)}
                  className="block max-w-28 truncate text-left hover:underline underline-offset-2 sm:max-w-40"
                >
                  {entry.name ?? entry.email}
                </button>
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {entry.qualifiedCount}
              </TableCell>
              {tiers.map((t) => {
                const triggered = entry.triggeredMilestoneIds.includes(t.id)
                return (
                  <TableCell key={t.id} className="text-center">
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
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
