import { z } from "zod";

// Slug format: lowercase alphanumeric with hyphens
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const productTypeEnum = z.enum(["NORMAL", "FREE_SHARED"]);

export const createProductSchema = z.object({
    name: z.string().min(1, "Name is required").max(200, "Name is too long"),
    slug: z
        .string()
        .min(1, "Slug is required")
        .max(200)
        .regex(slugRegex, "Slug must be lowercase alphanumeric with hyphens"),
    description: z.string().max(5000).optional(),
    summary: z.string().max(300, "商品简介最多 300 字").nullable().optional(),
    image: z.string().nullable().optional(),
    price: z.number().min(0, "Price must be non-negative"),
    maxQuantity: z.number().int().min(1, "Must be at least 1").max(1000).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    productType: productTypeEnum.optional(),
    sourceUrl: z.string().url().optional().nullable().or(z.literal("")),
    secretCode: z.string().max(64).nullable().optional(),
    tagIds: z.array(z.string()).optional(),
}).refine(
    (data) => data.productType !== "FREE_SHARED" || data.price === 0,
    { message: "Free shared product must have price 0", path: ["price"] }
);

export const updateProductSchema = z.object({
    name: z.string().min(1, "Name is required").max(200).optional(),
    slug: z
        .string()
        .min(1)
        .max(200)
        .regex(slugRegex, "Slug must be lowercase alphanumeric with hyphens")
        .optional(),
    description: z.string().max(5000).nullable().optional(),
    summary: z.string().max(300, "商品简介最多 300 字").nullable().optional(),
    image: z.string().nullable().optional(),
    price: z.number().min(0, "Price must be non-negative").optional(),
    maxQuantity: z.number().int().min(1).max(1000).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    productType: productTypeEnum.optional(),
    sourceUrl: z.string().url().optional().nullable().or(z.literal("")),
    secretCode: z.string().max(64).nullable().optional(),
    tagIds: z.array(z.string()).optional(),
    pinned: z.boolean().optional(),
}).refine(
    (data) => data.productType !== "FREE_SHARED" || (data.price === undefined || data.price === 0),
    { message: "Free shared product must have price 0", path: ["price"] }
);

export const createTagSchema = z.object({
    name: z.string().min(1, "Tag name is required").max(50, "Tag name is too long"),
});

// Form schema for product form (handles string inputs from form fields)
// 免费共享时 price/maxQuantity/sourceUrl 由环境变量提供，表单可不填
export const productFormSchema = z
    .object({
        name: z.string().min(1, "请输入商品名称").max(200, "商品名称过长"),
        slug: z
            .string()
            .min(1, "请输入 URL 别名")
            .max(200)
            .regex(slugRegex, "仅支持小写字母、数字和连字符"),
        description: z.string().max(5000).optional(),
        summary: z.string().max(300, "商品简介最多 300 字").optional(),
        image: z.string().optional(),
        price: z.string().refine(
            (v) => v === "" || (!Number.isNaN(parseFloat(v)) && parseFloat(v) >= 0),
            "价格不能为负数"
        ),
        maxQuantity: z.string().refine(
            (v) => v === "" || (!Number.isNaN(parseInt(v, 10)) && parseInt(v, 10) >= 1 && parseInt(v, 10) <= 1000),
            "数量必须在 1-1000 之间"
        ),
        isActive: z.boolean(),
        productType: z.enum(["NORMAL", "FREE_SHARED"]).optional(),
        sourceUrl: z.string().optional(),
        secretCode: z.string().max(64).optional(),
        tagIds: z.array(z.string()).optional(),
    })
    .superRefine((data, ctx) => {
        if (data.productType !== "FREE_SHARED") {
            if (!data.price || data.price === "")
                ctx.addIssue({ code: "custom", message: "请输入价格", path: ["price"] })
            else if (Number.isNaN(parseFloat(data.price)) || parseFloat(data.price) < 0)
                ctx.addIssue({ code: "custom", message: "价格不能为负数", path: ["price"] })
            else if (parseFloat(data.price) <= 0)
                ctx.addIssue({ code: "custom", message: "价格必须大于 0", path: ["price"] })
        }
    });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateTagInput = z.infer<typeof createTagSchema>;
export type ProductFormSchema = z.infer<typeof productFormSchema>;
