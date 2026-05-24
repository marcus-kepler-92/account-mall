// lib/domains/variants/validators.ts
import { z } from "zod"

export const variantCreateSchema = z.object({
  name: z.string().min(1, "名称必填").max(200),
  price: z.coerce.number().nonnegative().multipleOf(0.01),
  unitCost: z.coerce.number().nonnegative().multipleOf(0.01).optional().nullable(),
  // Optional + default 0: untracked MANUAL products (inventoryTracked=false)
  // don't send this field at all — the SKU editor strips it from the payload
  // since the 库存 column is hidden. Tracked products always send a real value
  // through the autosave / create-product flow.
  stockQuantity: z.coerce.number().int().nonnegative().optional().default(0),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
})

export const variantUpdateSchema = variantCreateSchema.partial()

export type VariantCreateInput = z.infer<typeof variantCreateSchema>
export type VariantUpdateInput = z.infer<typeof variantUpdateSchema>
