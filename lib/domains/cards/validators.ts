// lib/domains/cards/validators.ts
import * as z from "zod"

const MAX_BULK_IMPORT = 500
// Matches Prisma Decimal(10, 2): max 8 integer digits + 2 decimal digits.
const MAX_UNIT_COST = 99999999.99

export const bulkImportCardsSchema = z.object({
  contents: z
    .array(z.string().min(1, "Card content cannot be empty"))
    .min(1, "At least one card is required")
    .max(MAX_BULK_IMPORT, `Maximum ${MAX_BULK_IMPORT} cards per import`),
  // Whole-batch unit cost: every card imported in this call shares this procurement cost.
  // Optional — leaving it null keeps the legacy "no cost recorded" behavior.
  unitCost: z
    .number()
    .finite("Unit cost must be a finite number")
    .nonnegative("Unit cost must be non-negative")
    .max(MAX_UNIT_COST, "Unit cost exceeds maximum")
    .refine(
      // Avoid floating-point pitfalls of multipleOf(0.01): check via integer cents.
      (v) => Math.round(v * 100) / 100 === v,
      "Unit cost supports at most 2 decimal places",
    )
    .nullish()
    .transform((v) => v ?? null),
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
