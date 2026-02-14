import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { publicOrderLookupSchema } from "@/lib/validations/order"
import { verifyPassword } from "better-auth/crypto"

/**
 * POST /api/orders/lookup
 * Public: users can query order details and cards by orderNo + password.
 *
 * TODO: Add IP/orderNo level rate limiting and basic WAF to prevent brute-force attacks.
 * TODO: Add structured logging for lookup attempts without logging raw passwords or card content.
 */
export async function POST(request: NextRequest) {
    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const parsed = publicOrderLookupSchema.safeParse(body)
    if (!parsed.success) {
        // Public endpoint: avoid exposing detailed validation errors.
        return NextResponse.json({ error: "Validation failed" }, { status: 400 })
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

        // For COMPLETED/CLOSED orders, return cards
        const cards = order.cards
            // Only return cards that belong to this order and are in SOLD or RESERVED status.
            // TODO: Consider encrypting card content at rest and decrypting only when needed.
            .filter((card) => card.status === "SOLD" || card.status === "RESERVED")
            .map((card) => ({
                content: card.content,
            }))

        return NextResponse.json({
            orderNo: order.orderNo,
            productName: order.product.name,
            createdAt: order.createdAt,
            status: order.status,
            cards,
        })
    } catch (error) {
        if (error instanceof Error && error.message === "LOOKUP_FAILED") {
            return NextResponse.json(
                {
                    error: "Order not found or password incorrect",
                },
                { status: 400 }
            )
        }

        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

export const runtime = "nodejs"

