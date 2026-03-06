import { z } from "zod";

const MAX_BULK_IMPORT = 500;

/**
 * Schema for bulk importing cards.
 * Validates: non-empty array, each content non-empty, max 500 items.
 * Caller should dedupe before/after validation.
 */
export const bulkImportCardsSchema = z.object({
    contents: z
        .array(z.string().min(1, "Card content cannot be empty"))
        .min(1, "At least one card is required")
        .max(MAX_BULK_IMPORT, `Maximum ${MAX_BULK_IMPORT} cards per import`),
});

export type BulkImportCardsInput = z.infer<typeof bulkImportCardsSchema>;

/**
 * Schema for PATCH /api/cards/[cardId] (disable/enable).
 * status: DISABLED = 停用, UNSOLD = 启用
 */
export const patchCardStatusSchema = z.object({
    status: z.enum(["DISABLED", "UNSOLD"]),
});

export type PatchCardStatusInput = z.infer<typeof patchCardStatusSchema>;

/**
 * Schema for POST /api/cards/batch (batch delete/disable/enable).
 * - action: DELETE (only UNSOLD), DISABLE (only UNSOLD), ENABLE (only DISABLED)
 * - cardIds: 1–100 IDs
 */
export const batchCardActionSchema = z.object({
    action: z.enum(["DELETE", "DISABLE", "ENABLE"]),
    cardIds: z
        .array(z.string().min(1))
        .min(1, "At least one card ID is required")
        .max(100, "Maximum 100 cards per batch operation"),
});

export type BatchCardActionInput = z.infer<typeof batchCardActionSchema>;
