import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { sendOrderCompletionEmail } from "@/lib/order-completion-email"

/** Natural week: Monday 00:00:00 UTC for the given date. */
function getWeekStart(date: Date): Date {
    const d = new Date(date)
    const day = d.getUTCDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setUTCDate(d.getUTCDate() + diff)
    d.setUTCHours(0, 0, 0, 0)
    return d
}

export type CompletePendingOrderResult =
    | { done: true; orderNo: string }
    | { done: false; error: string }

/**
 * Complete a PENDING order by orderNo: set order to COMPLETED + paidAt, cards to SOLD, send completion email.
 * Idempotent for already COMPLETED orders (returns done: true without updating).
 * Returns { done: false, error } when order not found or not PENDING.
 * Throws when the transaction fails (e.g. DB error).
 */
export async function completePendingOrder(
    orderNo: string,
): Promise<CompletePendingOrderResult> {
    const order = await prisma.order.findFirst({
        where: { orderNo },
        include: {
            product: { select: { name: true, commissionAmount: true } },
            cards: { select: { id: true, status: true } },
        },
    })
    if (!order) {
        return { done: false, error: "Order not found" }
    }
    if (order.status === "COMPLETED") {
        return { done: true, orderNo: order.orderNo }
    }
    if (order.status !== "PENDING") {
        return { done: false, error: "Order is not pending" }
    }

    const now = new Date()
    const paidAt = now

    let didUpdate = false
    await prisma.$transaction(async (tx) => {
        const updateResult = await tx.order.updateMany({
            where: { id: order.id, status: "PENDING" },
            data: { status: "COMPLETED", paidAt },
        })
        if (updateResult.count > 0) {
            didUpdate = true
            await tx.card.updateMany({
                where: { orderId: order.id, status: "RESERVED" },
                data: { status: "SOLD" },
            })
        }

        // Commission: only when we actually completed this order and order has a distributor
        if (!didUpdate) return
        const distributorId = order.distributorId
        if (distributorId) {
            // 防刷：下单邮箱与分销员账号邮箱一致则不记佣金（自买不归因）
            const distributor = await tx.user.findUnique({
                where: { id: distributorId },
                select: { email: true },
            })
            const orderEmailNorm = order.email?.trim().toLowerCase() ?? ""
            const distributorEmailNorm = distributor?.email?.trim().toLowerCase() ?? ""
            if (orderEmailNorm && orderEmailNorm === distributorEmailNorm) {
                return
            }

            // 以下单时快照为准，避免完成后改商品佣金导致结算不一致
            const product = order.product as { commissionAmount: Prisma.Decimal | null }
            const commissionPerUnit = order.commissionAmountSnapshot ?? product?.commissionAmount ?? 0
            const baseAmount = Number(commissionPerUnit) * order.quantity

            // Weekly tier: distributor's completed order amount this week (including this order)
            const weekStart = getWeekStart(paidAt)
            const weekEnd = new Date(weekStart)
            weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)

            const weekOrders = await tx.order.findMany({
                where: {
                    distributorId,
                    status: "COMPLETED",
                    paidAt: { gte: weekStart, lt: weekEnd },
                },
                select: { amount: true },
            })
            const weekTotal = weekOrders.reduce((sum, o) => sum + Number(o.amount), 0)

            const tiers = await tx.commissionTier.findMany({
                orderBy: { sortOrder: "asc" },
            })
            let tierBonus = 0
            for (const tier of tiers) {
                const min = Number(tier.minAmount)
                const max = Number(tier.maxAmount)
                if (weekTotal >= min && weekTotal < max) {
                    tierBonus = Number(order.amount) * Number(tier.ratePercent) / 100
                    break
                }
            }

            const totalCommission = Math.round((baseAmount + tierBonus) * 100) / 100
            if (totalCommission > 0) {
                await tx.commission.create({
                    data: {
                        orderId: order.id,
                        distributorId,
                        amount: totalCommission,
                        status: "SETTLED",
                    },
                })
            }
        }
    })

    if (didUpdate) {
        sendOrderCompletionEmail(order.id).catch((err) =>
            console.error("[order-completion-email]", err),
        )
    }

    return { done: true, orderNo: order.orderNo }
}
