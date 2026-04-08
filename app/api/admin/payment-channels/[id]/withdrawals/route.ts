import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError, notFound, badRequest } from "@/lib/api-response"
import { createChannelWithdrawalSchema } from "@/lib/validations/payment-channel"

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

    // Compute current balance: all-time income minus all withdrawals
    const [incomeAgg, withdrawnAgg] = await Promise.all([
        prisma.order.aggregate({
            where: { paymentChannelId: id, status: "COMPLETED" },
            _sum: { amount: true },
        }),
        prisma.channelWithdrawal.aggregate({
            where: { channelId: id },
            _sum: { amount: true },
        }),
    ])
    const totalIncome = Number(incomeAgg._sum.amount ?? 0)
    const totalWithdrawn = Number(withdrawnAgg._sum.amount ?? 0)
    const balance = totalIncome - totalWithdrawn

    if (parsed.data.amount > balance) {
        return badRequest(`余额不足（当前余额 ¥${balance.toFixed(2)}）`)
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
