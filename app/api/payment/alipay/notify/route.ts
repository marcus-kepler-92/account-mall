import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAlipayNotifySign } from "@/lib/alipay"
import { completePendingOrder } from "@/lib/complete-pending-order"

/**
 * POST /api/payment/alipay/notify
 * Alipay async notify (异步通知). Verify sign, match order and amount, idempotent complete.
 * Returns plain text "success" or "failure".
 */
export async function POST(request: NextRequest) {
    let postData: Record<string, unknown>
    try {
        const formData = await request.formData()
        postData = Object.fromEntries(
            Array.from(formData.entries()).map(([k, v]) => [k, typeof v === "string" ? v : ""]),
        ) as Record<string, unknown>
    } catch {
        return new NextResponse("failure", { status: 400, headers: { "Content-Type": "text/plain" } })
    }

    if (!verifyAlipayNotifySign(postData)) {
        console.warn("[alipay/notify] Sign verification failed", {
            out_trade_no: postData.out_trade_no,
        })
        return new NextResponse("failure", { status: 400, headers: { "Content-Type": "text/plain" } })
    }

    const tradeStatus = postData.trade_status as string | undefined
    const outTradeNo = postData.out_trade_no as string | undefined
    const totalAmount = postData.total_amount as string | undefined

    if (!outTradeNo || !totalAmount) {
        return new NextResponse("failure", { status: 400, headers: { "Content-Type": "text/plain" } })
    }

    // TRADE_SUCCESS = 交易支付成功
    if (tradeStatus !== "TRADE_SUCCESS" && tradeStatus !== "TRADE_FINISHED") {
        return new NextResponse("success", { headers: { "Content-Type": "text/plain" } })
    }

    const order = await prisma.order.findFirst({
        where: { orderNo: outTradeNo },
        include: { product: { select: { name: true } }, cards: { select: { id: true, status: true } } },
    })

    if (!order) {
        console.warn("[alipay/notify] Order not found", { out_trade_no: outTradeNo })
        return new NextResponse("failure", { status: 400, headers: { "Content-Type": "text/plain" } })
    }

    const orderAmountStr = (Math.round(Number(order.amount) * 100) / 100).toFixed(2)
    if (orderAmountStr !== totalAmount) {
        console.warn("[alipay/notify] Amount mismatch", {
            orderNo: outTradeNo,
            orderAmount: orderAmountStr,
            totalAmount,
        })
        return new NextResponse("failure", { status: 400, headers: { "Content-Type": "text/plain" } })
    }

    if (order.status === "COMPLETED") {
        console.info("[payment-notify] alipay orderNo=%s amount=%s status=already_completed", outTradeNo, orderAmountStr)
        return new NextResponse("success", { headers: { "Content-Type": "text/plain" } })
    }

    if (order.status !== "PENDING") {
        console.warn("[alipay/notify] TRADE_SUCCESS but order not PENDING (possible race with cron)", {
            orderNo: outTradeNo,
            status: order.status,
        })
        return new NextResponse("success", { headers: { "Content-Type": "text/plain" } })
    }

    console.info("[payment-notify] alipay orderNo=%s amount=%s status=completing", outTradeNo, orderAmountStr)
    await completePendingOrder(outTradeNo)
    return new NextResponse("success", { headers: { "Content-Type": "text/plain" } })
}

export const runtime = "nodejs"
