import { z } from "zod"

export const crossSellSettingSchema = z.object({
    enabled: z.boolean(),
    discountPercent: z.coerce.number().min(0).max(50),
    ttlMinutes: z.coerce.number().int().min(5).max(180),
})

export const productCrossSellUpdateSchema = z.object({
    targetProductIds: z.array(z.string()).max(3),
})
