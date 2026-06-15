import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { assertTransition, InvalidTransitionError } from "@/lib/order-state-machine"
import { isZpayConfigured, refundZpayOrder } from "@/lib/zpay"
import {
    cancelOrderCommissions,
    revokeMilestoneBonusesForInviter,
} from "@/lib/domains/distributors"
import {
    unauthorized,
    conflict,
    notFound,
    badRequest,
    internalServerError,
    serviceUnavailable,
} from "@/lib/api-response"

/**
 * POST /api/admin/orders/[orderId]/refund
 *
 * Refund a COMPLETED order through z-pay (zpay act=refund) for the full paid amount,
 * then reverse the downstream side effects of completion:
 *   - order status COMPLETED -> REFUNDED (+ refundedAt)
 *   - this order's commissions (SETTLED/PENDING) -> CANCELLED
 *   - re-check the distributor's inviter's issued milestone bonuses; revoke any that no
 *     longer qualify once this order's sales are excluded
 *
 * Statistics (revenue/profit/weekly tier/milestone qualification) all filter
 * status:"COMPLETED", so flipping to REFUNDED removes the order from them automatically.
 *
 * The provider refund call runs BEFORE the DB transaction (never hold a transaction across a
 * network call). The transaction uses updateMany WHERE status="COMPLETED" as a concurrency
 * guard against double refunds.
 */
export async function POST(_request: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { orderId } = await ctx.params

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            product: { select: { productType: true } },
        },
    })
    if (!order) return notFound("订单不存在")
    if (!order.product) return internalServerError("订单数据异常")

    // Idempotent: a re-request on an already-refunded order (lost response on a committed
    // refund, or a concurrent refund that already finished) is a no-op success, not a 409.
    // The provider is NOT called again, so the buyer can't be double-refunded by a retry.
    if (order.status === "REFUNDED") {
        return NextResponse.json({ ok: true, alreadyRefunded: true })
    }

    // Only COMPLETED orders are refundable.
    try {
        assertTransition(order.status, "REFUNDED", order.product.productType)
    } catch (err) {
        if (err instanceof InvalidTransitionError) return conflict("仅已完成订单可退款")
        throw err
    }

    // Eligibility: only orders paid through z-pay can be refunded online.
    if (!isZpayConfigured()) {
        return conflict("该订单支付渠道不支持在线退款")
    }

    const money = order.amount.toFixed(2)
    const result = await refundZpayOrder(order.orderNo, money)
    if (result === null) return serviceUnavailable("退款请求失败，请稍后重试")
    if (!result.ok) return badRequest(result.message ?? "退款被拒绝")

    // From here the provider refund has SUCCEEDED — the buyer's money is already returned.
    // Any failure below leaves an inconsistency (money out, order still COMPLETED) that needs
    // a distinct, actionable signal + loud log so ops can reconcile this specific order.
    try {
        await prisma.$transaction(async (tx) => {
            // Concurrency guard: only the caller that flips COMPLETED -> REFUNDED runs the
            // reversal. A racing second refund sees count === 0 and aborts.
            const upd = await tx.order.updateMany({
                where: { id: orderId, status: "COMPLETED" },
                data: { status: "REFUNDED", refundedAt: new Date() },
            })
            if (upd.count === 0) {
                throw new ConcurrentRefundError()
            }

            await cancelOrderCommissions(orderId, tx)

            if (order.distributorId) {
                const distributor = await tx.user.findUnique({
                    where: { id: order.distributorId },
                    select: { inviterId: true },
                })
                if (distributor?.inviterId) {
                    await revokeMilestoneBonusesForInviter(tx, distributor.inviterId)
                }
            }
        })
    } catch (err) {
        if (err instanceof ConcurrentRefundError) {
            // Order was no longer COMPLETED when we tried to flip it — another refund/close ran
            // concurrently. The provider refund here ALSO succeeded, so the buyer may have been
            // refunded twice; ops must verify on the payment side.
            console.error(
                "[refund-order] concurrent refund: provider refunded but order already advanced",
                { orderId, orderNo: order.orderNo, money },
            )
            return conflict(
                `订单状态已变更，可能已被并发退款。本次支付侧退款已发起，请核对订单 ${order.orderNo} 是否在支付后台重复退款。`,
            )
        }
        // Provider refund succeeded but the local reversal failed: money is out, but the order
        // is still COMPLETED with commissions/milestones intact. Surface a distinct, actionable
        // error and log loudly so ops can manually reconcile this specific order. A retry is
        // safe — the idempotent REFUNDED short-circuit above prevents a second provider call
        // once the order is flipped, and while it stays COMPLETED zpay will reject the dup.
        console.error(
            "[refund-order] provider refund SUCCEEDED but local reversal FAILED — manual reconciliation needed",
            { orderId, orderNo: order.orderNo, money, error: err },
        )
        return internalServerError(
            `退款已在支付侧完成，但平台订单状态更新失败。请记录订单号 ${order.orderNo} 并联系技术手动处理。`,
        )
    }

    return NextResponse.json({ ok: true })
}

class ConcurrentRefundError extends Error {
    constructor() {
        super("Order no longer COMPLETED")
        this.name = "ConcurrentRefundError"
    }
}
