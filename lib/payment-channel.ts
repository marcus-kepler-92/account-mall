import { prisma } from "@/lib/prisma"
import type { PaymentChannel } from "@prisma/client"

function getYearBounds(): { start: Date; end: Date } {
    const year = new Date().getFullYear()
    return {
        start: new Date(year, 0, 1),
        end: new Date(year + 1, 0, 1),
    }
}

export async function selectPaymentChannel(type: string): Promise<PaymentChannel | null> {
    const channels = await prisma.paymentChannel.findMany({
        where: { isActive: true, type },
        orderBy: { sortOrder: "asc" },
    })

    if (channels.length === 0) return null

    const { start, end } = getYearBounds()

    const incomeRows = await prisma.order.groupBy({
        by: ["paymentChannelId"],
        where: {
            paymentChannelId: { in: channels.map((c) => c.id) },
            status: "COMPLETED",
            paidAt: { gte: start, lt: end },
        },
        _sum: { amount: true },
    })

    const incomeMap = new Map(
        incomeRows.map((r) => [r.paymentChannelId, Number(r._sum.amount ?? 0)])
    )

    for (const channel of channels) {
        const income = incomeMap.get(channel.id) ?? 0
        if (income < Number(channel.annualLimit)) {
            return channel
        }
    }

    // All over limit: return the one with the most remaining capacity (least exceeded)
    return channels.reduce((best, ch) => {
        const bestRemaining = Number(best.annualLimit) - (incomeMap.get(best.id) ?? 0)
        const chRemaining = Number(ch.annualLimit) - (incomeMap.get(ch.id) ?? 0)
        return chRemaining > bestRemaining ? ch : best
    })
}
