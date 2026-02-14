import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAlipayNotifySign } from "@/lib/alipay"
import { sendOrderCompletionEmail } from "@/lib/order-completion-email"

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
        return new NextResponse("failure", { status: 400, headers: { "Content-Type": "text/plain" } })
    }

    const orderAmount = Number(order.amount).toFixed(2)
    if (orderAmount !== totalAmount) {
        return new NextResponse("failure", { status: 400, headers: { "Content-Type": "text/plain" } })
    }

    if (order.status === "COMPLETED") {
        return new NextResponse("success", { headers: { "Content-Type": "text/plain" } })
    }

    if (order.status !== "PENDING") {
        return new NextResponse("success", { headers: { "Content-Type": "text/plain" } })
    }

    try {
        await prisma.$transaction(async (tx) => {
            await tx.order.update({
                where: { id: order.id },
                data: { status: "COMPLETED", paidAt: new Date() },
            })
            await tx.card.updateMany({
                where: { orderId: order.id, status: "RESERVED" },
                data: { status: "SOLD" },
            })
        })
    } catch {
        return new NextResponse("failure", { status: 500, headers: { "Content-Type": "text/plain" } })
    }

    sendOrderCompletionEmail(order.id).catch((err) =>
        console.error("[order-completion-email]", err),
    )

    return new NextResponse("success", { headers: { "Content-Type": "text/plain" } })
}

export const runtime = "nodejs"
