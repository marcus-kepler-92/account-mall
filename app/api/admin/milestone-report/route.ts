import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"
import { fromZonedTime } from "date-fns-tz"

const HKT = "Asia/Hong_Kong"

export type MilestoneTierStat = {
  id: string
  thresholdCount: number
  thresholdAmount: number
  bonusAmount: number
  triggeredCount: number
}

export type MilestoneLeaderboardEntry = {
  inviterId: string
  name: string | null
  email: string
  value: number
  currentTierId: string | null
  nextTierId: string | null
  nextTierGap: number
  isCapped: boolean
}

export type MilestoneReportResponse = {
  global: {
    totalDistributors: number
    newThisMonth: number
    totalBonusPaid: number
    totalTriggerCount: number
  }
  invitation: {
    tiers: MilestoneTierStat[]
    leaderboard: MilestoneLeaderboardEntry[]
  }
  sales: {
    tiers: MilestoneTierStat[]
    leaderboard: MilestoneLeaderboardEntry[]
  }
  newDistributors: Array<{
    id: string
    name: string | null
    email: string
    inviterName: string | null
    inviterEmail: string | null
    createdAt: string
  }>
}

export async function GET(): Promise<NextResponse> {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const now = new Date()
  const monthStart = fromZonedTime(
    new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
    HKT,
  )

  const [
    totalDistributors,
    newThisMonth,
    totalBonusRow,
    totalTriggerCount,
    invitationMilestones,
    salesMilestones,
    allBonuses,
    newDistributorRows,
    allDistributors,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "DISTRIBUTOR", disabledAt: null } }),
    prisma.user.count({ where: { role: "DISTRIBUTOR", createdAt: { gte: monthStart } } }),
    prisma.invitationMilestoneBonus.aggregate({ _sum: { amount: true } }),
    prisma.invitationMilestoneBonus.count(),
    prisma.invitationMilestone.findMany({ where: { type: "INVITATION" }, orderBy: { thresholdCount: "asc" } }),
    prisma.invitationMilestone.findMany({ where: { type: "SALES" }, orderBy: { thresholdAmount: "asc" } }),
    prisma.invitationMilestoneBonus.findMany({ select: { inviterId: true, milestoneId: true } }),
    prisma.user.findMany({
      where: { role: "DISTRIBUTOR", createdAt: { gte: monthStart } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, email: true, createdAt: true,
        inviter: { select: { name: true, email: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "DISTRIBUTOR", disabledAt: null },
      select: { id: true, name: true, email: true, inviterId: true },
    }),
  ])

  const bonusByInviter = new Map<string, Set<string>>()
  for (const b of allBonuses) {
    if (!bonusByInviter.has(b.inviterId)) bonusByInviter.set(b.inviterId, new Set())
    bonusByInviter.get(b.inviterId)!.add(b.milestoneId)
  }

  const triggeredCountById = new Map<string, number>()
  for (const b of allBonuses) {
    triggeredCountById.set(b.milestoneId, (triggeredCountById.get(b.milestoneId) ?? 0) + 1)
  }

  const toTierStat = (m: {
    id: string
    thresholdCount: number
    thresholdAmount: unknown
    bonusAmount: unknown
  }): MilestoneTierStat => ({
    id: m.id,
    thresholdCount: m.thresholdCount,
    thresholdAmount: Number(m.thresholdAmount),
    bonusAmount: Number(m.bonusAmount),
    triggeredCount: triggeredCountById.get(m.id) ?? 0,
  })

  const inviterIds = [...new Set(allDistributors.map(d => d.inviterId).filter((id): id is string => id !== null))]

  const inviteeCounts = await Promise.all(
    inviterIds.map(inviterId =>
      prisma.user.count({ where: { inviterId, role: "DISTRIBUTOR", disabledAt: null } })
        .then(count => ({ inviterId, count }))
    )
  )
  const inviteeCountMap = new Map(inviteeCounts.map(r => [r.inviterId, r.count]))

  const buildInvitationLeaderboard = (): MilestoneLeaderboardEntry[] => {
    if (invitationMilestones.length === 0) return []
    const entries: MilestoneLeaderboardEntry[] = []
    for (const inviterId of inviterIds) {
      const user = allDistributors.find(d => d.id === inviterId)
      if (!user) continue
      const count = inviteeCountMap.get(inviterId) ?? 0
      const triggered = bonusByInviter.get(inviterId) ?? new Set()
      const highest = [...invitationMilestones].reverse().find(m => triggered.has(m.id))
      const next = invitationMilestones.find(m => !triggered.has(m.id) && m.thresholdCount > count)
      const isCapped = invitationMilestones.every(m => triggered.has(m.id))
      entries.push({
        inviterId,
        name: user.name,
        email: user.email ?? "",
        value: count,
        currentTierId: highest?.id ?? null,
        nextTierId: next?.id ?? null,
        nextTierGap: next ? next.thresholdCount - count : 0,
        isCapped,
      })
    }
    return entries.sort((a, b) => b.value - a.value).slice(0, 20)
  }

  const salesByInviter = await Promise.all(
    inviterIds.map(async inviterId => {
      const invitees = allDistributors.filter(d => d.inviterId === inviterId).map(d => d.id)
      if (invitees.length === 0) return { inviterId, revenue: 0 }
      const minCreatedAt = salesMilestones[0]?.createdAt ?? new Date(0)
      const result = await prisma.order.aggregate({
        where: { distributorId: { in: invitees }, status: "COMPLETED", paidAt: { gte: minCreatedAt } },
        _sum: { amount: true },
      })
      return { inviterId, revenue: Number(result._sum.amount ?? 0) }
    })
  )
  const salesRevenueMap = new Map(salesByInviter.map(r => [r.inviterId, r.revenue]))

  const buildSalesLeaderboard = (): MilestoneLeaderboardEntry[] => {
    if (salesMilestones.length === 0) return []
    const entries: MilestoneLeaderboardEntry[] = []
    for (const inviterId of inviterIds) {
      const user = allDistributors.find(d => d.id === inviterId)
      if (!user) continue
      const revenue = salesRevenueMap.get(inviterId) ?? 0
      const triggered = bonusByInviter.get(inviterId) ?? new Set()
      const highest = [...salesMilestones].reverse().find(m => triggered.has(m.id))
      const next = salesMilestones.find(m => !triggered.has(m.id) && Number(m.thresholdAmount) > revenue)
      const isCapped = salesMilestones.every(m => triggered.has(m.id))
      entries.push({
        inviterId,
        name: user.name,
        email: user.email ?? "",
        value: revenue,
        currentTierId: highest?.id ?? null,
        nextTierId: next?.id ?? null,
        nextTierGap: next ? Number(next.thresholdAmount) - revenue : 0,
        isCapped,
      })
    }
    return entries.sort((a, b) => b.value - a.value).slice(0, 20)
  }

  return NextResponse.json<MilestoneReportResponse>({
    global: {
      totalDistributors,
      newThisMonth,
      totalBonusPaid: Number(totalBonusRow._sum.amount ?? 0),
      totalTriggerCount,
    },
    invitation: {
      tiers: invitationMilestones.map(toTierStat),
      leaderboard: buildInvitationLeaderboard(),
    },
    sales: {
      tiers: salesMilestones.map(toTierStat),
      leaderboard: buildSalesLeaderboard(),
    },
    newDistributors: newDistributorRows.map(d => ({
      id: d.id,
      name: d.name,
      email: d.email ?? "",
      inviterName: d.inviter?.name ?? null,
      inviterEmail: d.inviter?.email ?? null,
      createdAt: d.createdAt.toISOString(),
    })),
  })
}

export const runtime = "nodejs"
