import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError, badRequest } from "@/lib/api-response"
import {
  createTierSchema,
  listCommissionTiers,
  createCommissionTier,
  TierRangeError,
} from "@/lib/domains/distributors"

export async function GET() {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const tiers = await listCommissionTiers()
  return NextResponse.json(tiers)
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }
  const parsed = createTierSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())
  try {
    const tier = await createCommissionTier(parsed.data)
    return NextResponse.json(tier, { status: 201 })
  } catch (e) {
    if (e instanceof TierRangeError) return badRequest(e.message)
    throw e
  }
}

export const runtime = "nodejs"
