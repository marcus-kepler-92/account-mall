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
  qualifiedCount: number        // invitees who individually spent >= lowest thresholdAmount
  triggeredMilestoneIds: string[]
}

export type MilestoneReportResponse = {
  global: {
    totalDistributors: number
    newThisMonth: number
    totalBonusPaid: number
    totalTriggerCount: number
  }
  tiers: MilestoneTierStat[]
  leaderboard: MilestoneLeaderboardEntry[]
  newDistributors: Array<{
    id: string
    name: string | null
    email: string
    inviterId: string | null
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
    milestones,
    allBonuses,
    newDistributorRows,
    allDistributors,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "DISTRIBUTOR", disabledAt: null } }),
    prisma.user.count({ where: { role: "DISTRIBUTOR", createdAt: { gte: monthStart } } }),
    prisma.invitationMilestoneBonus.aggregate({ _sum: { amount: true } }),
    prisma.invitationMilestoneBonus.count(),
    prisma.invitationMilestone.findMany({ orderBy: { thresholdCount: "asc" } }),
    prisma.invitationMilestoneBonus.findMany({ select: { inviterId: true, milestoneId: true } }),
    prisma.user.findMany({
      where: { role: "DISTRIBUTOR", createdAt: { gte: monthStart } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, email: true, createdAt: true,
        inviter: { select: { id: true, name: true, email: true } },
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

  const tiers: MilestoneTierStat[] = milestones.map((m) => ({
    id: m.id,
    thresholdCount: m.thresholdCount,
    thresholdAmount: Number(m.thresholdAmount),
    bonusAmount: Number(m.bonusAmount),
    triggeredCount: triggeredCountById.get(m.id) ?? 0,
  }))

  // For leaderboard: use the lowest milestone's thresholdAmount as qualification threshold
  // Each distributor's "qualifiedCount" = invitees who have individually spent >= that threshold
  const minThreshold = milestones.length > 0 ? Number(milestones[0].thresholdAmount) : 0
  const minCreatedAt = milestones.length > 0 ? milestones[0].createdAt : new Date(0)

  const inviterIds = [...new Set(
    allDistributors.map((d) => d.inviterId).filter((id): id is string => id !== null),
  )]

  const leaderboard: MilestoneLeaderboardEntry[] = []

  if (milestones.length > 0 && inviterIds.length > 0) {
    await Promise.all(
      inviterIds.map(async (inviterId) => {
        const user = allDistributors.find((d) => d.id === inviterId)
        if (!user) return

        const inviteeIds = allDistributors
          .filter((d) => d.inviterId === inviterId)
          .map((d) => d.id)
        if (inviteeIds.length === 0) return

        // Count invitees who have each individually spent >= minThreshold since earliest milestone
        const salesByInvitee = await prisma.order.groupBy({
          by: ["distributorId"],
          where: {
            distributorId: { in: inviteeIds },
            status: "COMPLETED",
            paidAt: { gte: minCreatedAt },
          },
          _sum: { amount: true },
        })
        const qualifiedCount = salesByInvitee.filter(
          (g) => Number(g._sum.amount ?? 0) >= minThreshold,
        ).length

        const triggered = bonusByInviter.get(inviterId) ?? new Set()

        leaderboard.push({
          inviterId,
          name: user.name,
          email: user.email ?? "",
          qualifiedCount,
          triggeredMilestoneIds: [...triggered],
        })
      }),
    )

    leaderboard.sort((a, b) => b.qualifiedCount - a.qualifiedCount)
    leaderboard.splice(20)
  }

  return NextResponse.json<MilestoneReportResponse>({
    global: {
      totalDistributors,
      newThisMonth,
      totalBonusPaid: Number(totalBonusRow._sum.amount ?? 0),
      totalTriggerCount,
    },
    tiers,
    leaderboard,
    newDistributors: newDistributorRows.map((d) => ({
      id: d.id,
      name: d.name,
      email: d.email ?? "",
      inviterId: d.inviter?.id ?? null,
      inviterName: d.inviter?.name ?? null,
      inviterEmail: d.inviter?.email ?? null,
      createdAt: d.createdAt.toISOString(),
    })),
  })
}

export const runtime = "nodejs"
