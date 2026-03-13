import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"

/** Grace period (ms) after timeout before closing orders, to allow Alipay notify to arrive first. */
const PENDING_ORDER_CLOSE_GRACE_MS = 2 * 60 * 1000 // 2 minutes

export interface CloseExpiredOrdersResult {
    closed: number
    total: number
}

/**
 * Finds all PENDING orders older than (pendingOrderTimeoutMs + grace) and closes them.
 * - NORMAL product orders: release reserved cards back to inventory (RESERVED → UNSOLD)
 * - AUTO_FETCH product orders: delete temporary cards (no inventory concept)
 */
export async function closeExpiredOrders(): Promise<CloseExpiredOrdersResult> {
    const closeBeforeMs = config.pendingOrderTimeoutMs + PENDING_ORDER_CLOSE_GRACE_MS
    const before = new Date(Date.now() - closeBeforeMs)

    const expired = await prisma.order.findMany({
        where: {
            status: "PENDING",
            createdAt: { lt: before },
        },
        select: {
            id: true,
            product: {
                select: { productType: true },
            },
        },
    })

    if (expired.length === 0) {
        return { closed: 0, total: 0 }
    }

    let closed = 0
    for (const order of expired) {
        try {
            const isAutoFetch = order.product?.productType === "AUTO_FETCH"
            await prisma.$transaction(async (tx) => {
                await tx.order.update({
                    where: { id: order.id },
                    data: { status: "CLOSED" },
                })
                if (isAutoFetch) {
                    // AUTO_FETCH: 临时爬取的卡密无法回库，直接删除
                    await tx.card.deleteMany({
                        where: { orderId: order.id, status: "RESERVED" },
                    })
                } else {
                    // NORMAL: 预存卡密回库
                    await tx.card.updateMany({
                        where: { orderId: order.id, status: "RESERVED" },
                        data: { status: "UNSOLD", orderId: null },
                    })
                }
            })
            closed++
        } catch (err) {
            console.error("[close-expired-orders] Failed to close order", order.id, err)
        }
    }

    return { closed, total: expired.length }
}
