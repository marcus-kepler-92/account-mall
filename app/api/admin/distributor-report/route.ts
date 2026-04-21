import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, badRequest } from "@/lib/api-response"
import { fromZonedTime } from "date-fns-tz"

const HKT = "Asia/Hong_Kong"
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidCalendarDate(y: number, m: number, d: number): boolean {
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

export type DistributorReportResponse = {
  summary: {
    pendingCommissionAmount: number
    settledCommission: number
    distributorCount: number
    newDistributorCount: number
  }
  leaderboard: Array<{
    distributorId: string
    name: string | null
    email: string
    revenue: number
    orderCount: number
    pendingCommission: number
  }>
  newDistributors: Array<{
    id: string
    name: string | null
    email: string
    inviterName: string | null
    inviterEmail: string | null
    createdAt: string
  }>
}

export async function GET(request: Request): Promise<NextResponse> {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { searchParams } = new URL(request.url)
  const from = searchParams.get("from") ?? ""
  const to = searchParams.get("to") ?? ""

  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return badRequest("from and to must be YYYY-MM-DD")
  }
  if (from > to) {
    return badRequest("from must not be after to")
  }

  const [fy, fm, fd] = from.split("-").map(Number)
  const [ty, tm, td] = to.split("-").map(Number)
  if (!isValidCalendarDate(fy, fm, fd) || !isValidCalendarDate(ty, tm, td)) {
    return badRequest("from and to must be valid calendar dates")
  }

  const startUTC = fromZonedTime(new Date(fy, fm - 1, fd, 0, 0, 0, 0), HKT)
  const endUTC = fromZonedTime(new Date(ty, tm - 1, td + 1, 0, 0, 0, 0), HKT)

  const [
    pendingCommissionAgg,
    distributorCount,
    settledCommissionAgg,
    ordersByDistributor,
    newDistributorRows,
  ] = await Promise.all([
    prisma.commission.aggregate({
      where: { status: "PENDING", createdAt: { gte: startUTC, lt: endUTC } },
      _sum: { amount: true },
    }),
    prisma.user.count({ where: { role: "DISTRIBUTOR" } }),
    prisma.commission.aggregate({
      where: { status: "SETTLED", createdAt: { gte: startUTC, lt: endUTC } },
      _sum: { amount: true },
    }),
    prisma.order.groupBy({
      by: ["distributorId"],
      where: {
        status: "COMPLETED",
        distributorId: { not: null },
        paidAt: { gte: startUTC, lt: endUTC },
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.user.findMany({
      where: { role: "DISTRIBUTOR", createdAt: { gte: startUTC, lt: endUTC } },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        inviter: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const distributorIds = ordersByDistributor.map((r) => r.distributorId as string)

  const [distributors, pendingCommissions] =
    distributorIds.length > 0
      ? await Promise.all([
          prisma.user.findMany({
            where: { id: { in: distributorIds } },
            select: { id: true, name: true, email: true },
          }),
          prisma.commission.groupBy({
            by: ["distributorId"],
            where: { distributorId: { in: distributorIds }, status: "PENDING" },
            _sum: { amount: true },
          }),
        ])
      : [[] as Awaited<ReturnType<typeof prisma.user.findMany>>, [] as { distributorId: string; _sum: { amount: unknown } }[]]

  const nameMap = new Map(distributors.map((d) => [d.id, { name: d.name, email: d.email }]))
  const pendingCommissionMap = new Map(
    pendingCommissions.map((c) => [c.distributorId, Number(c._sum.amount ?? 0)])
  )

  const leaderboard = ordersByDistributor
    .map((r) => {
      const info = nameMap.get(r.distributorId as string)
      return {
        distributorId: r.distributorId as string,
        name: info?.name ?? null,
        email: info?.email ?? "",
        revenue: Number(r._sum.amount ?? 0),
        orderCount: r._count.id,
        pendingCommission: pendingCommissionMap.get(r.distributorId as string) ?? 0,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)

  return NextResponse.json<DistributorReportResponse>({
    summary: {
      pendingCommissionAmount: Number(pendingCommissionAgg._sum.amount ?? 0),
      settledCommission: Number(settledCommissionAgg._sum.amount ?? 0),
      distributorCount,
      newDistributorCount: newDistributorRows.length,
    },
    leaderboard,
    newDistributors: newDistributorRows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email ?? "",
      inviterName: u.inviter?.name ?? null,
      inviterEmail: u.inviter?.email ?? null,
      createdAt: u.createdAt.toISOString(),
    })),
  })
}
