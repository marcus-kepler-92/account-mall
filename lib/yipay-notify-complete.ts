import { prisma } from "@/lib/prisma"
import { verifyYipayNotifySign } from "@/lib/yipay"
import { sendOrderCompletionEmail } from "@/lib/order-completion-email"

/**
 * Process Yipay notify/return params: verify sign, match order and amount, idempotent complete.
 * Used by POST /api/payment/yipay/notify (async notify) and by pay-return page (sync return_url).
 * Returns { ok: true } when we should respond success (order completed or already completed);
 * { ok: false } when we should respond failure (bad sign, order not found, amount mismatch, etc).
 */
export async function processYipayNotifyAndComplete(
    postData: Record<string, unknown>,
): Promise<{ ok: boolean }> {
    if (!verifyYipayNotifySign(postData)) {
        return { ok: false }
    }

    const outTradeNo = postData.out_trade_no as string | undefined
    const totalAmount =
        (postData.money as string | undefined) ?? (postData.total_fee as string | undefined)
    const tradeStatus = (postData.trade_status as string | undefined) ?? (postData.status as string | undefined)

    if (!outTradeNo || !totalAmount) {
        return { ok: false }
    }

    const isSuccess =
        tradeStatus === "TRADE_SUCCESS" ||
        tradeStatus === "TRADE_FINISHED" ||
        tradeStatus === "success"
    if (!isSuccess) {
        return { ok: true }
    }

    const order = await prisma.order.findFirst({
        where: { orderNo: outTradeNo },
        include: { product: { select: { name: true } }, cards: { select: { id: true, status: true } } },
    })
    if (!order) {
        return { ok: false }
    }

    const orderAmountStr = (Math.round(Number(order.amount) * 100) / 100).toFixed(2)
    const notifyAmountStr = Number(totalAmount).toFixed(2)
    if (orderAmountStr !== notifyAmountStr) {
        return { ok: false }
    }

    if (order.status === "COMPLETED") {
        return { ok: true }
    }
    if (order.status !== "PENDING") {
        return { ok: true }
    }

    let completedInThisRequest = 0
    completedInThisRequest = await prisma.$transaction(async (tx) => {
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
        return updateResult.count
    })

    if (completedInThisRequest > 0) {
        sendOrderCompletionEmail(order.id).catch((err) =>
            console.error("[order-completion-email]", err),
        )
    }
    return { ok: true }
}
