// lib/domains/variants/validators.ts
import { z } from "zod"

export const variantCreateSchema = z.object({
  name: z.string().min(1, "名称必填").max(200),
  price: z.coerce.number().nonnegative().multipleOf(0.01),
  unitCost: z.coerce.number().nonnegative().multipleOf(0.01).optional().nullable(),
  stockQuantity: z.coerce.number().int().nonnegative(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
})

export const variantUpdateSchema = variantCreateSchema.partial()

export type VariantCreateInput = z.infer<typeof variantCreateSchema>
export type VariantUpdateInput = z.infer<typeof variantUpdateSchema>
