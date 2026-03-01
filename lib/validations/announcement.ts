import { z } from "zod";

export const createAnnouncementSchema = z.object({
    title: z.string().min(1, "标题不能为空").max(200, "标题过长"),
    content: z.string().max(10000).nullable().optional(), // Markdown
    status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
    sortOrder: z.number().int().min(-1000).max(10000).optional(),
});

export const updateAnnouncementSchema = z.object({
    title: z.string().min(1, "标题不能为空").max(200, "标题过长").optional(),
    content: z.string().max(10000).nullable().optional(), // Markdown
    status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
    sortOrder: z.number().int().min(-1000).max(10000).optional(),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
