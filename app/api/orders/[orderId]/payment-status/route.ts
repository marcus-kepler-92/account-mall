import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyOrderSuccessToken } from "@/lib/order-success-token"
import { checkOrderQueryRateLimit } from "@/lib/rate-limit"
import { queryZpayOrder } from "@/lib/zpay"
import { completePendingOrder } from "@/lib/complete-pending-order"

const NO_STORE = { "Cache-Control": "no-store" }

type RouteContext = {
    params: Promise<{ orderId: string }>
}

/**
 * GET /api/orders/[orderNo]/payment-status?token=...
 * Public endpoint: poll order payment status during the awaiting-payment flow.
 * Route param orderId carries the orderNo (same convention as refresh/switch-account).
 * Returns { status: "PENDING" | "COMPLETED" | "CLOSED" } — no card content.
 * Security: token must be a valid order-success-token issued by pay-return after Zpay sign check.
 */
export async function GET(request: NextRequest, context: RouteContext) {
    // Rate-limit first — before any HMAC computation or DB query
    const limited = await checkOrderQueryRateLimit(request)
    if (limited) return limited

    const { orderId: orderNo } = await context.params
    const token = request.nextUrl.searchParams.get("token") ?? ""

    if (!token || !verifyOrderSuccessToken(orderNo, token)) {
        return NextResponse.json(
            { error: "invalid_token" },
            { status: 401, headers: NO_STORE },
        )
    }

    const order = await prisma.order.findUnique({
        where: { orderNo },
        select: { status: true },
    })

    if (!order) {
        return NextResponse.json(
            { error: "not_found" },
            { status: 404, headers: NO_STORE },
        )
    }

    // When order is still PENDING, proactively query Zpay — notify may not have arrived.
    if (order.status === "PENDING") {
        const zpayResult = await queryZpayOrder(orderNo).catch(() => ({ status: "error" as const }))
        if (zpayResult.status === "paid") {
            await completePendingOrder(orderNo).catch(() => null)
            console.info("[payment-status] orderNo=%s source=active_query result=completed", orderNo)
            return NextResponse.json({ status: "COMPLETED" }, { headers: NO_STORE })
        }
    }

    return NextResponse.json({ status: order.status }, { headers: NO_STORE })
}

export const runtime = "nodejs"
