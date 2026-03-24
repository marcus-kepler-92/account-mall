import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, notFound, badRequest } from "@/lib/api-response"
import { z } from "zod"

const updateDistributorSchema = z.object({
    disabled: z.boolean().optional(),
    discountCodeEnabled: z.boolean().optional(),
    discountPercent: z.number().min(0).max(100).nullable().optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id } = await context.params

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = updateDistributorSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.flatten() },
            { status: 400 }
        )
    }

    const existing = await prisma.user.findFirst({
        where: { id, role: "DISTRIBUTOR" },
    })
    if (!existing) return notFound("Distributor not found")

    const data: { disabledAt?: Date | null; discountCodeEnabled?: boolean; discountPercent?: number | null } = {}
    if (parsed.data.disabled === true) data.disabledAt = new Date()
    else if (parsed.data.disabled === false) data.disabledAt = null
    if (parsed.data.discountCodeEnabled !== undefined) data.discountCodeEnabled = parsed.data.discountCodeEnabled
    if (parsed.data.discountPercent !== undefined) data.discountPercent = parsed.data.discountPercent

    const user = await prisma.user.update({
        where: { id },
        data,
        select: {
            id: true,
            email: true,
            name: true,
            distributorCode: true,
            discountCodeEnabled: true,
            discountPercent: true,
            disabledAt: true,
        },
    })

    return NextResponse.json({
        ...user,
        discountPercent: user.discountPercent != null ? Number(user.discountPercent) : null,
    })
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id } = await context.params

    const existing = await prisma.user.findFirst({
        where: { id, role: "DISTRIBUTOR" },
        select: { disabledAt: true },
    })
    if (!existing) return notFound("Distributor not found")

    if (!existing.disabledAt) return badRequest("请先停用该分销员再删除")

    const [orderCount, commissionCount, withdrawalCount, inviteeCount] = await Promise.all([
        prisma.order.count({ where: { distributorId: id } }),
        prisma.commission.count({ where: { distributorId: id } }),
        prisma.withdrawal.count({ where: { distributorId: id } }),
        prisma.user.count({ where: { inviterId: id } }),
    ])

    if (orderCount > 0) return badRequest("该分销员存在关联订单，无法删除")
    if (commissionCount > 0) return badRequest("该分销员存在关联佣金记录，无法删除")
    if (withdrawalCount > 0) return badRequest("该分销员存在关联提现记录，无法删除")
    if (inviteeCount > 0) return badRequest("该分销员存在下线分销员，无法删除")

    await prisma.$transaction([
        prisma.distributorInvitation.deleteMany({ where: { inviterId: id } }),
        prisma.user.delete({ where: { id } }),
    ])

    return NextResponse.json({ success: true })
}
