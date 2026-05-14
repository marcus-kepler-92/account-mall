import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError, notFound, badRequest } from "@/lib/api-response"
import { createChannelWithdrawalSchema } from "@/lib/validations/payment-channel"
import { toCents, formatCurrency } from "@/lib/utils"
import { getChannelBalanceCents } from "@/lib/domains/payment-channels"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id } = await context.params

    const channel = await prisma.paymentChannel.findUnique({ where: { id } })
    if (!channel) return notFound("渠道不存在")

    const withdrawals = await prisma.channelWithdrawal.findMany({
        where: { channelId: id },
        orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ data: withdrawals })
}

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

    const balanceCents = await getChannelBalanceCents(id)
    if (toCents(parsed.data.amount) > balanceCents) {
        return badRequest(`余额不足（当前余额 ${formatCurrency(balanceCents / 100)}）`)
    }

    const withdrawal = await prisma.channelWithdrawal.create({
        data: {
            channelId: id,
            amount: parsed.data.amount,
            note: parsed.data.note,
        },
    })
    return NextResponse.json({ data: withdrawal }, { status: 201 })
}
