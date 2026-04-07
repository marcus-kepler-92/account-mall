import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError, notFound } from "@/lib/api-response"
import { createChannelWithdrawalSchema } from "@/lib/validations/payment-channel"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id } = await context.params

    const channel = await prisma.paymentChannel.findUnique({ where: { id } })
    if (!channel) return notFound("渠道不存在")

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = createChannelWithdrawalSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const withdrawal = await prisma.channelWithdrawal.create({
        data: {
            channelId: id,
            amount: parsed.data.amount,
            note: parsed.data.note,
        },
    })
    return NextResponse.json({ data: withdrawal }, { status: 201 })
}
