import { z } from "zod"
import { parseTemplate } from "@/lib/card-format"

export const cardFormatSchema = z.object({
  name: z.string().min(1, "格式名称不能为空").max(50, "格式名称不超过 50 字符"),
  template: z
    .string()
    .min(1, "格式模板不能为空")
    .refine((val) => parseTemplate(val) !== null, {
      message: "模板至少包含两个 {字段名}，且字段之间需有分隔符",
    }),
})

export type CardFormatInput = z.infer<typeof cardFormatSchema>
