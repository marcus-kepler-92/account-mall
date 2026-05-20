import { z } from "zod"

export const knowledgeSchema = z.object({
    title: z.string().min(1, "标题不能为空").max(100, "标题过长"),
    content: z.string().min(1, "内容不能为空").max(10_000, "内容过长"),
    tags: z.array(z.string().min(1).max(30)).max(10, "标签最多 10 个"),
})

export const knowledgePatchSchema = knowledgeSchema.partial().extend({
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
})

export type KnowledgeInput = z.infer<typeof knowledgeSchema>
export type KnowledgePatchInput = z.infer<typeof knowledgePatchSchema>
