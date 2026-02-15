import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { publicOrderLookupSchema } from "@/lib/validations/order"
import { verifyPassword } from "better-auth/crypto"
import { createOrderSuccessToken } from "@/lib/order-success-token"
import { checkOrderQueryRateLimit } from "@/lib/rate-limit"
import { invalidJsonBody, validationError, badRequest, internalServerError } from "@/lib/api-response"

/**
 * POST /api/orders/lookup
 * Public: users can query order details and cards by orderNo + password.
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

    const parsed = publicOrderLookupSchema.safeParse(body)
    if (!parsed.success) {
        // Public endpoint: avoid exposing detailed validation errors.
        return validationError()
    }

    const { orderNo, password } = parsed.data

    try {
        const order = await prisma.$transaction(async (tx) => {
            const existing = await tx.order.findUnique({
                where: { orderNo: orderNo.trim() },
                include: {
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
            })

            if (!existing) {
                throw new Error("LOOKUP_FAILED")
            }

            // verifyPassword signature: verifyPassword({ hash, password })
            const passwordOk = await verifyPassword({ hash: existing.passwordHash, password: password.trim() })
            if (!passwordOk) {
                throw new Error("LOOKUP_FAILED")
            }

            return existing
        })

        // For PENDING orders, return order info without cards
        if (order.status === "PENDING") {
            return NextResponse.json({
                orderNo: order.orderNo,
                productName: order.product.name,
                createdAt: order.createdAt,
                status: order.status,
                cards: [],
                isPending: true,
            })
        }

        // For COMPLETED/CLOSED orders, return cards and optional successToken for redirect to success page
        const cards = order.cards
            .filter((card) => card.status === "SOLD" || card.status === "RESERVED")
            .map((card) => ({ content: card.content }))

        const successToken = createOrderSuccessToken(order.orderNo)

        return NextResponse.json({
            orderNo: order.orderNo,
            productName: order.product.name,
            createdAt: order.createdAt,
            status: order.status,
            cards,
            ...(successToken && { successToken }),
        })
    } catch (error) {
        if (error instanceof Error && error.message === "LOOKUP_FAILED") {
            return badRequest("Order not found or password incorrect")
        }

        return internalServerError()
    }
}

export const runtime = "nodejs"

