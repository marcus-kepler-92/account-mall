// lib/domains/cards/validators.ts
import * as z from "zod"

const MAX_BULK_IMPORT = 500

export const bulkImportCardsSchema = z.object({
  contents: z
    .array(z.string().min(1, "Card content cannot be empty"))
    .min(1, "At least one card is required")
    .max(MAX_BULK_IMPORT, `Maximum ${MAX_BULK_IMPORT} cards per import`),
})

export type BulkImportCardsInput = z.infer<typeof bulkImportCardsSchema>

export const patchCardStatusSchema = z.object({
  status: z.enum(["DISABLED", "UNSOLD"]),
})

export type PatchCardStatusInput = z.infer<typeof patchCardStatusSchema>

export const batchCardActionSchema = z.object({
  action: z.enum(["DELETE", "DISABLE", "ENABLE"]),
  cardIds: z
    .array(z.string().min(1))
    .min(1, "At least one card ID is required")
    .max(100, "Maximum 100 cards per batch operation"),
})

export type BatchCardActionInput = z.infer<typeof batchCardActionSchema>

export const cardStatusFilterSchema = z
  .enum(["UNSOLD", "RESERVED", "SOLD", "DISABLED"])
  .nullable()
  .optional()
