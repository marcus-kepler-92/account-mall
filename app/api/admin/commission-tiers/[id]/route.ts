import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError, notFound, badRequest } from "@/lib/api-response"
import {
  updateTierSchema,
  updateCommissionTier,
  deleteCommissionTier,
  CommissionTierNotFoundError,
  TierRangeError,
} from "@/lib/domains/distributors"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const { id } = await context.params
  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }
  const parsed = updateTierSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())
  try {
    const tier = await updateCommissionTier(id, parsed.data)
    return NextResponse.json(tier)
  } catch (e) {
    if (e instanceof CommissionTierNotFoundError) return notFound(e.message)
    if (e instanceof TierRangeError) return badRequest(e.message)
    throw e
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const { id } = await context.params
  try {
    await deleteCommissionTier(id)
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    if (e instanceof CommissionTierNotFoundError) return notFound(e.message)
    throw e
  }
}

export const runtime = "nodejs"
