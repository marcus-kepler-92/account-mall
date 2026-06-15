import { prisma } from "@/lib/prisma"
import { toCents } from "@/lib/utils"

export type FinanceSummary = {
    totalIncomeCents: number
    totalWithdrawnCents: number
    balanceCents: number
}

/** 平台收款账户资金汇总：全部已完成订单收入 − 全部提现 = 余额（整数分）。 */
export async function getFinanceSummary(): Promise<FinanceSummary> {
    const [incomeAgg, withdrawnAgg] = await Promise.all([
        prisma.order.aggregate({ where: { status: "COMPLETED" }, _sum: { amount: true } }),
        prisma.payout.aggregate({ _sum: { amount: true } }),
    ])
    const totalIncomeCents = toCents(Number(incomeAgg._sum.amount ?? 0))
    const totalWithdrawnCents = toCents(Number(withdrawnAgg._sum.amount ?? 0))
    return {
        totalIncomeCents,
        totalWithdrawnCents,
        balanceCents: totalIncomeCents - totalWithdrawnCents,
    }
}
