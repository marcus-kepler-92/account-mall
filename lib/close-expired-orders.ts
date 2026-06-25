import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"
import { queryZpayOrder } from "@/lib/zpay"
import { completePendingOrder } from "@/lib/complete-pending-order"

/** Grace period (ms) after timeout before closing orders, to allow notify to arrive first. */
const PENDING_ORDER_CLOSE_GRACE_MS = 2 * 60 * 1000 // 2 minutes

export interface CloseExpiredOrdersResult {
    /** Orders positively confirmed unpaid and closed. */
    closed: number
    /** Orders the gateway said were paid (notify was lost) and we rescued via active query. */
    recovered: number
    /** Orders left PENDING this round because the gateway query was inconclusive. */
    deferred: number
    total: number
    failedOrderNos: string[]
}

/**
 * Finds all PENDING orders older than (pendingOrderTimeoutMs + grace) and reconciles
 * each against Zpay (the source of truth) BEFORE any irreversible close:
 *
 * - paid       → the notify was lost; complete the order instead of closing it.
 * - unpaid     → gateway confirms not paid → close.
 * - not_found  → gateway never saw the order (customer never reached it) → close.
 * - error      → cannot tell → leave PENDING (bias to not-close for money safety);
 *                past the backstop, escalate for human review instead of closing.
 *
 * Closing releases reserved cards: NORMAL orders return them to inventory
 * (RESERVED → UNSOLD), AUTO_FETCH orders delete the temporary cards.
 */
export async function closeExpiredOrders(): Promise<CloseExpiredOrdersResult> {
    const closeBeforeMs = config.pendingOrderTimeoutMs + PENDING_ORDER_CLOSE_GRACE_MS
    const now = Date.now()
    const before = new Date(now - closeBeforeMs)

    const expired = await prisma.order.findMany({
        where: {
            status: "PENDING",
            createdAt: { lt: before },
        },
        select: {
            id: true,
            orderNo: true,
            createdAt: true,
            product: {
                select: { productType: true },
            },
        },
    })

    if (expired.length === 0) {
        return { closed: 0, recovered: 0, deferred: 0, total: 0, failedOrderNos: [] }
    }

    let closed = 0
    let recovered = 0
    let deferred = 0
    const failedOrderNos: string[] = []

    for (const order of expired) {
        try {
            // Active reconciliation against the gateway before any irreversible close.
            const query = await queryZpayOrder(order.orderNo)

            if (query.status === "paid") {
                // Notify was lost but the customer paid. completePendingOrder has its
                // own PENDING-guarded, idempotent write — safe to call here. If it fails
                // (e.g. DB error), leave the order PENDING and retry next run; never let
                // it fall through to the close path.
                try {
                    await completePendingOrder(order.orderNo)
                    recovered++
                    console.info("[close-expired] orderNo=%s decision=recover", order.orderNo)
                } catch (err) {
                    console.error(
                        "[close-expired] orderNo=%s decision=recover_failed (gateway paid, will retry)",
                        order.orderNo,
                        err,
                    )
                    failedOrderNos.push(order.orderNo)
                }
                continue
            }

            if (query.status === "error") {
                // Inconclusive: bias to NOT closing (closing a paid order is the costly
                // error). Leave PENDING for the next run. Past the backstop, escalate
                // rather than retry forever or auto-close a possibly-paid order.
                const ageMs = now - order.createdAt.getTime()
                if (ageMs > config.zpayReconcileBackstopMs) {
                    console.error(
                        "[close-expired] orderNo=%s decision=escalate reason=persistent_query_error age_ms=%d",
                        order.orderNo,
                        ageMs,
                    )
                } else {
                    console.warn("[close-expired] orderNo=%s decision=defer reason=query_error", order.orderNo)
                }
                deferred++
                continue
            }

            // "unpaid" | "not_found": gateway positively confirms no payment → close.
            const isAutoFetch = order.product?.productType === "AUTO_FETCH"
            const didClose = await prisma.$transaction(async (tx) => {
                // Status-guarded write: a payment notify may have advanced this order
                // PENDING→COMPLETED between the gateway query and here (the query round
                // trip only widens that window). The `status: "PENDING"` guard makes the
                // close a no-op (count=0) in that case, so we never clobber a paid order.
                // PENDING→CLOSED is legal for ALL product types per lib/order-state-machine.ts.
                const closeResult = await tx.order.updateMany({
                    where: { id: order.id, status: "PENDING" },
                    data: { status: "CLOSED" },
                })
                if (closeResult.count === 0) {
                    // Concurrent payment won the race; leave the order/cards alone.
                    return false
                }
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
                return true
            })
            if (didClose) {
                closed++
                console.info("[close-expired] orderNo=%s decision=close reason=%s", order.orderNo, query.status)
            } else {
                console.info("[close-expired] orderNo=%s decision=skip reason=concurrent_completion", order.orderNo)
            }
        } catch (err) {
            console.error("[close-expired-orders] Failed to close order", order.orderNo ?? order.id, err)
            failedOrderNos.push(order.orderNo ?? order.id)
        }
    }

    return { closed, recovered, deferred, total: expired.length, failedOrderNos }
}
