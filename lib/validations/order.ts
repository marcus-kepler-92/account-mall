import { z } from "zod"

export const createOrderSchema = z.object({
    productId: z.string().min(1, "Product ID is required"),
    email: z.string().email("Invalid email address"),
    orderPassword: z.string().min(6, "Password must be at least 6 characters"),
    quantity: z.number().int().min(1, "Quantity must be at least 1"),
})

export const orderStatusSchema = z.enum(["PENDING", "COMPLETED", "CLOSED"])

export const orderListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: z.union([orderStatusSchema, z.literal("ALL")]).optional(),
    email: z.string().email().optional(),
    orderNo: z.string().trim().min(1).optional(),
    productId: z.string().trim().min(1).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
})

export const updateOrderStatusSchema = z.object({
    status: orderStatusSchema,
    note: z.string().max(500).optional(),
})

export const publicOrderLookupSchema = z.object({
    orderNo: z.string().min(1, "Order number is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
})

export const publicOrderLookupByEmailSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
})

export const orderByEmailQuerySchema = z.object({
    email: z.string().email("Invalid email address"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type OrderListQueryInput = z.infer<typeof orderListQuerySchema>
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>
export type PublicOrderLookupInput = z.infer<typeof publicOrderLookupSchema>
export type PublicOrderLookupByEmailInput = z.infer<typeof publicOrderLookupByEmailSchema>
export type OrderByEmailQueryInput = z.infer<typeof orderByEmailQuerySchema>
