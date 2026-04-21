import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"
import { listAdminWithdrawals } from "@/lib/domains/distributors"

export async function GET(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const { searchParams } = new URL(request.url)
  const rawStatus = searchParams.get("status")
  const status =
    rawStatus === "PENDING" || rawStatus === "PAID" || rawStatus === "REJECTED"
      ? rawStatus
      : undefined
  const withdrawals = await listAdminWithdrawals(status)
  return NextResponse.json(withdrawals)
}

export const runtime = "nodejs"
