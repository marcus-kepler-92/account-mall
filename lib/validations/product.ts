import { z } from "zod";

// Slug format: lowercase alphanumeric with hyphens
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createProductSchema = z.object({
    name: z.string().min(1, "Name is required").max(200, "Name is too long"),
    slug: z
        .string()
        .min(1, "Slug is required")
        .max(200)
        .regex(slugRegex, "Slug must be lowercase alphanumeric with hyphens"),
    description: z.string().max(5000).optional(),
    image: z.string().nullable().optional(),
    price: z.number().positive("Price must be positive"),
    maxQuantity: z.number().int().min(1, "Must be at least 1").max(1000).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    tagIds: z.array(z.string()).optional(),
});

export const updateProductSchema = z.object({
    name: z.string().min(1, "Name is required").max(200).optional(),
    slug: z
        .string()
        .min(1)
        .max(200)
        .regex(slugRegex, "Slug must be lowercase alphanumeric with hyphens")
        .optional(),
    description: z.string().max(5000).nullable().optional(),
    image: z.string().nullable().optional(),
    price: z.number().positive("Price must be positive").optional(),
    maxQuantity: z.number().int().min(1).max(1000).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    tagIds: z.array(z.string()).optional(),
});

export const createTagSchema = z.object({
    name: z.string().min(1, "Tag name is required").max(50, "Tag name is too long"),
});

// Form schema for product form (handles string inputs from form fields)
export const productFormSchema = z.object({
    name: z.string().min(1, "请输入商品名称").max(200, "商品名称过长"),
    slug: z
        .string()
        .min(1, "请输入 URL 别名")
        .max(200)
        .regex(slugRegex, "仅支持小写字母、数字和连字符"),
    description: z.string().max(5000).optional(),
    image: z.string().optional(),
    price: z.string().min(1, "请输入价格").refine(
        (v) => !Number.isNaN(parseFloat(v)) && parseFloat(v) > 0,
        "价格必须大于 0"
    ),
    maxQuantity: z.string().refine(
        (v) => v === "" || (!Number.isNaN(parseInt(v, 10)) && parseInt(v, 10) >= 1 && parseInt(v, 10) <= 1000),
        "数量必须在 1-1000 之间"
    ),
    isActive: z.boolean(),
    tagIds: z.array(z.string()).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateTagInput = z.infer<typeof createTagSchema>;
export type ProductFormSchema = z.infer<typeof productFormSchema>;
