import { prisma } from "@/lib/prisma"
import { verifyZpayNotifySign } from "@/lib/zpay"
import { completePendingOrder } from "@/lib/complete-pending-order"

/**
 * Process Zpay notify/return params: verify sign, match order and amount, idempotent complete.
 * Used by POST /api/payment/zpay/notify (async notify) and by pay-return page (sync return_url).
 * Returns { ok: true } when we should respond success (order completed or already completed);
 * { ok: false } when we should respond failure (bad sign, order not found, amount mismatch, etc).
 *
 * Sign verification uses the z-pay key from env config.
 */
export async function processZpayNotifyAndComplete(
    postData: Record<string, unknown>,
): Promise<{ ok: boolean }> {
    const outTradeNo = postData.out_trade_no as string | undefined
    const totalAmount =
        (postData.money as string | undefined) ?? (postData.total_fee as string | undefined)
    const tradeStatus = (postData.trade_status as string | undefined) ?? (postData.status as string | undefined)

    if (!outTradeNo || !totalAmount) {
        return { ok: false }
    }

    if (!verifyZpayNotifySign(postData)) {
        return { ok: false }
    }

    const order = await prisma.order.findFirst({
        where: { orderNo: outTradeNo },
        include: {
            product: { select: { name: true } },
            cards: { select: { id: true, status: true } },
        },
    })

    const isSuccess =
        tradeStatus === "TRADE_SUCCESS" ||
        tradeStatus === "TRADE_FINISHED" ||
        tradeStatus === "success"
    if (!isSuccess) {
        return { ok: true }
    }

    if (!order) {
        return { ok: false }
    }

    const orderAmountStr = (Math.round(Number(order.amount) * 100) / 100).toFixed(2)
    const notifyAmountStr = Number(totalAmount).toFixed(2)
    if (orderAmountStr !== notifyAmountStr) {
        return { ok: false }
    }

    if (order.status === "COMPLETED") {
        console.info("[payment-notify] zpay orderNo=%s amount=%s status=already_completed", outTradeNo, orderAmountStr)
        return { ok: true }
    }
    if (order.status !== "PENDING") {
        return { ok: true }
    }

    console.info("[payment-notify] zpay orderNo=%s amount=%s status=completing", outTradeNo, orderAmountStr)
    await completePendingOrder(outTradeNo)
    return { ok: true }
}
