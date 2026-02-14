import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAlipayPagePayUrl, getAlipayWapPayUrl } from "@/lib/alipay"

/**
 * POST /api/payment/alipay/create
 * Create Alipay payment for an existing PENDING order.
 * Body: { orderNo: string, clientType?: "pc" | "wap" }
 * Returns: { paymentUrl: string } or 400/404 when order invalid or Alipay not configured.
 */
export async function POST(request: NextRequest) {
    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const raw = body && typeof body === "object" && "orderNo" in body
        ? { orderNo: (body as any).orderNo, clientType: (body as any).clientType }
        : { orderNo: undefined, clientType: undefined }
    const orderNo = typeof raw.orderNo === "string" ? raw.orderNo.trim() : ""
    const clientType = raw.clientType === "wap" ? "wap" : "pc"

    if (!orderNo) {
        return NextResponse.json({ error: "orderNo is required" }, { status: 400 })
    }

    const order = await prisma.order.findFirst({
        where: { orderNo },
        include: {
            product: { select: { name: true } },
        },
    })

    if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }
    if (order.status !== "PENDING") {
        return NextResponse.json(
            { error: "Order is not pending payment" },
            { status: 400 },
        )
    }

    const totalAmount = Number(order.amount).toFixed(2)
    const subject = order.product?.name ?? `订单 ${orderNo}`

    const paymentUrl =
        clientType === "wap"
            ? getAlipayWapPayUrl({ orderNo, totalAmount, subject })
            : getAlipayPagePayUrl({ orderNo, totalAmount, subject })

    if (!paymentUrl) {
        return NextResponse.json(
            { error: "Payment is not configured or failed to generate URL" },
            { status: 503 },
        )
    }

    return NextResponse.json({ paymentUrl })
}
