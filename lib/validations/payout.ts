import * as z from "zod"

export const createPayoutSchema = z.object({
    amount: z.coerce.number().positive("金额必须大于 0"),
    note: z.string().max(500).optional(),
})

export const updatePayoutSchema = createPayoutSchema.partial()

export type CreatePayoutInput = z.infer<typeof createPayoutSchema>
export type UpdatePayoutInput = z.infer<typeof updatePayoutSchema>
