import { completePendingOrder } from "@/lib/complete-pending-order"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { updateOrderStatusSchema } from "@/lib/validations/order"
import { unauthorized, notFound, invalidJsonBody, validationError, conflict, internalServerError } from "@/lib/api-response"

/** Only allow: PENDING → COMPLETED, PENDING → CLOSED. COMPLETED → CLOSED is forbidden. */
function isValidStatusTransition(from: string, to: string): boolean {
    if (from === to) return true
    if (from === "PENDING" && (to === "COMPLETED" || to === "CLOSED")) return true
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
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ orderId: string }> }
) {
    const session = await getAdminSession()
    if (!session) {
        return unauthorized()
    }

    const { orderId } = await params
    const order = await prisma.order.findUnique({
        where: { id: orderId },
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
        return notFound("Order not found")
    }

    return NextResponse.json(mapOrderToResponse(order))
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ orderId: string }> }
) {
    const session = await getAdminSession()
    if (!session) {
        return unauthorized()
    }

    const { orderId } = await params
    let body: unknown
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = updateOrderStatusSchema.safeParse(body)
    if (!parsed.success) {
        return validationError(parsed.error.flatten())
    }

    const { status: nextStatus } = parsed.data

    const existing = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            cards: { select: { id: true, status: true } },
        },
    })
    if (!existing) {
        return notFound("Order not found")
    }
    const currentStatus = existing.status
    if (!isValidStatusTransition(currentStatus, nextStatus)) {
        return conflict("Invalid status transition")
    }
    if (currentStatus === nextStatus) {
        const unchanged = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                product: { select: { id: true, name: true, price: true } },
                cards: { select: { status: true } },
            },
        })
        if (!unchanged) return notFound("Order not found")
        return NextResponse.json(mapOrderToResponse(unchanged))
    }

    if (currentStatus === "PENDING" && nextStatus === "COMPLETED") {
        const result = await completePendingOrder(existing.orderNo)
        if (!result.done) {
            return conflict(result.error ?? "Could not complete order")
        }
    } else if (nextStatus === "CLOSED") {
        try {
            await prisma.$transaction(async (tx) => {
                await tx.order.update({
                    where: { id: existing.id },
                    data: { status: "CLOSED" },
                })
                if (currentStatus === "PENDING") {
                    await tx.card.updateMany({
                        where: { orderId: existing.id, status: "RESERVED" },
                        data: { status: "UNSOLD", orderId: null },
                    })
                }
            })
        } catch {
            return internalServerError()
        }
    }

    const updated = await prisma.order.findUnique({
        where: { id: orderId },
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
        return notFound("Order not found")
    }

    if (nextStatus === "COMPLETED") {
        console.warn("[admin/order-completed]", {
            orderId,
            orderNo: updated.orderNo,
            adminUserId: session.user?.id,
            adminUserEmail: session.user?.email,
            at: new Date().toISOString(),
        })
    }

    return NextResponse.json(mapOrderToResponse(updated))
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ orderId: string }> }
) {
    const session = await getAdminSession()
    if (!session) {
        return unauthorized()
    }

    const { orderId } = await params
    try {
        await prisma.$transaction(async (tx) => {
            const existing = await tx.order.findUnique({
                where: { id: orderId },
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
            return notFound("Order not found")
        }

        return internalServerError()
    }

    const order = await prisma.order.findUnique({
        where: { id: orderId },
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
        return notFound("Order not found")
    }

    return NextResponse.json(mapOrderToResponse(order))
}

export const runtime = "nodejs"

