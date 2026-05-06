import { NextRequest, NextResponse } from "next/server"
import { getDistributorSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"
import { listDistributorMilestoneBonuses } from "@/lib/domains/distributors"

export async function GET(request: NextRequest) {
  const session = await getDistributorSession()
  if (!session) return unauthorized()
  const user = session.user as { id: string }
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20")))
  const result = await listDistributorMilestoneBonuses(user.id, page, pageSize)
  return NextResponse.json(result)
}

export const runtime = "nodejs"
