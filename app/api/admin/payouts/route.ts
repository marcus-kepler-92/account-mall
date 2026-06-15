import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError, badRequest } from "@/lib/api-response"
import { createPayoutSchema } from "@/lib/validations/payout"
import { toCents, formatCurrency } from "@/lib/utils"
import { getFinanceSummary } from "@/lib/domains/finance"

export async function POST(request: NextRequest) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = createPayoutSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { balanceCents } = await getFinanceSummary()
    if (toCents(parsed.data.amount) > balanceCents) {
        return badRequest(`余额不足（当前余额 ${formatCurrency(balanceCents / 100)}）`)
    }

    const payout = await prisma.payout.create({
        data: { amount: parsed.data.amount, note: parsed.data.note },
    })
    return NextResponse.json({ data: payout }, { status: 201 })
}

export const runtime = "nodejs"
