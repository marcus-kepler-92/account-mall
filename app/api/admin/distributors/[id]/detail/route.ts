import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, notFound } from "@/lib/api-response"
import { getDistributorDetailBase } from "@/lib/domains/distributors"
import type { DistributorViewRow, TierSummaryItem } from "@/lib/domains/distributors"

export type DistributorDetailResponse = {
  row: DistributorViewRow
  tiers: TierSummaryItem[]
}

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await context.params

  const base = await getDistributorDetailBase(id)
  if (!base) return notFound("Distributor not found")

  return NextResponse.json<DistributorDetailResponse>(base)
}

export const runtime = "nodejs"
