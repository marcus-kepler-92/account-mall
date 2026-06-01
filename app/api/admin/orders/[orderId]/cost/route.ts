import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import {
    unauthorized,
    notFound,
    invalidJsonBody,
    validationError,
    badRequest,
} from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { editOrderCostSchema } from "@/lib/validations/order"

type RouteContext = { params: Promise<{ orderId: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { orderId } = await context.params

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = editOrderCostSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { status: true },
    })
    if (!order) return notFound("订单不存在")
    // Cost only becomes meaningful (and is settled) on completion; editing earlier
    // would be overwritten by the completion flow's cost snapshot.
    if (order.status !== "COMPLETED") {
        return badRequest("仅已完成订单可编辑成本")
    }

    await prisma.order.update({
        where: { id: orderId },
        data: { costTotalSnapshot: parsed.data.costTotal },
    })

    return NextResponse.json({ ok: true })
}

export const runtime = "nodejs"
