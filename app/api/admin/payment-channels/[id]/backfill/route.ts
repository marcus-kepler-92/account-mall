import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, notFound } from "@/lib/api-response"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, context: RouteContext) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id } = await context.params

    const channel = await prisma.paymentChannel.findUnique({ where: { id } })
    if (!channel) return notFound("渠道不存在")

    // Assign all unattributed orders of the same payment type to this channel
    const result = await prisma.order.updateMany({
        where: {
            paymentChannelId: null,
            paymentMethod: channel.type,
        },
        data: { paymentChannelId: id },
    })

    return NextResponse.json({ data: { updated: result.count } })
}
