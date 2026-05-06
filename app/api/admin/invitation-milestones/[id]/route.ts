import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError, notFound, badRequest } from "@/lib/api-response"
import {
  updateMilestoneSchema,
  updateInvitationMilestone,
  deleteInvitationMilestone,
  InvitationMilestoneNotFoundError,
  InvitationMilestoneHasBonusesError,
} from "@/lib/domains/distributors"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const { id } = await context.params
  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }
  const parsed = updateMilestoneSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())
  try {
    const milestone = await updateInvitationMilestone(id, parsed.data)
    return NextResponse.json(milestone)
  } catch (e) {
    if (e instanceof InvitationMilestoneNotFoundError) return notFound(e.message)
    throw e
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const { id } = await context.params
  try {
    await deleteInvitationMilestone(id)
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    if (e instanceof InvitationMilestoneNotFoundError) return notFound(e.message)
    if (e instanceof InvitationMilestoneHasBonusesError) return badRequest(e.message)
    throw e
  }
}

export const runtime = "nodejs"
