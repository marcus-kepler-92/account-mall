import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "better-auth/crypto"
import { createOrderSchema } from "@/lib/validations/order"

function generateOrderNo(): string {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "")
    return `FAK${today}`
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
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const parsed = createOrderSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: parsed.error.flatten() },
            { status: 400 }
        )
    }

    const { productId, email, orderPassword, quantity } = parsed.data

    const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, price: true, maxQuantity: true, status: true },
    })

    if (!product || product.status !== "ACTIVE") {
        return NextResponse.json({ error: "Product not found or unavailable" }, { status: 404 })
    }

    if (quantity < 1 || quantity > product.maxQuantity) {
        return NextResponse.json(
            { error: `Quantity must be between 1 and ${product.maxQuantity}` },
            { status: 400 }
        )
    }

    const unsoldCount = await prisma.card.count({
        where: { productId, status: "UNSOLD" },
    })

    if (unsoldCount < quantity) {
        return NextResponse.json(
            { error: `Insufficient stock. Available: ${unsoldCount}` },
            { status: 400 }
        )
    }

    const amount = Number(product.price) * quantity
    const passwordHash = await hashPassword(orderPassword)

    const prefix = generateOrderNo()
    let orderNo = `${prefix}0001`
    const lastOrder = await prisma.order.findFirst({
        where: { orderNo: { startsWith: prefix } },
        orderBy: { orderNo: "desc" },
        select: { orderNo: true },
    })
    if (lastOrder) {
        const seq = parseInt(lastOrder.orderNo.slice(-4), 10) + 1
        orderNo = `${prefix}${String(seq).padStart(4, "0")}`
    }

    const order = await prisma.$transaction(async (tx) => {
        const newOrder = await tx.order.create({
            data: {
                orderNo,
                productId,
                email: email.trim().toLowerCase(),
                passwordHash,
                quantity,
                amount,
                status: "PENDING",
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

    return NextResponse.json({
        orderNo: order.orderNo,
        amount: Number(order.amount),
        paymentUrl: null,
    })
}

export const runtime = "nodejs"
