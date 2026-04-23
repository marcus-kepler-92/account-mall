import { z } from "zod"

export const createPaymentChannelSchema = z.object({
    nickname: z.string().min(1, "请填写备注名").max(100),
    pid: z.string().min(1, "请填写商户号").max(50),
    key: z.string().min(1, "请填写密钥").max(200),
    submitUrl: z.string().url("请填写有效的接口地址"),
    siteName: z.string().min(1, "请填写站点名称").max(100),
    type: z.enum(["alipay", "wxpay", "qqpay"], { message: "请选择支付类型" }),
    annualLimit: z.coerce.number().positive("年限额必须大于 0").default(65000),
    sortOrder: z.coerce.number().int().default(0),
    isActive: z.boolean().default(true),
})

export const updatePaymentChannelSchema = createPaymentChannelSchema.partial()

export const createChannelWithdrawalSchema = z.object({
    amount: z.coerce.number().positive("金额必须大于 0"),
    note: z.string().max(500).optional(),
})

export const updateChannelWithdrawalSchema = createChannelWithdrawalSchema.partial()

export type CreatePaymentChannelInput = z.infer<typeof createPaymentChannelSchema>
export type UpdatePaymentChannelInput = z.infer<typeof updatePaymentChannelSchema>
export type CreateChannelWithdrawalInput = z.infer<typeof createChannelWithdrawalSchema>
export type UpdateChannelWithdrawalInput = z.infer<typeof updateChannelWithdrawalSchema>
