import { NextResponse } from "next/server"
import { getDistributorSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"
import { getDistributorProfile } from "@/lib/domains/distributors"

export async function GET() {
  const session = await getDistributorSession()
  if (!session) return unauthorized()

  const user = session.user as {
    id: string
    email?: string
    name?: string
    distributorCode?: string | null
  }

  const profile = await getDistributorProfile(user.id, user.distributorCode)
  return NextResponse.json({ id: user.id, email: user.email, name: user.name, ...profile })
}
