import * as z from "zod"

export const customerFilterSchema = z.object({
  productIds: z.array(z.string()).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})

export const distributorFilterSchema = z.object({
  level: z.enum(["all", "level1", "level2"]),
})

export const recipientPreviewSchema = z.object({
  recipientType: z.enum(["CUSTOMERS", "DISTRIBUTORS"]),
  recipientFilter: z.union([customerFilterSchema, distributorFilterSchema]),
})

export const createTemplateSchema = z.object({
  title: z.string().min(1, "模板名称不能为空"),
  description: z.string().optional(),
  defaultSubject: z.string().min(1, "默认主题不能为空"),
  unlayerDesign: z.record(z.string(), z.unknown()),
  html: z.string().min(1, "HTML 内容不能为空"),
})

export const updateTemplateSchema = createTemplateSchema.partial()

export const createCampaignSchema = z.object({
  name: z.string().min(1, "活动名称不能为空"),
  subject: z.string().min(1, "邮件主题不能为空"),
  html: z.string().min(1, "邮件内容不能为空"),
  templateId: z.string().nullable().optional(),
  recipientType: z.enum(["CUSTOMERS", "DISTRIBUTORS"]),
  recipientFilter: z.union([customerFilterSchema, distributorFilterSchema]),
})

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>
export type CustomerFilter = z.infer<typeof customerFilterSchema>
export type DistributorFilter = z.infer<typeof distributorFilterSchema>
export type RecipientPreviewInput = z.infer<typeof recipientPreviewSchema>
