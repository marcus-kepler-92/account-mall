import type { Prisma } from "@prisma/client"

/**
 * Order shape that profit helpers need from Prisma.
 *
 * `costTotalSnapshot` is the authoritative cost field written on order completion
 * (sum of consumed cards' unitCost). `costSnapshot` is the legacy per-unit field,
 * read only as a fallback for historical orders that pre-date the cost-on-card rollout.
 */
export type OrderForCost = {
  costTotalSnapshot: Prisma.Decimal | null
  costSnapshot: Prisma.Decimal | null
  quantity: number
}

export type OrderCostResolution = {
  /** Total cost (in yuan) attributable to the order. 0 when nothing was recorded. */
  cost: number
  /** True iff cost data was found via either the new or legacy snapshot. */
  hasCost: boolean
}

/**
 * Resolve an order's cost using the new authoritative snapshot first,
 * falling back to the legacy per-unit snapshot × quantity for historical rows.
 *
 * Centralized here so sales-report, dashboard KPI, and any future profit consumer
 * stay on the same reading rules.
 */
export function resolveOrderCost(order: OrderForCost): OrderCostResolution {
  if (order.costTotalSnapshot !== null) {
    return { cost: Number(order.costTotalSnapshot), hasCost: true }
  }
  if (order.costSnapshot !== null) {
    return {
      cost: Number(order.costSnapshot) * order.quantity,
      hasCost: true,
    }
  }
  return { cost: 0, hasCost: false }
}
