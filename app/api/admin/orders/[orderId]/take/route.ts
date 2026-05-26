import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { assertTransition, InvalidTransitionError } from "@/lib/order-state-machine"
import { unauthorized, conflict, notFound, internalServerError } from "@/lib/api-response"

export async function POST(_request: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { orderId } = await ctx.params
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { product: { select: { productType: true } } },
    })
    if (!order) return notFound("Order not found")
    if (!order.product) return internalServerError()

    try {
        assertTransition(order.status, "PROCESSING", order.product.productType)
    } catch (err) {
        if (err instanceof InvalidTransitionError) return conflict(err.message)
        throw err
    }

    await prisma.order.update({ where: { id: orderId }, data: { status: "PROCESSING" } })
    return NextResponse.json({ ok: true })
}
