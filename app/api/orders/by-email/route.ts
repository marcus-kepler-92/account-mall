import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { orderByEmailPostSchema } from "@/lib/validations/order"
import { verifyPassword } from "better-auth/crypto"
import { checkOrderQueryRateLimit } from "@/lib/rate-limit"

const MAX_ORDERS_TO_CHECK = 100

/**
 * POST /api/orders/by-email
 * Public: list orders by email + order password (required for security).
 * Body: { email, password, page?, pageSize? }
 */
export async function POST(request: NextRequest) {
    const rateLimitRes = await checkOrderQueryRateLimit(request)
    if (rateLimitRes) return rateLimitRes

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const parsed = orderByEmailPostSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: "Validation failed" }, { status: 400 })
    }

    const { email, password, page, pageSize } = parsed.data

    const orders = await prisma.order.findMany({
        where: { email: email.trim().toLowerCase() },
        select: {
            orderNo: true,
            createdAt: true,
            status: true,
            quantity: true,
            amount: true,
            passwordHash: true,
            product: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: MAX_ORDERS_TO_CHECK,
    })

    const matching: typeof orders = []
    for (const order of orders) {
        if (!order.passwordHash || typeof order.passwordHash !== "string") continue
        try {
            const ok = await verifyPassword({
                hash: order.passwordHash,
                password: password.trim(),
            })
            if (ok) matching.push(order)
        } catch {
            // skip
        }
    }

    if (matching.length === 0) {
        return NextResponse.json(
            { error: "Order not found or password incorrect" },
            { status: 400 },
        )
    }

    const total = matching.length
    const start = (page - 1) * pageSize
    const pageOrders = matching.slice(start, start + pageSize)

    const data = pageOrders.map((order) => ({
        orderNo: order.orderNo,
        createdAt: order.createdAt,
        status: order.status,
        productName: order.product.name,
        quantity: order.quantity,
        amount: Number(order.amount),
    }))

    return NextResponse.json({
        data,
        meta: {
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize) || 1,
        },
    })
}

/**
 * GET /api/orders/by-email
 * Deprecated: requires password for security. Use POST with body { email, password, page?, pageSize? }.
 */
export async function GET(_request: NextRequest) {
    return NextResponse.json(
        {
            error: "Use POST with email and order password. GET is disabled for security.",
        },
        { status: 400 },
    )
}

export const runtime = "nodejs"
