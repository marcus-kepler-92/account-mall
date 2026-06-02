import type { OrderStatus, ProductType } from "@prisma/client"

type Rule = { from: OrderStatus; to: OrderStatus; productTypes: ReadonlyArray<ProductType> }

const ALL_TYPES: ReadonlyArray<ProductType> = ["NORMAL", "AUTO_FETCH", "MANUAL"]

const RULES: ReadonlyArray<Rule> = [
  { from: "PENDING", to: "COMPLETED", productTypes: ["NORMAL", "AUTO_FETCH"] },
  { from: "PENDING", to: "AWAITING_FULFILLMENT", productTypes: ["MANUAL"] },
  { from: "PENDING", to: "CLOSED", productTypes: ALL_TYPES },
  { from: "AWAITING_FULFILLMENT", to: "PROCESSING", productTypes: ["MANUAL"] },
  { from: "AWAITING_FULFILLMENT", to: "COMPLETED", productTypes: ["MANUAL"] },
  { from: "AWAITING_FULFILLMENT", to: "CLOSED", productTypes: ["MANUAL"] },
  { from: "PROCESSING", to: "COMPLETED", productTypes: ["MANUAL"] },
  { from: "PROCESSING", to: "CLOSED", productTypes: ["MANUAL"] },
  // Refund a paid+delivered order via the payment provider (易支付). Reverses
  // commissions and milestone bonuses; see app/api/admin/orders/[orderId]/refund.
  { from: "COMPLETED", to: "REFUNDED", productTypes: ALL_TYPES },
]

export class InvalidTransitionError extends Error {
  constructor(from: OrderStatus, to: OrderStatus, productType: ProductType) {
    super(`Illegal order transition: ${from} → ${to} (productType=${productType})`)
    this.name = "InvalidTransitionError"
  }
}

export function canTransition(from: OrderStatus, to: OrderStatus, productType: ProductType): boolean {
  return RULES.some((r) => r.from === from && r.to === to && r.productTypes.includes(productType))
}

export function assertTransition(from: OrderStatus, to: OrderStatus, productType: ProductType): void {
  if (!canTransition(from, to, productType)) {
    throw new InvalidTransitionError(from, to, productType)
  }
}
