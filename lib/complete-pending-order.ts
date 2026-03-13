import { prisma } from "@/lib/prisma"
import { sendOrderCompletionEmail } from "@/lib/order-completion-email"
import { getConfig } from "@/lib/config"

/** Prisma Decimal 等转为 number，避免 Number(decimal) 在部分环境为 NaN 导致佣金为 0 */
function toNumber(value: unknown): number {
    if (typeof value === "number" && !Number.isNaN(value)) return value
    const d = value as { toNumber?: () => number }
    if (typeof d?.toNumber === "function") return d.toNumber()
    const n = Number(value)
    return Number.isNaN(n) ? 0 : n
}

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
            product: { select: { name: true } },
            cards: { select: { id: true, status: true } },
        },
        // 同时取出 exitDiscountMeta 用于事后写 ExitDiscountUsage
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

            // Commission: tier-only (percentage of order amount), no per-item fixed amount
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
            const weekTotal = weekOrders.reduce((sum, o) => sum + toNumber(o.amount), 0)

            const tiers = await tx.commissionTier.findMany({
                orderBy: { sortOrder: "asc" },
            })
            let ratePercent: number | null = null
            for (const tier of tiers) {
                const min = toNumber(tier.minAmount)
                const max = toNumber(tier.maxAmount)
                if (weekTotal >= min && weekTotal < max) {
                    ratePercent = toNumber(tier.ratePercent)
                    break
                }
            }
            // 当周销售额未落入任何档位时（如首单 9 元且最低档从 400 起），按最低档比例算佣金，避免 0 佣金
            if (ratePercent == null && tiers.length > 0) {
                ratePercent = toNumber(tiers[0].ratePercent)
            }
            // 佣金按原价（折前）计算：有折扣时用 实付 / (1 - 折扣比例) 反推原价
            const paidAmount = toNumber(order.amount)
            const discountPct = toNumber(order.discountPercentApplied)
            const commissionBase =
                discountPct > 0 && discountPct < 100 ? paidAmount / (1 - discountPct / 100) : paidAmount
            const tierBonus =
                ratePercent != null && commissionBase > 0 ? (commissionBase * ratePercent) / 100 : 0
            const totalCommission = Math.round(tierBonus * 100) / 100
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

            // 邀请奖励：被邀请人（本单分销员）首单完成时，给邀请人发一笔固定金额，每名被邀请人只发一次
            const completedCount = await tx.order.count({
                where: { distributorId, status: "COMPLETED" },
            })
            if (completedCount === 1) {
                const invitee = await tx.user.findUnique({
                    where: { id: distributorId },
                    select: { inviterId: true },
                })
                if (invitee?.inviterId) {
                    const existing = await tx.invitationReward.findUnique({
                        where: { inviteeId: distributorId },
                    })
                    if (!existing) {
                        const amount = getConfig().invitationRewardAmount
                        if (amount > 0) {
                            await tx.invitationReward.create({
                                data: {
                                    inviterId: invitee.inviterId,
                                    inviteeId: distributorId,
                                    orderId: order.id,
                                    amount,
                                    status: "SETTLED",
                                },
                            })
                        }
                    }
                }
            }
        }
    })

    if (didUpdate) {
        sendOrderCompletionEmail(order.id).catch((err) =>
            console.error("[order-completion-email]", err),
        )

        // Exit intent 折扣：订单真正完成时才记录使用记录，防止未付款占坑
        if (order.exitDiscountMeta) {
            writeExitDiscountUsage(order.id, order.exitDiscountMeta).catch((err) =>
                console.error("[exit-discount-usage]", err),
            )
        }
    }

    return { done: true, orderNo: order.orderNo }
}

async function writeExitDiscountUsage(orderId: string, metaJson: string): Promise<void> {
    try {
        const meta = JSON.parse(metaJson) as {
            productId: string
            visitorId: string
            fingerprintHash: string
            ip: string
        }
        await prisma.exitDiscountUsage.create({
            data: {
                productId: meta.productId,
                orderId,
                visitorId: meta.visitorId,
                fingerprintHash: meta.fingerprintHash,
                ip: meta.ip,
            },
        })
    } catch (err) {
        console.error("[exit-discount-usage] Failed to write usage record:", err)
    }
}
