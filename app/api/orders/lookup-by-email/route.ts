import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { publicOrderLookupByEmailSchema } from "@/lib/validations/order"
import { verifyPassword } from "better-auth/crypto"
import { checkOrderQueryRateLimit } from "@/lib/rate-limit"
import { invalidJsonBody, validationError, badRequest, internalServerError } from "@/lib/api-response"
import { parseFreeSharedCardContent } from "@/lib/free-shared-card"

/**
 * POST /api/orders/lookup-by-email
 * Public: users can query order details and cards by email + password.
 * Returns a list of matching orders if multiple exist, or a single order with cards if only one matches.
 */
export async function POST(request: NextRequest) {
    const rateLimitRes = await checkOrderQueryRateLimit(request)
    if (rateLimitRes) return rateLimitRes

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = publicOrderLookupByEmailSchema.safeParse(body)
    if (!parsed.success) {
        // Public endpoint: avoid exposing detailed validation errors.
        return validationError(undefined)
    }

    const { email, password } = parsed.data

    // Validate password before transaction
    if (!password || typeof password !== "string" || password.length < 6) {
        return validationError(undefined)
    }

    try {
        const MAX_ORDERS_TO_CHECK = 20

        const allOrders = await prisma.order.findMany({
            where: {
                email: email.trim().toLowerCase(),
            },
            select: {
                id: true,
                orderNo: true,
                email: true,
                passwordHash: true,
                status: true,
                createdAt: true,
                quantity: true,
                amount: true,
                product: {
                    select: {
                        name: true,
                    },
                },
                cards: {
                    select: {
                        id: true,
                        content: true,
                        status: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
            take: MAX_ORDERS_TO_CHECK,
        })

        if (allOrders.length === 0) {
            return badRequest("Order not found or password incorrect")
        }

        const matchingOrders = []
        for (const order of allOrders) {
            if (!order.passwordHash || typeof order.passwordHash !== "string") {
                continue
            }
            try {
                const passwordOk = await verifyPassword({
                    hash: order.passwordHash,
                    password: password.trim(),
                })
                if (passwordOk) {
                    matchingOrders.push(order)
                }
            } catch {
                // skip orders with corrupt hash
            }
        }

        if (matchingOrders.length === 0) {
            return badRequest("Order not found or password incorrect")
        }

        const result = matchingOrders.length === 1
            ? { type: "single" as const, data: matchingOrders[0] }
            : { type: "multiple" as const, data: matchingOrders }

        // Format response based on result type
        if (result.type === "single") {
            const order = result.data
            if (!order.product) {
                throw new Error("LOOKUP_FAILED")
            }

            // For PENDING orders, return order info without cards
            if (order.status === "PENDING") {
                return NextResponse.json({
                    orderNo: order.orderNo,
                    productName: order.product.name,
                    createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
                    status: order.status,
                    cards: [],
                    isPending: true,
                })
            }

            // For COMPLETED/CLOSED orders, return cards（免费共享卡密解析为 account/password/region 等，避免前端显示 JSON 字符串）
            const cards = order.cards
                .filter((card) => card.status === "SOLD" || card.status === "RESERVED")
                .map((card) => {
                    const payload = parseFreeSharedCardContent(card.content)
                    if (payload) {
                        return { content: card.content, ...payload }
                    }
                    return { content: card.content }
                })

            return NextResponse.json({
                orderNo: order.orderNo,
                productName: order.product.name,
                createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
                status: order.status,
                cards,
            })
        } else {
            // Multiple orders - return list
            const orders = result.data.map((order) => ({
                orderNo: order.orderNo,
                productName: order.product?.name || "",
                createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
                status: order.status,
                quantity: order.quantity,
                amount: Number(order.amount),
            }))

            return NextResponse.json({
                orders,
            })
        }
    } catch {
        return internalServerError()
    }
}

export const runtime = "nodejs"
