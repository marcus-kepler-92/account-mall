import { NextRequest, NextResponse } from "next/server"
import { getDistributorSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"
import { listDistributorCommissions } from "@/lib/domains/distributors"

export async function GET(request: NextRequest) {
  const session = await getDistributorSession()
  if (!session) return unauthorized()

  const user = session.user as { id: string }
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)))
  const statusRaw = searchParams.get("status")
  const status = (statusRaw === "PENDING" || statusRaw === "SETTLED" || statusRaw === "WITHDRAWN")
    ? statusRaw
    : undefined

  const result = await listDistributorCommissions(user.id, status, page, pageSize)
  return NextResponse.json(result)
}
