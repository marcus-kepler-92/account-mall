import * as z from "zod"

export const distributorInviteSchema = z.object({
    email: z
        .string()
        .email("请输入有效的邮箱地址")
        .transform((v) => v.toLowerCase().trim()),
})

export const acceptInviteSchema = z.object({
    token: z.string().min(1, "邀请 token 不能为空"),
    name: z.string().min(1, "请输入昵称").max(50, "昵称不能超过 50 字符"),
    password: z.string().min(6, "密码至少 6 位").max(128, "密码不能超过 128 位"),
})

export const usernameSchema = z
    .string()
    .min(6, "用户名至少 6 位")
    .max(30, "用户名不能超过 30 位")
    .regex(/^[a-zA-Z0-9_]+$/, "用户名只能包含字母、数字和下划线")
    .trim()

export const acceptNoEmailInviteSchema = acceptInviteSchema.extend({
    username: usernameSchema,
})

export type DistributorInviteInput = z.infer<typeof distributorInviteSchema>
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>
export type AcceptNoEmailInviteInput = z.infer<typeof acceptNoEmailInviteSchema>
