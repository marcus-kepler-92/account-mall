import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "better-auth/crypto"
import { getAdminSession } from "@/lib/auth-guard"
import { createOrderSchema, orderListQuerySchema } from "@/lib/validations/order"
import { getAlipayPagePayUrl } from "@/lib/alipay"
import {
    checkOrderCreateRateLimit,
    getClientIp,
    MAX_PENDING_ORDERS_PER_IP,
} from "@/lib/rate-limit"

/**
 * Generate a unique order number using UUID v4.
 * Implemented via Node's built-in crypto.randomUUID.
 */
export function generateOrderNo(): string {
    return randomUUID()
}

/**
 * GET /api/orders
 * Admin only: list orders with pagination and filters.
 */
export async function GET(request: NextRequest) {
    const session = await getAdminSession()
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    const rawQuery = {
        page: searchParams.get("page") ?? undefined,
        pageSize: searchParams.get("pageSize") ?? undefined,
        status: searchParams.get("status") ?? undefined,
        email: searchParams.get("email") ?? undefined,
        orderNo: searchParams.get("orderNo") ?? undefined,
        productId: searchParams.get("productId") ?? undefined,
        dateFrom: searchParams.get("dateFrom") ?? undefined,
        dateTo: searchParams.get("dateTo") ?? undefined,
    }

    const parsed = orderListQuerySchema.safeParse(rawQuery)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: parsed.error.flatten() },
            { status: 400 }
        )
    }

    const { page, pageSize, status, email, orderNo, productId, dateFrom, dateTo } = parsed.data

    let fromDate: Date | undefined
    let toDate: Date | undefined

    if (dateFrom) {
        const parsedDate = new Date(dateFrom)
        if (Number.isNaN(parsedDate.getTime())) {
            return NextResponse.json(
                {
                    error: "Bad request",
                    message: "Invalid dateFrom format. Expected a valid date string (e.g. YYYY-MM-DD).",
                },
                { status: 400 }
            )
        }
        fromDate = parsedDate
    }

    if (dateTo) {
        const parsedDate = new Date(dateTo)
        if (Number.isNaN(parsedDate.getTime())) {
            return NextResponse.json(
                {
                    error: "Bad request",
                    message: "Invalid dateTo format. Expected a valid date string (e.g. YYYY-MM-DD).",
                },
                { status: 400 }
            )
        }
        toDate = parsedDate
    }

    if (fromDate && toDate && fromDate > toDate) {
        return NextResponse.json(
            {
                error: "Bad request",
                message: "dateFrom must be before or equal to dateTo",
            },
            { status: 400 }
        )
    }

    const where: Record<string, unknown> = {}

    if (status && status !== "ALL") {
        where.status = status
    }
    if (email) {
        where.email = email.trim().toLowerCase()
    }
    if (orderNo) {
        where.orderNo = {
            contains: orderNo.trim(),
        }
    }
    if (productId) {
        where.productId = productId
    }
    if (fromDate || toDate) {
        const createdAt: { gte?: Date; lte?: Date } = {}
        if (fromDate) {
            createdAt.gte = fromDate
        }
        if (toDate) {
            createdAt.lte = toDate
        }
        where.createdAt = createdAt
    }

    const [orders, total] = await Promise.all([
        prisma.order.findMany({
            where,
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        price: true,
                    },
                },
                cards: {
                    select: {
                        status: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.order.count({ where }),
    ])

    const data = orders.map((order) => {
        const cardsCount = order.cards.length
        const reservedCardsCount = order.cards.filter((c) => c.status === "RESERVED").length
        const soldCardsCount = order.cards.filter((c) => c.status === "SOLD").length

        return {
            id: order.id,
            orderNo: order.orderNo,
            email: order.email,
            product: {
                id: order.product.id,
                name: order.product.name,
                price: Number(order.product.price),
            },
            quantity: order.quantity,
            amount: Number(order.amount),
            status: order.status,
            paidAt: order.paidAt,
            createdAt: order.createdAt,
            cardsCount,
            reservedCardsCount,
            soldCardsCount,
        }
    })

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
 * POST /api/orders
 * Create order and reserve cards.
 */
export async function POST(request: NextRequest) {
    const rateLimitRes = await checkOrderCreateRateLimit(request)
    if (rateLimitRes) return rateLimitRes

    const clientIp = getClientIp(request)
    if (clientIp !== "unknown") {
        const pendingCount = await prisma.order.count({
            where: { status: "PENDING", clientIp },
        })
        if (pendingCount >= MAX_PENDING_ORDERS_PER_IP) {
            return NextResponse.json(
                {
                    error: `You have ${pendingCount} unpaid order(s). Please pay or wait for them to expire before creating more.`,
                },
                { status: 400 },
            )
        }
    }

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const parsed = createOrderSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: parsed.error.flatten() },
            { status: 400 }
        )
    }

    const { productId, email, orderPassword, quantity } = parsed.data

    const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, price: true, maxQuantity: true, status: true },
    })

    if (!product || product.status !== "ACTIVE") {
        return NextResponse.json({ error: "Product not found or unavailable" }, { status: 404 })
    }

    if (quantity < 1 || quantity > product.maxQuantity) {
        return NextResponse.json(
            { error: `Quantity must be between 1 and ${product.maxQuantity}` },
            { status: 400 }
        )
    }

    const unsoldCount = await prisma.card.count({
        where: { productId, status: "UNSOLD" },
    })

    if (unsoldCount < quantity) {
        return NextResponse.json(
            { error: `Insufficient stock. Available: ${unsoldCount}` },
            { status: 400 }
        )
    }

    const amount = Number(product.price) * quantity
    const passwordHash = await hashPassword(orderPassword)

    // Generate unique order number using UUID v4 (guaranteed uniqueness)
    // Retry only if there's an extremely rare collision (shouldn't happen in practice)
    const MAX_RETRIES = 3
    let order
    let retries = 0

    while (retries < MAX_RETRIES) {
        try {
            order = await prisma.$transaction(async (tx) => {
                const orderNo = generateOrderNo()

                const newOrder = await tx.order.create({
                    data: {
                        orderNo,
                        productId,
                        email: email.trim().toLowerCase(),
                        passwordHash,
                        quantity,
                        amount,
                        status: "PENDING",
                        ...(clientIp !== "unknown" && { clientIp }),
                    },
                })

                const cardsToReserve = await tx.card.findMany({
                    where: { productId, status: "UNSOLD" },
                    take: quantity,
                    orderBy: { createdAt: "asc" },
                    select: { id: true },
                })

                if (cardsToReserve.length < quantity) {
                    throw new Error("Insufficient stock during reservation")
                }

                await tx.card.updateMany({
                    where: { id: { in: cardsToReserve.map((c) => c.id) } },
                    data: { status: "RESERVED", orderId: newOrder.id },
                })

                return newOrder
            })
            break // Success, exit retry loop
        } catch (error: unknown) {
            // Check if it's a unique constraint violation on orderNo (extremely rare with UUID)
            if (
                error &&
                typeof error === "object" &&
                "code" in error &&
                error.code === "P2002" &&
                "meta" in error &&
                error.meta &&
                typeof error.meta === "object" &&
                "target" in error.meta &&
                Array.isArray(error.meta.target) &&
                error.meta.target.includes("orderNo")
            ) {
                retries++
                if (retries >= MAX_RETRIES) {
                    return NextResponse.json(
                        { error: "Failed to create order after retries. Please try again." },
                        { status: 500 }
                    )
                }
                // Wait a short random time before retry (shouldn't be needed with UUID)
                await new Promise((resolve) => setTimeout(resolve, Math.random() * 50))
                continue
            }
            // Re-throw other errors
            throw error
        }
    }

    if (!order) {
        return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
    }

    const amountStr = Number(order.amount).toFixed(2)
    const subject = product.name ?? `订单 ${order.orderNo}`
    const paymentUrl = getAlipayPagePayUrl({
        orderNo: order.orderNo,
        totalAmount: amountStr,
        subject,
    })

    return NextResponse.json({
        orderNo: order.orderNo,
        amount: Number(order.amount),
        paymentUrl: paymentUrl ?? null,
    })
}

export const runtime = "nodejs"
