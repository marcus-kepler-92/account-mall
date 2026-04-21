import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, notFound, badRequest } from "@/lib/api-response"
import {
  updateWithdrawalSchema,
  processWithdrawal,
  WithdrawalNotFoundError,
  WithdrawalNotPendingError,
} from "@/lib/domains/distributors"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const { id } = await context.params
  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }
  const parsed = updateWithdrawalSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  try {
    const withdrawal = await processWithdrawal(id, parsed.data)
    return NextResponse.json(withdrawal)
  } catch (e) {
    if (e instanceof WithdrawalNotFoundError) return notFound(e.message)
    if (e instanceof WithdrawalNotPendingError) return badRequest(e.message)
    throw e
  }
}

export const runtime = "nodejs"
