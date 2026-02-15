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
import { config } from "@/lib/config"
import { verifyTurnstileToken } from "@/lib/turnstile"
import { unauthorized, validationError, badRequest, invalidJsonBody, notFound, internalServerError } from "@/lib/api-response"

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
        return unauthorized()
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
        return validationError(parsed.error.flatten())
    }

    const { page, pageSize, status, email, orderNo, productId, dateFrom, dateTo } = parsed.data

    let fromDate: Date | undefined
    let toDate: Date | undefined

    if (dateFrom) {
        const parsedDate = new Date(dateFrom)
        if (Number.isNaN(parsedDate.getTime())) {
            return badRequest(
                "Invalid dateFrom format. Expected a valid date string (e.g. YYYY-MM-DD).",
            )
        }
        fromDate = parsedDate
    }

    if (dateTo) {
        const parsedDate = new Date(dateTo)
        if (Number.isNaN(parsedDate.getTime())) {
            return badRequest(
                "Invalid dateTo format. Expected a valid date string (e.g. YYYY-MM-DD).",
            )
        }
        toDate = parsedDate
    }

    if (fromDate && toDate && fromDate > toDate) {
        return badRequest("dateFrom must be before or equal to dateTo")
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
        return invalidJsonBody()
    }

    const parsed = createOrderSchema.safeParse(body)
    if (!parsed.success) {
        return validationError(parsed.error.flatten())
    }

    const { productId, email, orderPassword, quantity, turnstileToken } = parsed.data

    const secretKey = config.turnstileSecretKey
    if (secretKey) {
        if (!turnstileToken || !turnstileToken.trim()) {
            return badRequest("请完成安全验证后再提交订单。")
        }
        const clientIp = getClientIp(request)
        const verifyResult = await verifyTurnstileToken(
            turnstileToken.trim(),
            secretKey,
            clientIp !== "unknown" ? clientIp : undefined
        )
        if (!verifyResult.success) {
            const codes = verifyResult["error-codes"] ?? []
            const message =
                codes.includes("timeout-or-duplicate") || codes.includes("expired")
                    ? "验证已过期，请刷新页面后重试。"
                    : "安全验证未通过，请重试。"
            return badRequest(message)
        }
    }

    const rateLimitRes = await checkOrderCreateRateLimit(request)
    if (rateLimitRes) return rateLimitRes

    const clientIp = getClientIp(request)
    if (clientIp !== "unknown") {
        const pendingCount = await prisma.order.count({
            where: { status: "PENDING", clientIp },
        })
        if (pendingCount >= MAX_PENDING_ORDERS_PER_IP) {
            return badRequest(
                `You have ${pendingCount} unpaid order(s). Please pay or wait for them to expire before creating more.`,
            )
        }
    }

    const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, price: true, maxQuantity: true, status: true },
    })

    if (!product || product.status !== "ACTIVE") {
        return notFound("Product not found or unavailable")
    }

    if (quantity < 1 || quantity > product.maxQuantity) {
        return badRequest(`Quantity must be between 1 and ${product.maxQuantity}`)
    }

    const unsoldCount = await prisma.card.count({
        where: { productId, status: "UNSOLD" },
    })

    if (unsoldCount < quantity) {
        return badRequest(`Insufficient stock. Available: ${unsoldCount}`)
    }

    const amount = Number(product.price) * quantity
    const amountRounded = Math.round(amount * 100) / 100
    if (amountRounded <= 0 || amountRounded > 999_999.99) {
        return badRequest("Invalid order amount")
    }
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
                        amount: amountRounded,
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
                    return internalServerError("Failed to create order after retries. Please try again.")
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
        return internalServerError("Failed to create order")
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
