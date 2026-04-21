import { NextRequest, NextResponse } from "next/server"
import { getSuperAdminSession } from "@/lib/auth-guard"
import { unauthorized, notFound, invalidJsonBody, validationError, badRequest, conflict, internalServerError } from "@/lib/api-response"
import {
  reassignDistributorSchema,
  reassignOrderDistributor,
  CommissionWithdrawnError,
  PendingWithdrawalBlocksReassignError,
  CommissionAlreadyPaidOutError,
} from "@/lib/domains/distributors"

type RouteContext = { params: Promise<{ orderId: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSuperAdminSession()
  if (!session) return unauthorized()
  const { orderId } = await context.params
  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }
  const parsed = reassignDistributorSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())
  try {
    await reassignOrderDistributor(orderId, parsed.data.distributorId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof CommissionWithdrawnError) return conflict(e.message)
    if (e instanceof PendingWithdrawalBlocksReassignError) return conflict(e.message)
    if (e instanceof CommissionAlreadyPaidOutError) return conflict(e.message)
    if (e instanceof Error && e.message === "ORDER_NOT_FOUND") return notFound("Order not found")
    if (e instanceof Error && e.message === "ORDER_NOT_COMPLETED") return badRequest("只能对已完成（COMPLETED）订单修改分销员")
    if (e instanceof Error && e.message === "INVALID_DISTRIBUTOR") return badRequest("Invalid distributor")
    return internalServerError()
  }
}

export const runtime = "nodejs"
