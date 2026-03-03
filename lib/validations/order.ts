import { z } from "zod"

// --- API schemas (orders API routes) ---

export const orderStatusSchema = z.enum(["PENDING", "COMPLETED", "CLOSED"])

export const publicOrderLookupSchema = z.object({
    orderNo: z.string().min(1),
    password: z.string().min(6),
})

export const publicOrderLookupByEmailSchema = z.object({
    email: z.string().min(1).pipe(z.email()),
    password: z.string().min(1),
})

export const orderByEmailPostSchema = z.object({
    email: z.string().min(1).pipe(z.email()),
    password: z.string().min(1),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const updateOrderStatusSchema = z.object({
    status: orderStatusSchema,
})

export const createOrderSchema = z.object({
    productId: z.string().min(1),
    email: z.string().min(1).pipe(z.email()),
    orderPassword: z.string().min(6),
    quantity: z.number().int().min(1),
    turnstileToken: z.string().optional(),
})

export const orderListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: z.enum(["PENDING", "COMPLETED", "CLOSED", "ALL"]).optional(),
    email: z.string().optional(),
    orderNo: z.string().optional(),
    productId: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
})

// --- Form schema (product-order-form client) ---

export function createOrderFormSchema(maxQuantity: number) {
    return z.object({
        email: z.string().min(1, "请输入邮箱").pipe(z.email({ error: "请输入有效的邮箱地址" })),
        orderPassword: z.string().min(6, "订单密码至少 6 位"),
        quantity: z.number().int().min(1, "数量至少为 1").max(maxQuantity, `数量不能超过 ${maxQuantity}`),
    })
}

export type OrderFormSchema = z.infer<ReturnType<typeof createOrderFormSchema>>
