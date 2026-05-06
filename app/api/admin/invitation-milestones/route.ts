import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError } from "@/lib/api-response"
import {
  createMilestoneSchema,
  listInvitationMilestones,
  createInvitationMilestone,
} from "@/lib/domains/distributors"

export async function GET() {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const milestones = await listInvitationMilestones()
  return NextResponse.json(milestones)
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }
  const parsed = createMilestoneSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())
  const milestone = await createInvitationMilestone(parsed.data)
  return NextResponse.json(milestone, { status: 201 })
}

export const runtime = "nodejs"
