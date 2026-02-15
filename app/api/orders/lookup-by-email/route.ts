import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"
import { publicOrderLookupByEmailSchema } from "@/lib/validations/order"
import { verifyPassword } from "better-auth/crypto"
import { checkOrderQueryRateLimit } from "@/lib/rate-limit"
import { invalidJsonBody, validationError, badRequest, internalServerError } from "@/lib/api-response"

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
        // Maximum orders to check for password match (performance limit)
        const MAX_ORDERS_TO_CHECK = 20

        const result = await prisma.$transaction(async (tx) => {
            // Find all orders matching the email (limit to recent ones for performance)
            const allOrders = await tx.order.findMany({
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
                throw new Error("LOOKUP_FAILED")
            }

            // Debug logging in development
            if (config.nodeEnv === "development") {
                console.log("[lookup-by-email] Found orders:", {
                    count: allOrders.length,
                    email: email.trim().toLowerCase(),
                })
            }

            // Verify password for each order and collect matching ones
            const matchingOrders = []
            for (const order of allOrders) {
                if (!order.passwordHash || typeof order.passwordHash !== "string") {
                    if (config.nodeEnv === "development") {
                        console.warn("[lookup-by-email] Skipping order with invalid passwordHash:", order.orderNo)
                    }
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
                } catch (err) {
                    if (config.nodeEnv === "development") {
                        console.error("[lookup-by-email] Password verification error for order:", order.orderNo, err)
                    }
                }
            }

            if (matchingOrders.length === 0) {
                throw new Error("LOOKUP_FAILED")
            }

            // If only one order matches, return full details
            if (matchingOrders.length === 1) {
                const order = matchingOrders[0]

                return {
                    type: "single" as const,
                    data: order,
                }
            }

            // Multiple orders match - return list without cards
            return {
                type: "multiple" as const,
                data: matchingOrders,
            }
        })

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

            // For COMPLETED/CLOSED orders, return cards
            const cards = order.cards
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
    } catch (error) {
        if (error instanceof Error && error.message === "LOOKUP_FAILED") {
            return badRequest("Order not found or password incorrect")
        }

        // Log error details in development for debugging
        if (config.nodeEnv === "development") {
            console.error("[lookup-by-email] Error:", error)
            if (error instanceof Error) {
                console.error("[lookup-by-email] Error message:", error.message)
                console.error("[lookup-by-email] Error stack:", error.stack)
            }
        }

        return internalServerError()
    }
}

export const runtime = "nodejs"
