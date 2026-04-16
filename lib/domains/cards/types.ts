// lib/domains/cards/types.ts
import type { Prisma } from "@prisma/client"

export type Card = Prisma.CardGetPayload<Record<string, never>>
export type CardStatus = "UNSOLD" | "RESERVED" | "SOLD" | "DISABLED"

export type CardRow = {
  id: string
  content: string
  status: CardStatus
  orderNo: string | null
  createdAt: string
}

export type CardStats = {
  UNSOLD: number
  RESERVED: number
  SOLD: number
  DISABLED: number
}

export type BulkImportResult = { imported: number; total: number }
export type BatchActionResult = { success: number; skipped: number }

// Domain errors
export class CardNotFoundError extends Error {
  constructor(id: string) {
    super(`Card ${id} not found`)
    this.name = "CardNotFoundError"
  }
}

export class CardStatusTransitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CardStatusTransitionError"
  }
}

export class AutoFetchProductError extends Error {
  constructor() {
    super("AUTO_FETCH products do not support manual card import")
    this.name = "AutoFetchProductError"
  }
}
