import * as z from "zod"

/** Lowercase ASCII words joined by single hyphens, e.g. `us-apple-id-guide`. */
export const ARTICLE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const slug = z
    .string()
    .trim()
    .min(1, "网址不能为空")
    .max(100, "网址最多 100 个字符")
    .regex(ARTICLE_SLUG_PATTERN, "只能用小写英文字母、数字和连字符，如 us-apple-id-guide")

// Optional text: "" and whitespace-only are stored as null.
const optionalText = (max: number, message: string) =>
    z
        .string()
        .max(max, message)
        .nullable()
        .optional()
        .transform((v) => (v == null ? v : v.trim() || null))

const articleFields = {
    title: z.string().trim().min(1, "标题不能为空").max(200, "标题最多 200 字"),
    slug,
    seoTitle: optionalText(60, "SEO 标题最多 60 字"),
    seoDescription: optionalText(160, "SEO 描述最多 160 字"),
    summary: optionalText(300, "摘要最多 300 字"),
    content: optionalText(100000, "正文过长"),
    status: z.enum(["DRAFT", "PUBLISHED"]),
    productIds: z.array(z.string().min(1)).max(20, "最多关联 20 个商品"),
}

export const createArticleSchema = z.object({
    ...articleFields,
    status: articleFields.status.optional(),
    productIds: articleFields.productIds.optional(),
})

export const updateArticleSchema = z.object(articleFields).partial()

export type CreateArticleInput = z.infer<typeof createArticleSchema>
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>
