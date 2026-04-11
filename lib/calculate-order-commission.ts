import type { Prisma } from "@prisma/client"
import { getConfig } from "@/lib/config"

/** Prisma Decimal 等转为 number */
export function toNumber(value: unknown): number {
  if (typeof value === "number" && !Number.isNaN(value)) return value
  const d = value as { toNumber?: () => number }
  if (typeof d?.toNumber === "function") return d.toNumber()
  const n = Number(value)
  return Number.isNaN(n) ? 0 : n
}

/** Natural week: Monday 00:00:00 UTC */
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export interface CreateOrderCommissionsParams {
  orderId: string
  distributorId: string
  orderEmail: string
  orderAmount: unknown
  discountPercentApplied: unknown
  paidAt: Date
}

/**
 * Calculate and create commission records for an order within a transaction.
 * Applies anti-fraud, tier lookup, level-2 split.
 * No-ops silently when anti-fraud triggers or commission amount is 0.
 */
export async function createOrderCommissions(
  tx: Prisma.TransactionClient,
  params: CreateOrderCommissionsParams,
): Promise<void> {
  const {
    orderId,
    distributorId,
    orderEmail,
    orderAmount,
    discountPercentApplied,
    paidAt,
  } = params

  const distributor = await tx.user.findUnique({
    where: { id: distributorId },
    select: { email: true, inviterId: true },
  })
  if (!distributor) return

  // Anti-fraud: self-purchase
  const orderEmailNorm = orderEmail?.trim().toLowerCase() ?? ""
  const distributorEmailNorm = distributor.email?.trim().toLowerCase() ?? ""
  if (orderEmailNorm && orderEmailNorm === distributorEmailNorm) return

  // Tier lookup (week-based)
  const weekStart = getWeekStart(paidAt)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)

  const weekOrders = await tx.order.findMany({
    where: {
      distributorId,
      status: "COMPLETED",
      paidAt: { gte: weekStart, lt: weekEnd },
    },
    select: { amount: true },
  })
  const weekTotal = weekOrders.reduce((sum, o) => sum + toNumber(o.amount), 0)

  const tiers = await tx.commissionTier.findMany({
    orderBy: { sortOrder: "asc" },
  })
  let ratePercent: number | null = null
  for (const tier of tiers) {
    const min = toNumber(tier.minAmount)
    const max = toNumber(tier.maxAmount)
    if (weekTotal >= min && weekTotal < max) {
      ratePercent = toNumber(tier.ratePercent)
      break
    }
  }
  if (ratePercent == null && tiers.length > 0) {
    ratePercent = toNumber(tiers[0].ratePercent)
  }

  // Commission base: pre-discount price
  const paidAmount = toNumber(orderAmount)
  const discountPct = toNumber(discountPercentApplied)
  const commissionBase =
    discountPct > 0 && discountPct < 100
      ? paidAmount / (1 - discountPct / 100)
      : paidAmount
  const totalCommission =
    ratePercent != null && commissionBase > 0
      ? Math.round((commissionBase * ratePercent) / 100 * 100) / 100
      : 0

  if (totalCommission <= 0) return

  // Level-2 split
  const inviterId = distributor.inviterId ?? null
  let inviter: { email: string | null; role: string; disabledAt: Date | null } | null = null
  if (inviterId) {
    inviter = await tx.user.findUnique({
      where: { id: inviterId },
      select: { email: true, role: true, disabledAt: true },
    }) as { email: string | null; role: string; disabledAt: Date | null } | null
  }

  const config = getConfig()
  const level2Rate = config.level2CommissionRatePercent
  const shouldSplitLevel2 =
    inviterId &&
    inviter &&
    inviter.role === "DISTRIBUTOR" &&
    !inviter.disabledAt &&
    orderEmailNorm !== (inviter.email ?? "").trim().toLowerCase()

  if (shouldSplitLevel2) {
    const level2Amount = Math.round(totalCommission * level2Rate / 100 * 100) / 100
    const level1Amount = Math.round((totalCommission - level2Amount) * 100) / 100

    if (level1Amount > 0) {
      await tx.commission.create({
        data: {
          orderId,
          distributorId,
          amount: level1Amount,
          status: "SETTLED",
          level: 1,
        },
      })
    }
    if (level2Amount > 0) {
      await tx.commission.create({
        data: {
          orderId,
          distributorId: inviterId!,
          amount: level2Amount,
          status: "SETTLED",
          level: 2,
          sourceDistributorId: distributorId,
        },
      })
    }
  } else {
    await tx.commission.create({
      data: {
        orderId,
        distributorId,
        amount: totalCommission,
        status: "SETTLED",
        level: 1,
      },
    })
  }
}
