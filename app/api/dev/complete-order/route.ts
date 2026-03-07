import { NextResponse } from "next/server"
import { config } from "@/lib/config"
import { createOrderSuccessToken } from "@/lib/order-success-token"
import { completePendingOrder } from "@/lib/complete-pending-order"
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

    const result = await completePendingOrder(orderNo)
    if (!result.done) {
        if (result.error === "Order not found") {
            return notFound("Order not found")
        }
        return badRequest(result.error)
    }

    const base = config.siteUrl ?? "http://localhost:3000"
    const token = createOrderSuccessToken(result.orderNo)
    const redirectUrl = token
        ? `${base}/orders/${encodeURIComponent(result.orderNo)}/success?token=${encodeURIComponent(token)}`
        : `${base}/orders/lookup?orderNo=${encodeURIComponent(result.orderNo)}&fromPay=1`

    return NextResponse.json({ redirectUrl })
}
