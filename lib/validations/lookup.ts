import { z } from "zod"

const baseFields = {
    password: z.string().min(1, "请输入查询密码"),
}

export const orderNoLookupSchema = z.object({
    ...baseFields,
    orderNo: z.string().min(1, "请输入订单号"),
    email: z.string(),
})

export const emailLookupSchema = z.object({
    ...baseFields,
    orderNo: z.string(),
    email: z.string().min(1, "请输入邮箱").pipe(z.email({ error: "请输入有效的邮箱地址" })),
})

export type OrderLookupFormValues = z.infer<typeof orderNoLookupSchema>
