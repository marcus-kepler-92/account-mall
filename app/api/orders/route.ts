import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "better-auth/crypto"
import { getAdminSession } from "@/lib/auth-guard"
import { createOrderSchema, orderListQuerySchema } from "@/lib/validations/order"
import { formatDateTimeShort } from "@/lib/utils"
import { getPaymentUrlForOrder } from "@/lib/get-payment-url"
import {
    checkOrderCreateRateLimit,
    getClientIp,
    MAX_PENDING_ORDERS_PER_IP,
} from "@/lib/rate-limit"
import { config } from "@/lib/config"
import { verifyTurnstileToken } from "@/lib/turnstile"
import { verifyExitDiscountToken } from "@/lib/exit-discount"
import { scrapeSharedAccounts } from "@/lib/scrape-shared-accounts"
import { sharedAccountToCardPayload, toCardContentJson } from "@/lib/auto-fetch-card"
import { createOrderSuccessToken } from "@/lib/order-success-token"
import { completePendingOrder } from "@/lib/complete-pending-order"
import { unauthorized, validationError, badRequest, invalidJsonBody, notFound, internalServerError } from "@/lib/api-response"

/**
 * Generate a unique order number using UUID v4.
 * Implemented via Node's built-in crypto.randomUUID.
 */
export function generateOrderNo(): string {
    return randomUUID()
}

const DEFAULT_VALIDITY_HOURS = 24

type ProductForAutoFetch = {
    id: string
    name: string
    price: unknown
    sourceUrl: string | null
    productType: string | null
    validityHours: number | null
}

/**
 * AUTO_FETCH 下单：支持免费（price=0）和收费（price>0）。
 * - 免费：直接创建 COMPLETED 订单 + SOLD 卡，返回 successToken
 * - 收费：创建 PENDING 订单 + RESERVED 卡，返回 paymentUrl
 */
