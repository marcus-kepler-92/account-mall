// lib/domains/variants/types.ts
import type { Prisma } from "@prisma/client"

export type Variant = Prisma.ProductVariantGetPayload<Record<string, never>>

export type VariantRow = {
  id: string
  name: string
  price: string         // decimal as string for JSON safety
  unitCost: string | null
  stockQuantity: number
  sortOrder: number
  isActive: boolean
  createdAt: string
}

export class VariantNotFoundError extends Error {
  constructor(id: string) {
    super(`Variant ${id} not found`)
    this.name = "VariantNotFoundError"
  }
}

export class VariantHasOrdersError extends Error {
  constructor(id: string) {
    super(`Variant ${id} has linked orders and cannot be deleted`)
    this.name = "VariantHasOrdersError"
  }
}

export class NotManualProductError extends Error {
  constructor() {
    super("Product is not MANUAL type")
    this.name = "NotManualProductError"
  }
}
