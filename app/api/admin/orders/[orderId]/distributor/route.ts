import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import {
  unauthorized,
  notFound,
  invalidJsonBody,
  validationError,
  badRequest,
  conflict,
  internalServerError,
} from "@/lib/api-response"
import { createOrderCommissions, toNumber } from "@/lib/calculate-order-commission"

const schema = z.object({
  distributorId: z.string().nullable(),
})

type RouteContext = { params: Promise<{ orderId: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { orderId } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalidJsonBody()
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const { distributorId } = parsed.data

  try {
    // 1. Find order
    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) return notFound("Order not found")
    if (order.status !== "COMPLETED") {
      return badRequest("只能对已完成（COMPLETED）订单修改分销员")
    }

    // 2. Validate new distributor
    if (distributorId !== null) {
      const user = await prisma.user.findUnique({ where: { id: distributorId } })
      if (!user || user.role !== "DISTRIBUTOR") {
        return badRequest("Invalid distributor")
      }
    }

    // 3. Block if any commission has already been paid out (WITHDRAWN).
    // WITHDRAWN commissions represent real money already disbursed — cancelling them would
    // create an irreconcilable ledger discrepancy.
    // Note: guards 3–4 run outside the transaction (pre-flight reads). Under READ COMMITTED
    // isolation a concurrent event could theoretically invalidate these checks, but the
    // window is negligible for an admin-only operation with low concurrency.
    const withdrawnCount = await prisma.commission.count({
      where: { orderId, status: "WITHDRAWN" },
    })
    if (withdrawnCount > 0) {
      return conflict("此订单佣金已提现，无法修改分销归属")
    }

    // 4. Find all existing SETTLED/PENDING commissions for this order
    const existingCommissions = await prisma.commission.findMany({
      where: { orderId, status: { in: ["SETTLED", "PENDING"] } },
      select: { id: true, distributorId: true, amount: true },
    })

    // 5. Check each affected distributor
    if (existingCommissions.length > 0) {
      // Group by distributorId
      const amountByDistributor = new Map<string, number>()
      for (const c of existingCommissions) {
        const prev = amountByDistributor.get(c.distributorId) ?? 0
        amountByDistributor.set(c.distributorId, prev + toNumber(c.amount))
      }

      for (const [distId, cancelAmount] of amountByDistributor) {
        // 5a. PENDING withdrawal check
        const pendingWithdrawals = await prisma.withdrawal.count({
          where: { distributorId: distId, status: "PENDING" },
        })
        if (pendingWithdrawals > 0) {
          return conflict("分销员存在待处理提现申请，无法修改分销归属")
        }

        // 5b. Balance check (PENDING withdrawals already blocked above, so formula is settled − cancel − paid)
        const [settledAgg, paidAgg] = await Promise.all([
          prisma.commission.aggregate({
            where: { distributorId: distId, status: "SETTLED" },
            _sum: { amount: true },
          }),
          prisma.withdrawal.aggregate({
            where: { distributorId: distId, status: "PAID" },
            _sum: { amount: true },
          }),
        ])
        const settled = toNumber(settledAgg._sum.amount)
        const paid = toNumber(paidAgg._sum.amount)
        const balanceAfter = settled - cancelAmount - paid
        if (balanceAfter < 0) {
          return conflict("此订单佣金已被提现消耗，无法修改分销归属")
        }
      }
    }

    // 6. Transaction: cancel old commissions + update order + create new commissions
    await prisma.$transaction(async (tx) => {
      // Cancel all existing commissions for this order
      await tx.commission.updateMany({
        where: { orderId, status: { in: ["SETTLED", "PENDING"] } },
        data: { status: "CANCELLED" },
      })

      // Update order distributorId
      await tx.order.update({
        where: { id: orderId },
        data: { distributorId },
      })

      // Create new commissions if assigning a distributor
      if (distributorId !== null && order.paidAt) {
        await createOrderCommissions(tx, {
          orderId,
          distributorId,
          orderEmail: order.email ?? "",
          orderAmount: order.amount,
          discountPercentApplied: order.discountPercentApplied,
          paidAt: order.paidAt,
        })
      }
    })

    return NextResponse.json({ ok: true })
  } catch {
    return internalServerError()
  }
}

export const runtime = "nodejs"
