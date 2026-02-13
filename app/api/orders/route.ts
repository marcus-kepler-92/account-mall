import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "better-auth/crypto"
import { getAdminSession } from "@/lib/auth-guard"
import { createOrderSchema, orderListQuerySchema } from "@/lib/validations/order"

function generateOrderNo(): string {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "")
    return `FAK${today}`
}

export function getNextOrderNo(prefix: string, lastOrderNo?: string | null): string {
    let seq = 1

    if (lastOrderNo) {
        const suffix = lastOrderNo.slice(prefix.length)
        const parsed = parseInt(suffix, 10)

        if (!Number.isNaN(parsed)) {
            seq = parsed + 1
        }
    }

    return `${prefix}${String(seq).padStart(5, "0")}`
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

    const order = await prisma.$transaction(async (tx) => {
        const prefix = generateOrderNo()

        const lastOrder = await tx.order.findFirst({
            where: { orderNo: { startsWith: prefix } },
            orderBy: { orderNo: "desc" },
            select: { orderNo: true },
        })

        const orderNo = getNextOrderNo(prefix, lastOrder?.orderNo ?? null)

        const newOrder = await tx.order.create({
            data: {
                orderNo,
                productId,
                email: email.trim().toLowerCase(),
                passwordHash,
                quantity,
                amount,
                status: "PENDING",
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

    return NextResponse.json({
        orderNo: order.orderNo,
        amount: Number(order.amount),
        paymentUrl: null,
    })
}

export const runtime = "nodejs"
