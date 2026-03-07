import { prisma } from "@/lib/prisma"
import { sendOrderCompletionEmail } from "@/lib/order-completion-email"

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
        include: { product: { select: { name: true } }, cards: { select: { id: true, status: true } } },
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

    await prisma.$transaction(async (tx) => {
        const updateResult = await tx.order.updateMany({
            where: { id: order.id, status: "PENDING" },
            data: { status: "COMPLETED", paidAt: new Date() },
        })
        if (updateResult.count > 0) {
            await tx.card.updateMany({
                where: { orderId: order.id, status: "RESERVED" },
                data: { status: "SOLD" },
            })
        }
    })

    sendOrderCompletionEmail(order.id).catch((err) =>
        console.error("[order-completion-email]", err),
    )

    return { done: true, orderNo: order.orderNo }
}
