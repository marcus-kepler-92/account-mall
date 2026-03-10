import * as z from "zod"

export const createGuideSchema = z.object({
    title: z.string().min(1, "标题不能为空").max(200, "标题过长"),
    content: z.string().max(50000).nullable().optional(),
    tagId: z.string().min(1).optional().nullable(),
    status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
    sortOrder: z.number().int().min(-1000).max(10000).optional(),
})

export const updateGuideSchema = z.object({
    title: z.string().min(1, "标题不能为空").max(200, "标题过长").optional(),
    content: z.string().max(50000).nullable().optional(),
    tagId: z.string().min(1).optional().nullable(),
    status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
    sortOrder: z.number().int().min(-1000).max(10000).optional(),
})

export type CreateGuideInput = z.infer<typeof createGuideSchema>
export type UpdateGuideInput = z.infer<typeof updateGuideSchema>
