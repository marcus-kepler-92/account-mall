import { z } from "zod"

export const createRestockSubscriptionSchema = z.object({
    productId: z.string().min(1, "Product ID is required"),
    email: z.email({ error: "Invalid email address" }),
})

export type CreateRestockSubscriptionInput = z.infer<
    typeof createRestockSubscriptionSchema
>