async function createAutoFetchOrder(params: {
    productId: string
    product: ProductForAutoFetch
    email: string
    orderPassword: string
    clientIp: string
    price: number
    distributorId: string | null
    distributorDiscountPercent: number | null
    promoCode: string | null
    fingerprintHash: string | null
    paymentMethod: string
}): Promise<NextResponse> {
    const { productId, product, email, orderPassword, clientIp, distributorId, distributorDiscountPercent, promoCode, fingerprintHash, paymentMethod } = params
    const sourceUrl = (product.sourceUrl?.trim() || config.autoFetchSourceUrl?.trim()) ?? ""
    if (!sourceUrl) {
        return badRequest("该商品暂时无法领取，请联系客服。")
    }

    const isFreeAutoFetch = params.price === 0

    // 多因素活跃订单检查：邮箱 / 指纹 / IP（辅助信号）三因素，任一命中则拒绝
    if (config.nodeEnv !== "development") {
        const emailLower = email.trim().toLowerCase()
        const cooldownStart = new Date(Date.now() - config.autoFetchCooldownHours * 60 * 60 * 1000)

        // 时间窗口条件（两种情形兼容）
        const timeWindowCondition = {
            OR: [
                // expiresAt 未设置（旧数据）按冷却小时数兜底
                { expiresAt: null, createdAt: { gte: cooldownStart } },
                // expiresAt 已设置：未过期的即为活跃
                { expiresAt: { gt: new Date() } },
            ],
        }

        // 身份条件：邮箱 OR 指纹（独立信号），IP 需与另一信号配合（避免 NAT 误杀）
        const identitySignals: object[] = [{ email: emailLower }]
        if (fingerprintHash) identitySignals.push({ fingerprintHash })
        const ipAuxiliary =
            clientIp !== "unknown"
                ? { clientIp, OR: [{ email: emailLower }, ...(fingerprintHash ? [{ fingerprintHash }] : [])] }
                : null
        const ownerCondition = { OR: [...identitySignals, ...(ipAuxiliary ? [ipAuxiliary] : [])] }

        const activeOrder = await prisma.order.findFirst({
            where: {
                productId,
                status: "COMPLETED",
                ...(isFreeAutoFetch ? { amount: { equals: 0 } } : {}),
                AND: [timeWindowCondition, ownerCondition],
            },
            select: { id: true, expiresAt: true },
        })
        if (activeOrder) {
            const expiresAt = activeOrder.expiresAt
            const expiresInfo = expiresAt
                ? `，可使用至 ${formatDateTimeShort(expiresAt)}`
                : ""
            const message = isFreeAutoFetch
                ? `您今日已领取过该商品${expiresInfo}，请在可用时间内使用。`
                : `您已有该商品的活跃订单${expiresInfo}，到期后再下单。`
            return NextResponse.json({ error: message }, { status: 429 })
        }
    }

    if (config.nodeEnv === "development") {
        console.log("[AUTO_FETCH] 即将爬取 sourceUrl:", sourceUrl)
    }
    const scrapedList = await scrapeSharedAccounts(sourceUrl)
    if (config.nodeEnv === "development") {
        console.log("[AUTO_FETCH] 爬取结果数量:", scrapedList.length)
        if (scrapedList.length > 0) {
            console.log("[AUTO_FETCH] 第一条账号:", JSON.stringify(scrapedList[0]))
        }
    }
    if (scrapedList.length === 0) {
        return badRequest("暂无可领取账号，请稍后再试。")
    }

    const picked = scrapedList[Math.floor(Math.random() * scrapedList.length)]
    const cardPayload = sharedAccountToCardPayload(picked)
    const cardContent = toCardContentJson(cardPayload)
    const passwordHash = await hashPassword(orderPassword)

    // 计算实际金额（支持分销商折扣）
    let amount = params.price
    if (distributorDiscountPercent != null) {
        amount = amount * (1 - distributorDiscountPercent / 100)
    }
    amount = Math.round(amount * 100) / 100

    // 计算有效期截止时间
    const validityHours = product.validityHours ?? DEFAULT_VALIDITY_HOURS
    const validityMs = validityHours * 60 * 60 * 1000

    if (isFreeAutoFetch) {
        // 免费流程：直接 COMPLETED + SOLD，立即计算 expiresAt
        const now = new Date()
        const expiresAt = new Date(now.getTime() + validityMs)

        let freeOrder: { orderNo: string }
        try {
            freeOrder = await prisma.$transaction(async (tx) => {
                const orderNo = generateOrderNo()
                const newOrder = await tx.order.create({
                    data: {
                        orderNo,
                        productId,
                        productNameSnapshot: product.name,
                        email: email.trim().toLowerCase(),
                        passwordHash,
                        quantity: 1,
                        amount: 0,
                        status: "COMPLETED",
                        paidAt: now,
                        expiresAt,
                        ...(clientIp !== "unknown" && { clientIp }),
                        ...(distributorId && { distributorId }),
                        ...(promoCode && { promoCode }),
                        ...(fingerprintHash && { fingerprintHash }),
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
            console.error("[AUTO_FETCH] 创建免费订单失败:", err)
            return internalServerError("领取失败，请稍后重试。")
        }

        const successToken = createOrderSuccessToken(freeOrder.orderNo)
        return NextResponse.json({
            orderNo: freeOrder.orderNo,
            amount: 0,
            paymentUrl: null,
            claimedAccount: cardPayload,
            expiresAt: expiresAt.toISOString(),
            ...(successToken && { successToken }),
        })
    } else {
        // 收费流程：PENDING + RESERVED，等待支付
        let paidOrder: { orderNo: string; orderId: string }
        try {
            paidOrder = await prisma.$transaction(async (tx) => {
                const orderNo = generateOrderNo()
                const newOrder = await tx.order.create({
                    data: {
                        orderNo,
                        productId,
                        productNameSnapshot: product.name,
                        email: email.trim().toLowerCase(),
                        passwordHash,
                        quantity: 1,
                        amount,
                        status: "PENDING",
                        paymentMethod,
                        ...(clientIp !== "unknown" && { clientIp }),
                        ...(distributorId && { distributorId }),
                        ...(promoCode && { promoCode }),
                        ...(fingerprintHash && { fingerprintHash }),
                        ...(distributorDiscountPercent != null && { discountPercent: distributorDiscountPercent }),
                    },
                })
                await tx.card.create({
                    data: {
                        productId,
                        content: cardContent,
                        status: "RESERVED",
                        orderId: newOrder.id,
                    },
                })
                return { orderNo: newOrder.orderNo, orderId: newOrder.id }
            })
        } catch (err) {
            console.error("[AUTO_FETCH] 创建收费订单失败:", err)
            return internalServerError("下单失败，请稍后重试。")
        }

        // Development 快捷通道
        if (config.nodeEnv === "development") {
            const devResult = await completePendingOrder(paidOrder.orderNo)
            if (devResult.done) {
                const successToken = createOrderSuccessToken(paidOrder.orderNo)
                return NextResponse.json({
                    orderNo: paidOrder.orderNo,
                    amount,
                    paymentUrl: null,
                    ...(successToken && { successToken }),
                })
            }
        }

        // 获取支付链接
        const paymentUrl = getPaymentUrlForOrder({
            orderNo: paidOrder.orderNo,
            totalAmount: String(amount),
            subject: product.name,
            paymentMethod,
        })

        return NextResponse.json({
            orderNo: paidOrder.orderNo,
            amount,
            paymentUrl,
        })
    }
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
                distributor: {
                    select: { id: true, name: true, distributorCode: true },
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
            distributorId: order.distributorId,
            distributor: order.distributor ? { id: order.distributor.id, name: order.distributor.name, distributorCode: order.distributor.distributorCode } : null,
            product: {
                id: order.product.id,
                name: order.productNameSnapshot ?? order.product.name,
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

    const { productId, email, orderPassword, quantity, paymentMethod, turnstileToken, promoCode: bodyPromoCode, exitDiscountToken, fingerprintHash: rawFingerprintHash } = parsed.data
    const fingerprintHash = rawFingerprintHash?.trim() || null

    // Resolve distributor from promoCode (cookie or body); include discount settings for 同码优惠
    const cookiePromoCode = request.cookies?.get?.("distributor_promo_code")?.value?.trim()
    const promoCode = (bodyPromoCode?.trim() || cookiePromoCode) || null
    let distributorId: string | null = null
    let distributorDiscountPercent: number | null = null
    if (promoCode) {
        const distributor = await prisma.user.findFirst({
            where: { distributorCode: promoCode, role: "DISTRIBUTOR", disabledAt: null },
            select: { id: true, discountCodeEnabled: true, discountPercent: true },
        })
        if (distributor) {
            distributorId = distributor.id
            // 同码优惠：仅当启用优惠码且设置了折扣比例时应用
            if (distributor.discountCodeEnabled && distributor.discountPercent != null) {
                const pct = Number(distributor.discountPercent)
                if (pct > 0 && pct <= 100) distributorDiscountPercent = pct
            }
        }
    }

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
    })

    if (!product || product.status !== "ACTIVE") {
        return notFound("Product not found or unavailable")
    }

    const productWithType = product as unknown as ProductForAutoFetch
    const isAutoFetch = productWithType.productType === "AUTO_FETCH"
    const maxQty = isAutoFetch ? config.autoFetchMaxQuantityPerOrder : product.maxQuantity
    if (quantity < 1 || quantity > maxQty) {
        return badRequest(`Quantity must be between 1 and ${maxQty}`)
    }

    // ─── AUTO_FETCH：实时爬取，随机取一个账号，单次领取 ─────────────────────────
    if (isAutoFetch) {
        const autoFetchPrice = Number(product.price)
        return createAutoFetchOrder({
            productId,
            product: productWithType,
            email,
            orderPassword,
            clientIp,
            price: autoFetchPrice,
            distributorId,
            distributorDiscountPercent,
            promoCode,
            fingerprintHash,
            paymentMethod,
        })
    }

    // ─── 普通商品：校验库存与金额 ─────────────────────────────────────────────
    const unsoldCount = await prisma.card.count({
        where: { productId, status: "UNSOLD" },
    })

    if (unsoldCount < quantity) {
        return badRequest(`Insufficient stock. Available: ${unsoldCount}`)
    }

    // Exit intent 折扣：仅当无 promoCode 且配置了 secret 时生效
    let exitDiscountPercent: number | null = null
    let exitDiscountMeta: string | null = null
    if (!promoCode && exitDiscountToken && config.exitDiscountSecret) {
        const verifyResult = verifyExitDiscountToken(exitDiscountToken, config.exitDiscountSecret)
        if (verifyResult.valid && verifyResult.payload.productId === productId) {
            exitDiscountPercent = verifyResult.payload.discountPercent
            exitDiscountMeta = JSON.stringify({
                productId: verifyResult.payload.productId,
                visitorId: verifyResult.payload.visitorId,
                fingerprintHash: verifyResult.payload.fingerprintHash,
                ip: verifyResult.payload.ip,
                discountPercent: verifyResult.payload.discountPercent,
            })
        }
    }

    let amount = Number(product.price) * quantity
    let discountPercentApplied: number | null = null
    if (distributorDiscountPercent != null) {
        amount = amount * (1 - distributorDiscountPercent / 100)
        discountPercentApplied = distributorDiscountPercent
    } else if (exitDiscountPercent != null) {
        amount = amount * (1 - exitDiscountPercent / 100)
        discountPercentApplied = exitDiscountPercent
    }
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
                        productNameSnapshot: product.name,
                        ...(distributorId && { distributorId }),
                        email: email.trim().toLowerCase(),
                        passwordHash,
                        quantity,
                        amount: amountRounded,
                        ...(discountPercentApplied != null && { discountPercentApplied }),
                        status: "PENDING",
                        paymentMethod,
                        ...(clientIp !== "unknown" && { clientIp }),
                        ...(fingerprintHash && { fingerprintHash }),
                        ...(exitDiscountMeta && { exitDiscountMeta }),
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

    // Development: complete order immediately and return successToken so frontend redirects to success page
    if (config.nodeEnv === "development") {
        const result = await completePendingOrder(order.orderNo)
        if (!result.done) {
            return internalServerError(result.error ?? "Failed to complete order")
        }
        const successToken = createOrderSuccessToken(result.orderNo)
        return NextResponse.json({
            orderNo: order.orderNo,
            amount: Number(order.amount),
            paymentUrl: null,
            ...(successToken && { successToken }),
        })
    }

    const amountStr = Number(order.amount).toFixed(2)
    const subject = product.name ?? `订单 ${order.orderNo}`
    const paymentUrl = getPaymentUrlForOrder({
        orderNo: order.orderNo,
        totalAmount: amountStr,
        subject,
        paymentMethod,
    })

    // Non-development: return payment URL (or null if no payment configured)
    return NextResponse.json({
        orderNo: order.orderNo,
        amount: Number(order.amount),
        paymentUrl: paymentUrl ?? null,
    })
}

export const runtime = "nodejs"
