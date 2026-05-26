import * as z from "zod"

/**
 * orderNo lookup still requires (orderNo + password) — the lookup API
 * verifies scrypt against the order's stored hash to gate card / fulfillment
 * content.
 */
export const orderNoLookupSchema = z.object({
    orderNo: z.string().min(1, "请输入订单号"),
    email: z.string(),
    password: z.string().min(1, "请输入查询密码"),
})

/**
 * email lookup returns the order LIST only (metadata) — no password needed
 * because we never expose card content here. The buyer enters per-order
 * passwords later when opening detail.
 */
export const emailLookupSchema = z.object({
    orderNo: z.string(),
    email: z.string().min(1, "请输入邮箱").pipe(z.email({ error: "请输入有效的邮箱地址" })),
    password: z.string(),
})

export type OrderLookupFormValues = z.infer<typeof orderNoLookupSchema>

/**
 * Schema for the per-row password Dialog (State C): buyer clicks a list row
 * and is prompted for that order's password to fetch detail.
 */
export const orderDetailPasswordSchema = z.object({
    password: z.string().min(1, "请输入查询密码"),
})

export type OrderDetailPasswordValues = z.infer<typeof orderDetailPasswordSchema>
