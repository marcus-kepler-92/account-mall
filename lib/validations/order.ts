import { z } from "zod"

export const createOrderSchema = z.object({
    productId: z.string().min(1, "Product ID is required"),
    email: z.string().email("Invalid email address"),
    orderPassword: z.string().min(6, "Password must be at least 6 characters"),
    quantity: z.number().int().min(1, "Quantity must be at least 1"),
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>
