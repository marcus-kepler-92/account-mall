import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, notFound, invalidJsonBody, validationError, badRequest } from "@/lib/api-response"
import { updatePayoutSchema } from "@/lib/validations/payout"
import { toCents } from "@/lib/utils"
import { getFinanceSummary } from "@/lib/domains/finance"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id } = await context.params
    const payout = await prisma.payout.findUnique({ where: { id } })
    if (!payout) return notFound("提现记录不存在")

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = updatePayoutSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    if (parsed.data.amount !== undefined) {
        const { balanceCents } = await getFinanceSummary()
        const oldAmountCents = toCents(Number(payout.amount))
        const newAmountCents = toCents(parsed.data.amount)
        // balance already has the old amount deducted; new balance = current + old - new
        if (balanceCents + oldAmountCents - newAmountCents < 0) {
            return badRequest("余额不足（更新后余额将为负）")
        }
    }

    const updated = await prisma.payout.update({ where: { id }, data: parsed.data })
    return NextResponse.json({ data: updated })
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id } = await context.params
    const payout = await prisma.payout.findUnique({ where: { id } })
    if (!payout) return notFound("提现记录不存在")

    await prisma.payout.delete({ where: { id } })
    return NextResponse.json({ data: { id } })
}

export const runtime = "nodejs"
