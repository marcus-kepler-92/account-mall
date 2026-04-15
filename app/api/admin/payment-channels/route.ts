import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError } from "@/lib/api-response"
import { createPaymentChannelSchema } from "@/lib/validations/payment-channel"
import { getHKTYearBounds } from "@/lib/utils"

export async function GET() {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const channels = await prisma.paymentChannel.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    })

    if (channels.length === 0) {
        return NextResponse.json({ data: [] })
    }

    const channelIds = channels.map((c) => c.id)
    const { start, end } = getHKTYearBounds()

    const [yearIncomeRows, totalIncomeRows, withdrawalRows] = await Promise.all([
        prisma.order.groupBy({
            by: ["paymentChannelId"],
            where: { paymentChannelId: { in: channelIds }, status: "COMPLETED", paidAt: { gte: start, lt: end } },
            _sum: { amount: true },
        }),
        prisma.order.groupBy({
            by: ["paymentChannelId"],
            where: { paymentChannelId: { in: channelIds }, status: "COMPLETED" },
            _sum: { amount: true },
        }),
        prisma.channelWithdrawal.groupBy({
            by: ["channelId"],
            where: { channelId: { in: channelIds } },
            _sum: { amount: true },
        }),
    ])

    const yearMap = new Map(yearIncomeRows.map((r) => [r.paymentChannelId, Number(r._sum.amount ?? 0)]))
    const totalMap = new Map(totalIncomeRows.map((r) => [r.paymentChannelId, Number(r._sum.amount ?? 0)]))
    const withdrawnMap = new Map(withdrawalRows.map((r) => [r.channelId, Number(r._sum.amount ?? 0)]))

    const data = channels.map((c) => {
        const yearIncome = yearMap.get(c.id) ?? 0
        const totalIncome = totalMap.get(c.id) ?? 0
        const totalWithdrawn = withdrawnMap.get(c.id) ?? 0
        return {
            id: c.id,
            nickname: c.nickname,
            pid: c.pid,
            // NOTE: key is intentionally omitted from list response
            submitUrl: c.submitUrl,
            siteName: c.siteName,
            type: c.type,
            annualLimit: Number(c.annualLimit),
            sortOrder: c.sortOrder,
            isActive: c.isActive,
            createdAt: c.createdAt.toISOString(),
            yearIncome,
            totalIncome,
            totalWithdrawn,
            balance: totalIncome - totalWithdrawn,
        }
    })

    return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = createPaymentChannelSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const channel = await prisma.paymentChannel.create({ data: parsed.data })
    const { key: _k, ...rest } = channel
    return NextResponse.json({ data: rest }, { status: 201 })
}
