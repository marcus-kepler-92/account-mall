import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, notFound, invalidJsonBody, validationError, badRequest } from "@/lib/api-response"
import { updateChannelWithdrawalSchema } from "@/lib/validations/payment-channel"
import { toCents } from "@/lib/utils"
import { getChannelBalanceCents } from "@/lib/domains/payment-channels"

type RouteContext = { params: Promise<{ id: string; withdrawalId: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id, withdrawalId } = await context.params

    const withdrawal = await prisma.channelWithdrawal.findUnique({
        where: { id: withdrawalId, channelId: id },
    })
    if (!withdrawal) return notFound("提现记录不存在")

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = updateChannelWithdrawalSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    // If amount changes, re-validate balance
    if (parsed.data.amount !== undefined) {
        const currentBalanceCents = await getChannelBalanceCents(id)
        const oldAmountCents = toCents(Number(withdrawal.amount))
        const newAmountCents = toCents(parsed.data.amount)
        if (currentBalanceCents + oldAmountCents - newAmountCents < 0) {
            return badRequest(`余额不足（更新后余额将为负）`)
        }
    }

    const updated = await prisma.channelWithdrawal.update({
        where: { id: withdrawalId },
        data: parsed.data,
    })

    return NextResponse.json({ data: updated })
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id, withdrawalId } = await context.params

    const withdrawal = await prisma.channelWithdrawal.findUnique({
        where: { id: withdrawalId, channelId: id },
    })
    if (!withdrawal) return notFound("提现记录不存在")

    await prisma.channelWithdrawal.delete({ where: { id: withdrawalId } })

    return NextResponse.json({ data: { id: withdrawalId } })
}
