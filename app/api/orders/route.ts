import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "better-auth/crypto"
import { getAdminSession } from "@/lib/auth-guard"
import { createOrderSchema, orderListQuerySchema } from "@/lib/validations/order"
import { getAlipayPagePayUrl } from "@/lib/alipay"
import { isYipayConfigured, getYipayPagePayUrl } from "@/lib/yipay"
import {
    checkOrderCreateRateLimit,
    getClientIp,
    MAX_PENDING_ORDERS_PER_IP,
} from "@/lib/rate-limit"
import { config } from "@/lib/config"
import { verifyTurnstileToken } from "@/lib/turnstile"
import { scrapeSharedAccounts } from "@/lib/scrape-shared-accounts"
import { sharedAccountToCardPayload, toCardContentJson } from "@/lib/free-shared-card"
import { unauthorized, validationError, badRequest, invalidJsonBody, notFound, internalServerError } from "@/lib/api-response"

/**
 * Generate a unique order number using UUID v4.
 * Implemented via Node's built-in crypto.randomUUID.
 */
export function generateOrderNo(): string {
    return randomUUID()
}

type ProductForFreeShared = {
    id: string
    sourceUrl: string | null
    productType: string | null
}

/**
 * 免费共享领取：校验、限流、爬取、建单+卡密，返回 JSON 或错误 Response。
 */
async function createFreeSharedOrder(params: {
    productId: string
    product: ProductForFreeShared
    email: string
    orderPassword: string
    clientIp: string
}): Promise<NextResponse> {
    const { productId, product, email, orderPassword, clientIp } = params
    const sourceUrl = (product.sourceUrl?.trim() || config.freeSharedSourceUrl?.trim()) ?? ""
    if (!sourceUrl) {
        return badRequest("未配置免费共享爬取来源（环境变量 FREE_SHARED_SOURCE_URL），无法领取。")
    }
    if (config.nodeEnv !== "development") {
        const cooldownMs = config.freeSharedCooldownHours * 60 * 60 * 1000
        const since = new Date(Date.now() - cooldownMs)
        const emailLower = email.trim().toLowerCase()
        const recentCount = await prisma.order.count({
            where: {
                productId,
                status: "COMPLETED",
                amount: { equals: 0 },
                createdAt: { gte: since },
                ...(clientIp !== "unknown"
                    ? { OR: [{ clientIp }, { email: emailLower }] }
                    : { email: emailLower }),
            },
        })
        if (recentCount >= 1) {
            return NextResponse.json(
                {
                    error: `免费领取限流：同一商品 ${config.freeSharedCooldownHours} 小时内仅可领取 1 次，请稍后再试。`,
                },
                { status: 429 }
            )
        }
    }

    const scrapedList = await scrapeSharedAccounts(sourceUrl)
    if (config.nodeEnv === "development") {
        console.log("[免费共享] 爬取到的全部账号数据:", JSON.stringify(scrapedList, null, 2))
    }
    if (scrapedList.length === 0) {
        return badRequest("暂无可领取账号，请稍后再试。")
    }

    const picked = scrapedList[Math.floor(Math.random() * scrapedList.length)]
    const payload = sharedAccountToCardPayload(picked)
    const cardContent = toCardContentJson(payload)
    const passwordHash = await hashPassword(orderPassword)

    let freeOrder: { orderNo: string }
    try {
        freeOrder = await prisma.$transaction(async (tx) => {
            const orderNo = generateOrderNo()
            const newOrder = await tx.order.create({
                data: {
                    orderNo,
                    productId,
                    email: email.trim().toLowerCase(),
                    passwordHash,
                    quantity: 1,
                    amount: 0,
                    status: "COMPLETED",
                    paidAt: new Date(),
                    ...(clientIp !== "unknown" && { clientIp }),
                },
            })
            await tx.card.create({
                data: {
                    productId,
                    content: cardContent,
                    status: "SOLD",
                    orderId: newOrder.id,
                },
            })
            return { orderNo: newOrder.orderNo }
        })
    } catch (err) {
        console.error("[免费共享] 创建订单失败:", err)
        return internalServerError("领取失败，请稍后重试。")
    }

    return NextResponse.json({
        orderNo: freeOrder.orderNo,
        amount: 0,
        paymentUrl: null,
        claimedAccount: payload,
    })
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
    const turnstileEnabled = secretKey && config.nodeEnv !== "development"
    if (turnstileEnabled) {
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
    if (config.nodeEnv !== "development" && clientIp !== "unknown") {
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
        select: {
            id: true,
            name: true,
            price: true,
            maxQuantity: true,
            status: true,
            // @ts-expect-error - productType/sourceUrl in schema; run npx prisma generate if types are stale
            productType: true,
            sourceUrl: true,
        },
    })

    if (!product || product.status !== "ACTIVE") {
        return notFound("Product not found or unavailable")
    }

    const productWithType = product as unknown as ProductForFreeShared
    const isFreeShared = productWithType.productType === "FREE_SHARED"
    const maxQty = isFreeShared ? config.freeSharedMaxQuantityPerOrder : product.maxQuantity
    if (quantity < 1 || quantity > maxQty) {
        return badRequest(`Quantity must be between 1 and ${maxQty}`)
    }

    // ─── 免费共享：实时爬取，随机取一个账号，单次领取；按 IP 限流防刷 ─────────────
    if (isFreeShared) {
        return createFreeSharedOrder({
            productId,
            product: productWithType,
            email,
            orderPassword,
            clientIp,
        })
    }

    // ─── 普通商品：校验库存与金额 ─────────────────────────────────────────────
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
    let paymentUrl = isYipayConfigured()
        ? getYipayPagePayUrl({ orderNo: order.orderNo, totalAmount: amountStr, subject })
        : getAlipayPagePayUrl({ orderNo: order.orderNo, totalAmount: amountStr, subject })

    // When no real payment is configured, use mock payment page in development so "click buy" still goes to a payment step
    if (!paymentUrl && config.nodeEnv === "development") {
        const base = config.siteUrl ?? "http://localhost:3000"
        paymentUrl = `${base}/orders/mock-pay?orderNo=${encodeURIComponent(order.orderNo)}&amount=${encodeURIComponent(amountStr)}`
    }

    return NextResponse.json({
        orderNo: order.orderNo,
        amount: Number(order.amount),
        paymentUrl: paymentUrl ?? null,
    })
}

export const runtime = "nodejs"
