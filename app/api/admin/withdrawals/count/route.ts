import { NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"
import { countPendingWithdrawals } from "@/lib/domains/distributors"

export async function GET() {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const pending = await countPendingWithdrawals()
  return NextResponse.json({ pending })
}

export const runtime = "nodejs"
