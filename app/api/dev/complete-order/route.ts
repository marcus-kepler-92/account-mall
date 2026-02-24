import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"
import { createOrderSuccessToken } from "@/lib/order-success-token"
import { sendOrderCompletionEmail } from "@/lib/order-completion-email"
import { badRequest, notFound } from "@/lib/api-response"

/**
 * POST /api/dev/complete-order
 * Development only: complete a PENDING order (mock payment). Returns redirectUrl to success or lookup page.
 */
export async function POST(request: Request) {
    if (config.nodeEnv !== "development") {
        return NextResponse.json({ error: "Not available" }, { status: 404 })
    }

    let body: { orderNo?: string }
    try {
        body = await request.json()
    } catch {
        return badRequest("Invalid JSON")
    }
    const orderNo = typeof body?.orderNo === "string" ? body.orderNo.trim() : ""
    if (!orderNo) return badRequest("orderNo is required")

    const order = await prisma.order.findFirst({
        where: { orderNo },
        include: { product: { select: { name: true } }, cards: { select: { id: true, status: true } } },
    })
    if (!order) return notFound("Order not found")
    if (order.status === "COMPLETED") {
        const base = config.siteUrl ?? "http://localhost:3000"
        const token = createOrderSuccessToken(orderNo)
        const redirectUrl = token
            ? `${base}/orders/${encodeURIComponent(orderNo)}/success?token=${encodeURIComponent(token)}`
            : `${base}/orders/lookup?orderNo=${encodeURIComponent(orderNo)}&fromPay=1`
        return NextResponse.json({ redirectUrl })
    }
    if (order.status !== "PENDING") {
        return badRequest("Order is not pending")
    }

    await prisma.$transaction(async (tx) => {
        await tx.order.updateMany({
            where: { id: order.id, status: "PENDING" },
            data: { status: "COMPLETED", paidAt: new Date() },
        })
        await tx.card.updateMany({
            where: { orderId: order.id, status: "RESERVED" },
            data: { status: "SOLD" },
        })
    })

    sendOrderCompletionEmail(order.id).catch((err) =>
        console.error("[order-completion-email]", err),
    )

    const base = config.siteUrl ?? "http://localhost:3000"
    const token = createOrderSuccessToken(orderNo)
    const redirectUrl = token
        ? `${base}/orders/${encodeURIComponent(orderNo)}/success?token=${encodeURIComponent(token)}`
        : `${base}/orders/lookup?orderNo=${encodeURIComponent(orderNo)}&fromPay=1`

    return NextResponse.json({ redirectUrl })
}
