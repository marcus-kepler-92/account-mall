import { sendOrderCompletionEmail } from "@/lib/order-completion-email"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { updateOrderStatusSchema } from "@/lib/validations/order"

function isValidStatusTransition(from: string, to: string): boolean {
    if (from === to) {
        return true
    }

    if (from === "PENDING" && (to === "COMPLETED" || to === "CLOSED")) {
        return true
    }

    if (from === "COMPLETED" && to === "CLOSED") {
        return true
    }

    return false
}

function mapOrderToResponse(order: {
    id: string
    orderNo: string
    email: string
    quantity: number
    amount: unknown
    status: string
    paidAt: Date | null
    createdAt: Date
    product: {
        id: string
        name: string
        price: unknown
    }
    cards: {
        status: string
    }[]
}) {
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
}

export async function GET(
    _request: NextRequest,
    { params }: { params: { orderId: string } }
) {
    const session = await getAdminSession()
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const order = await prisma.order.findUnique({
        where: { id: params.orderId },
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
    })

    if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    return NextResponse.json(mapOrderToResponse(order))
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: { orderId: string } }
) {
    const session = await getAdminSession()
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const parsed = updateOrderStatusSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: parsed.error.flatten() },
            { status: 400 }
        )
    }

    const { status: nextStatus } = parsed.data

    try {
        await prisma.$transaction(async (tx) => {
            const existing = await tx.order.findUnique({
                where: { id: params.orderId },
                include: {
                    cards: {
                        select: {
                            id: true,
                            status: true,
                        },
                    },
                },
            })

            if (!existing) {
                throw new Error("ORDER_NOT_FOUND")
            }

            const currentStatus = existing.status

            if (!isValidStatusTransition(currentStatus, nextStatus)) {
                throw new Error("INVALID_STATUS_TRANSITION")
            }

            if (currentStatus === nextStatus) {
                // Idempotent: nothing to update
                return
            }

            if (currentStatus === "PENDING" && nextStatus === "COMPLETED") {
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
            } else if (nextStatus === "CLOSED") {
                await tx.order.update({
                    where: { id: existing.id },
                    data: {
                        status: "CLOSED",
                    },
                })

                if (currentStatus === "PENDING") {
                    await tx.card.updateMany({
                        where: {
                            orderId: existing.id,
                            status: "RESERVED",
                        },
                        data: {
                            status: "UNSOLD",
                            orderId: null,
                        },
                    })
                }
            }
        })
    } catch (error) {
        if (error instanceof Error) {
            if (error.message === "ORDER_NOT_FOUND") {
                return NextResponse.json({ error: "Order not found" }, { status: 404 })
            }

            if (error.message === "INVALID_STATUS_TRANSITION") {
                return NextResponse.json(
                    {
                        error: "Bad request",
                        message: "Invalid status transition",
                    },
                    { status: 409 }
                )
            }
        }

        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    const updated = await prisma.order.findUnique({
        where: { id: params.orderId },
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
    })

    if (!updated) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    if (nextStatus === "COMPLETED") {
        sendOrderCompletionEmail(params.orderId).catch((err) =>
            console.error("[order-completion-email]", err),
        )
    }

    return NextResponse.json(mapOrderToResponse(updated))
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: { orderId: string } }
) {
    const session = await getAdminSession()
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        await prisma.$transaction(async (tx) => {
            const existing = await tx.order.findUnique({
                where: { id: params.orderId },
                include: {
                    cards: {
                        select: {
                            id: true,
                            status: true,
                        },
                    },
                },
            })

            if (!existing) {
                throw new Error("ORDER_NOT_FOUND")
            }

            // We choose to soft-close the order instead of hard-deleting it.
            if (existing.status !== "CLOSED") {
                await tx.order.update({
                    where: { id: existing.id },
                    data: {
                        status: "CLOSED",
                    },
                })
            }

            if (existing.status === "PENDING") {
                await tx.card.updateMany({
                    where: {
                        orderId: existing.id,
                        status: "RESERVED",
                    },
                    data: {
                        status: "UNSOLD",
                        orderId: null,
                    },
                })
            }
        })
    } catch (error) {
        if (error instanceof Error && error.message === "ORDER_NOT_FOUND") {
            return NextResponse.json({ error: "Order not found" }, { status: 404 })
        }

        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    const order = await prisma.order.findUnique({
        where: { id: params.orderId },
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
    })

    if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    return NextResponse.json(mapOrderToResponse(order))
}

export const runtime = "nodejs"

