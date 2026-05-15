import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, notFound } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { buildDistributorViewRows } from "@/app/admin/(main)/distributors/distributor-rows-data"
import type { DistributorRow } from "@/app/admin/(main)/distributors/distributors-row-types"
import type { TierSummaryItem } from "@/lib/domains/distributors"

export type DistributorDetailResponse = {
  row: DistributorRow
  tiers: TierSummaryItem[]
}

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await context.params

  const [user, tiersRaw] = await Promise.all([
    prisma.user.findUnique({
      where: { id, role: "DISTRIBUTOR" },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        distributorCode: true,
        discountCodeEnabled: true,
        discountPercent: true,
        disabledAt: true,
        createdAt: true,
        inviter: {
          select: { id: true, name: true, distributorCode: true },
        },
      },
    }),
    prisma.commissionTier.findMany({ orderBy: { sortOrder: "asc" } }),
  ])

  if (!user) return notFound("Distributor not found")

  const rows = await buildDistributorViewRows([user])
  const row = rows[0]

  const tiers: TierSummaryItem[] = tiersRaw.map((t) => ({
    minAmount: Number(t.minAmount),
    maxAmount: Number(t.maxAmount),
    ratePercent: Number(t.ratePercent),
    sortOrder: t.sortOrder,
  }))

  return NextResponse.json<DistributorDetailResponse>({ row, tiers })
}

export const runtime = "nodejs"
