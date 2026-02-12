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
