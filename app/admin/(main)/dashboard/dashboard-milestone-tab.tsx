"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"
import type {
  MilestoneReportResponse,
  MilestoneTierStat,
  MilestoneLeaderboardEntry,
} from "@/app/api/admin/milestone-report/route"

export function DashboardMilestoneTab() {
  const { data, isLoading, isError } = useQuery<MilestoneReportResponse>({
    queryKey: ["milestone-report"],
    queryFn: () => fetch("/api/admin/milestone-report").then((r) => r.json()),
    staleTime: 60_000,
  })

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
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground">总分销员</p>
                <p className="mt-1 text-xl font-bold">{g?.totalDistributors ?? 0} 人</p>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground">本月新增</p>
                <p className="mt-1 text-xl font-bold text-green-600">+{g?.newThisMonth ?? 0}</p>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground">里程碑奖金累计</p>
                <p className="mt-1 text-xl font-bold text-amber-600">{formatCurrency(g?.totalBonusPaid ?? 0)}</p>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground">已触发次数</p>
                <p className="mt-1 text-xl font-bold">{g?.totalTriggerCount ?? 0} 次</p>
              </div>
            </>
          )}
      </div>

      {/* Invitation milestones */}
      <MilestoneSectionCard
        title="邀请里程碑"
        description="邀请 N 人即触发，与销售额无关"
        tiers={data?.invitation.tiers ?? []}
        leaderboard={data?.invitation.leaderboard ?? []}
        type="INVITATION"
        isLoading={isLoading}
      />

      {/* Sales milestones */}
      <MilestoneSectionCard
        title="销售里程碑"
        description="被邀团队累计销售额达到门槛即触发"
        tiers={data?.sales.tiers ?? []}
        leaderboard={data?.sales.leaderboard ?? []}
        type="SALES"
        isLoading={isLoading}
      />

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
                      <td className="px-3 py-2">{d.name ?? d.email}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
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
        </CardContent>
      </Card>
    </div>
  )
}

function MilestoneSectionCard({
  title,
  description,
  tiers,
  leaderboard,
  type,
  isLoading,
}: {
  title: string
  description: string
  tiers: MilestoneTierStat[]
  leaderboard: MilestoneLeaderboardEntry[]
  type: "INVITATION" | "SALES"
  isLoading: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : tiers.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂未配置该类型里程碑</p>
        ) : (
          <>
            {/* Tier overview table */}
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left">门槛</th>
                    <th className="px-3 py-2 text-right">奖金</th>
                    <th className="px-3 py-2 text-right">已触发人数</th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((t) => (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        {type === "INVITATION"
                          ? `邀请 ${t.thresholdCount} 人`
                          : formatCurrency(t.thresholdAmount)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-green-600">
                        +{formatCurrency(t.bonusAmount)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">{t.triggeredCount} 人</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Leaderboard with progress bars */}
            {leaderboard.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {type === "INVITATION" ? "邀请排行榜" : "销售排行榜"} · 进度
                </p>
                <div className="space-y-2">
                  {leaderboard.map((entry) => (
                    <LeaderboardRow key={entry.inviterId} entry={entry} type={type} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function LeaderboardRow({
  entry,
  type,
}: {
  entry: MilestoneLeaderboardEntry
  type: "INVITATION" | "SALES"
}) {
  const isNearTrigger =
    !entry.isCapped &&
    entry.nextTierId !== null &&
    (type === "INVITATION"
      ? entry.nextTierGap <= 2
      : entry.nextTierGap / (entry.value + entry.nextTierGap) <= 0.2)

  const progressPct =
    entry.nextTierId !== null
      ? Math.min(100, Math.round((entry.value / (entry.value + entry.nextTierGap)) * 100))
      : 0

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 truncate font-medium">{entry.name ?? entry.email}</span>
      <span className="w-24 text-right tabular-nums">
        {type === "INVITATION" ? `${entry.value} 人` : formatCurrency(entry.value)}
      </span>
      <div className="min-w-[80px] flex-1">
        {entry.isCapped ? (
          <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            已满档
          </span>
        ) : entry.nextTierId ? (
          <div className="space-y-0.5">
            <div className="h-1.5 w-full rounded-full bg-muted">
              <div
                className="h-1.5 rounded-full bg-foreground"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              差{" "}
              {type === "INVITATION"
                ? `${entry.nextTierGap} 人`
                : formatCurrency(entry.nextTierGap)}
            </p>
          </div>
        ) : null}
      </div>
      {isNearTrigger && (
        <span className="text-xs font-medium text-amber-600">即将触发</span>
      )}
    </div>
  )
}
