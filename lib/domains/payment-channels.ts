import { prisma } from "@/lib/prisma"
import { toCents } from "@/lib/utils"

/** Returns the channel's available balance in integer cents (total income minus all withdrawals). */
export async function getChannelBalanceCents(channelId: string): Promise<number> {
  const [incomeAgg, withdrawnAgg] = await Promise.all([
    prisma.order.aggregate({
      where: { paymentChannelId: channelId, status: "COMPLETED" },
      _sum: { amount: true },
    }),
    prisma.channelWithdrawal.aggregate({
      where: { channelId },
      _sum: { amount: true },
    }),
  ])
  return toCents(Number(incomeAgg._sum.amount ?? 0)) - toCents(Number(withdrawnAgg._sum.amount ?? 0))
}
