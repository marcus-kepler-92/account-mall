import * as z from "zod"

export const distributorInviteSchema = z.object({
    email: z
        .string()
        .email("请输入有效的邮箱地址")
        .transform((v) => v.toLowerCase().trim()),
})

export const acceptInviteSchema = z.object({
    token: z.string().min(1, "邀请 token 不能为空"),
    password: z.string().min(6, "密码至少 6 位").max(128, "密码不能超过 128 位"),
})

export type DistributorInviteInput = z.infer<typeof distributorInviteSchema>
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>
