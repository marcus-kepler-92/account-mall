import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"

/** Grace period (ms) after timeout before closing orders, to allow Alipay notify to arrive first. */
const PENDING_ORDER_CLOSE_GRACE_MS = 2 * 60 * 1000 // 2 minutes

export interface CloseExpiredOrdersResult {
    closed: number
    total: number
}

/**
 * Finds all PENDING orders older than (pendingOrderTimeoutMs + grace) and closes them,
 * releasing reserved cards back to inventory.
 */
export async function closeExpiredOrders(): Promise<CloseExpiredOrdersResult> {
    const closeBeforeMs = config.pendingOrderTimeoutMs + PENDING_ORDER_CLOSE_GRACE_MS
    const before = new Date(Date.now() - closeBeforeMs)

    const expired = await prisma.order.findMany({
        where: {
            status: "PENDING",
            createdAt: { lt: before },
        },
        select: { id: true },
    })

    if (expired.length === 0) {
        return { closed: 0, total: 0 }
    }

    let closed = 0
    for (const order of expired) {
        try {
            await prisma.$transaction(async (tx) => {
                await tx.order.update({
                    where: { id: order.id },
                    data: { status: "CLOSED" },
                })
                await tx.card.updateMany({
                    where: { orderId: order.id, status: "RESERVED" },
                    data: { status: "UNSOLD", orderId: null },
                })
            })
            closed++
        } catch (err) {
            console.error("[close-expired-orders] Failed to close order", order.id, err)
        }
    }

    return { closed, total: expired.length }
}
