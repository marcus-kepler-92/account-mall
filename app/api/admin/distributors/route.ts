import { NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"
import { listDistributors } from "@/lib/domains/distributors"

export async function GET() {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const distributors = await listDistributors()
  return NextResponse.json(distributors)
}

export const runtime = "nodejs"
