import * as z from "zod";
import { variantCreateSchema } from "@/lib/domains/variants/validators";

// Slug format: lowercase alphanumeric with hyphens
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const productTypeEnum = z.enum(["NORMAL", "AUTO_FETCH", "MANUAL"]);

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
    costPerUnit: z.number().min(0, "采购成本不能为负").nullable().optional(),
    maxQuantity: z.number().int().min(1, "Must be at least 1").max(1000).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    productType: productTypeEnum.optional(),
    sourceUrl: z
        .string()
        .optional()
        .nullable()
        .or(z.literal(""))
        .refine(
            (val) => {
                if (!val || val === "") return true
                return val.split(",").every((u) => { try { new URL(u.trim()); return true } catch { return false } })
            },
            { message: "来源 URL 格式不正确" }
        ),
    validityHours: z.number().int().min(1).max(8760).optional().nullable(),
    allowAccountSwitch: z.boolean().optional(),
    accountSwitchLimit: z.number().int().min(1).max(100).optional(),
    tagIds: z.array(z.string()).optional(),
    cardTemplateIds: z.array(z.string()).optional(),
    couponEnabled: z.boolean().optional(),
    riskWarningEnabled: z.boolean().optional(),
    riskWarningTitle: z.string().max(100).nullish(),
    riskWarningContent: z.string().max(10000).nullish(),
    riskWarningCountdown: z.number().int().min(5).max(60).nullish(),
    riskWarningConfirmText: z.string().max(50).nullish(),
    purchaseLimitEnabled: z.boolean().optional(),
    purchaseLimitQuantity: z.number().int().min(1).optional(),
    excludeFromAttribution: z.boolean().optional(),
    /**
     * MANUAL-only: SKUs to atomically create together with the product.
     * Ignored for NORMAL/AUTO_FETCH; the route handler additionally rejects
     * non-empty arrays for those types to surface mistakes early.
     */
    variants: z.array(variantCreateSchema).optional(),
}).refine(
    (data) => data.productType !== "AUTO_FETCH" || (data.sourceUrl && data.sourceUrl !== ""),
    { message: "Auto-fetch product must have a source URL", path: ["sourceUrl"] }
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
    costPerUnit: z.number().min(0, "采购成本不能为负").nullable().optional(),
    maxQuantity: z.number().int().min(1).max(1000).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    productType: productTypeEnum.optional(),
    sourceUrl: z
        .string()
        .optional()
        .nullable()
        .or(z.literal(""))
        .refine(
            (val) => {
                if (!val || val === "") return true
                return val.split(",").every((u) => { try { new URL(u.trim()); return true } catch { return false } })
            },
            { message: "来源 URL 格式不正确" }
        ),
    validityHours: z.number().int().min(1).max(8760).optional().nullable(),
    allowAccountSwitch: z.boolean().optional(),
    accountSwitchLimit: z.number().int().min(1).max(100).optional(),
    tagIds: z.array(z.string()).optional(),
    cardTemplateIds: z.array(z.string()).optional(),
    couponEnabled: z.boolean().optional(),
    riskWarningEnabled: z.boolean().optional(),
    riskWarningTitle: z.string().max(100).nullish(),
    riskWarningContent: z.string().max(10000).nullish(),
    riskWarningCountdown: z.number().int().min(5).max(60).nullish(),
    riskWarningConfirmText: z.string().max(50).nullish(),
    purchaseLimitEnabled: z.boolean().optional(),
    purchaseLimitQuantity: z.number().int().min(1).optional(),
    excludeFromAttribution: z.boolean().optional(),
});

export const createTagSchema = z.object({
    name: z.string().min(1, "Tag name is required").max(50, "Tag name is too long"),
    slug: z
        .string()
        .min(1, "请输入标识符")
        .max(100)
        .regex(slugRegex, "仅支持小写字母、数字和连字符"),
});

// Form schema for product form (handles string inputs from form fields)
// AUTO_FETCH 时 sourceUrl/voidloginsCode+voidloginsPassword 必填，price/maxQuantity 由表单设置
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
        costPerUnit: z.number().min(0, "采购成本不能为负").nullable().optional(),
        maxQuantity: z.string().refine(
            (v) => v === "" || (!Number.isNaN(parseInt(v, 10)) && parseInt(v, 10) >= 1 && parseInt(v, 10) <= 1000),
            "数量必须在 1-1000 之间"
        ),
        isActive: z.boolean(),
        productType: z.enum(["NORMAL", "AUTO_FETCH", "MANUAL"]).optional(),
        /** Sub-type for AUTO_FETCH: HTML scraping vs voidlogins API */
        autoFetchType: z.enum(["scrape", "voidlogins"]).optional(),
        sourceUrl: z.string().optional(),
        /** Voidlogins access code (AUTO_FETCH + voidlogins type only) */
        voidloginsCode: z.string().optional(),
        /** Voidlogins access password (AUTO_FETCH + voidlogins type only) */
        voidloginsPassword: z.string().optional(),
        validityHours: z.string().optional(),
        allowAccountSwitch: z.boolean().optional(),
        accountSwitchLimit: z.string().optional(),
        tagIds: z.array(z.string()).optional(),
        cardTemplateIds: z.array(z.string()).optional(),
        couponEnabled: z.boolean().optional(),
        riskWarningEnabled: z.boolean().optional(),
        riskWarningTitle: z.string().max(100).optional(),
        riskWarningContent: z.string().max(10000).optional(),
        riskWarningCountdown: z.string().optional(),
        riskWarningConfirmText: z.string().max(50).optional(),
        purchaseLimitEnabled: z.boolean().optional(),
        purchaseLimitQuantity: z.string().optional(),
        excludeFromAttribution: z.boolean().optional(),
        /**
         * MANUAL-only: SKU rows authored inline on the create form. Fields
         * stay as strings here for Input compatibility — the submit handler
         * converts them to numbers before POSTing.
         */
        variants: z
            .array(
                z.object({
                    id: z.string().optional(),
                    name: z.string(),
                    price: z.string(),
                    unitCost: z.string(),
                    stockQuantity: z.string(),
                    sortOrder: z.string(),
                    isActive: z.boolean(),
                    _localId: z.string().optional(),
                }),
            )
            .optional(),
    })
    .superRefine((data, ctx) => {
        if (data.productType === "AUTO_FETCH") {
            const fetchType = data.autoFetchType ?? "scrape"
            if (fetchType === "voidlogins") {
                if (!data.voidloginsCode?.trim())
                    ctx.addIssue({ code: "custom", message: "请填写分享页代码", path: ["voidloginsCode"] })
                // voidloginsPassword is optional
            } else {
                if (!data.sourceUrl || data.sourceUrl.trim() === "")
                    ctx.addIssue({ code: "custom", message: "AUTO_FETCH 商品必须填写来源 URL", path: ["sourceUrl"] })
            }
        } else if (data.productType === "MANUAL") {
            // MANUAL products derive price from SKU variants. Require at least
            // one validly-filled row before submit so the create POST atomically
            // delivers a usable product (price/stock both live on variants).
            const rows = data.variants ?? []
            const valid = rows.filter((r) => {
                if (!r.name?.trim()) return false
                const p = parseFloat(r.price)
                return r.price !== "" && !Number.isNaN(p) && p >= 0
            })
            if (valid.length === 0) {
                ctx.addIssue({
                    code: "custom",
                    message: "请至少新增一个 SKU（填写名称和售价）",
                    path: ["variants"],
                })
            }
        } else {
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
