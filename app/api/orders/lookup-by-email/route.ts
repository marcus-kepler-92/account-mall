import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { publicOrderLookupByEmailSchema } from "@/lib/validations/order"
import { verifyPassword } from "better-auth/crypto"

/**
 * POST /api/orders/lookup-by-email
 * Public: users can query order details and cards by email + password.
 * Returns the most recent order matching the email and password.
 *
 * TODO: Add IP/email level rate limiting and basic WAF to prevent brute-force attacks.
 * TODO: Add structured logging for lookup attempts without logging raw passwords or card content.
 */
export async function POST(request: NextRequest) {
    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const parsed = publicOrderLookupByEmailSchema.safeParse(body)
    if (!parsed.success) {
        // Public endpoint: avoid exposing detailed validation errors.
        return NextResponse.json({ error: "Validation failed" }, { status: 400 })
    }

    const { email, password } = parsed.data

    // Validate password before transaction
    if (!password || typeof password !== "string" || password.length < 6) {
        return NextResponse.json({ error: "Validation failed" }, { status: 400 })
    }

    try {
        const order = await prisma.$transaction(async (tx) => {
            // Find the most recent order matching the email
            const existing = await tx.order.findFirst({
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
            })

            if (!existing) {
                throw new Error("LOOKUP_FAILED")
            }

            // Debug logging in development
            if (process.env.NODE_ENV === "development") {
                console.log("[lookup-by-email] Found order:", {
                    id: existing.id,
                    orderNo: existing.orderNo,
                    email: existing.email,
                    hasPasswordHash: !!existing.passwordHash,
                    passwordHashType: typeof existing.passwordHash,
                })
            }

            if (!existing.passwordHash || typeof existing.passwordHash !== "string") {
                if (process.env.NODE_ENV === "development") {
                    console.error("[lookup-by-email] passwordHash is missing or invalid:", existing.passwordHash)
                }
                throw new Error("LOOKUP_FAILED")
            }

            // Debug logging in development
            if (process.env.NODE_ENV === "development") {
                console.log("[lookup-by-email] Verifying password:", {
                    hasPassword: !!password,
                    passwordType: typeof password,
                    passwordLength: password?.length,
                    hasPasswordHash: !!existing.passwordHash,
                    passwordHashLength: existing.passwordHash?.length,
                })
            }

            if (!password || typeof password !== "string") {
                if (process.env.NODE_ENV === "development") {
                    console.error("[lookup-by-email] password is missing or invalid:", password)
                }
                throw new Error("LOOKUP_FAILED")
            }
            // verifyPassword signature: verifyPassword({ hash, password })
            // better-auth uses scrypt format: salt:hash (hex strings separated by colon)
            const passwordOk = await verifyPassword({ hash: existing.passwordHash, password: password.trim() })
            if (!passwordOk) {
                throw new Error("LOOKUP_FAILED")
            }

            // If order is still pending, completing it is idempotent-safe.
            if (existing.status === "PENDING") {
                await tx.order.update({
                    where: { id: existing.id },
                    data: {
                        status: "COMPLETED",
                        paidAt: new Date(),
                    },
                })

                await tx.card.updateMany({
                    where: {
                        orderId: existing.id,
                        status: "RESERVED",
                    },
                    data: {
                        status: "SOLD",
                    },
                })

                const updated = await tx.order.findUnique({
                    where: { id: existing.id },
                    select: {
                        id: true,
                        orderNo: true,
                        email: true,
                        passwordHash: true,
                        status: true,
                        createdAt: true,
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

                if (!updated) {
                    throw new Error("LOOKUP_FAILED")
                }

                return updated
            }

            return existing
        })

        // Ensure product exists
        if (!order.product) {
            throw new Error("LOOKUP_FAILED")
        }

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
            createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
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

        // Log error details in development for debugging
        if (process.env.NODE_ENV === "development") {
            console.error("[lookup-by-email] Error:", error)
            if (error instanceof Error) {
                console.error("[lookup-by-email] Error message:", error.message)
                console.error("[lookup-by-email] Error stack:", error.stack)
            }
        }

        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

export const runtime = "nodejs"
