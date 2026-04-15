"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import { generateSlug, parseVoidloginsSourceUrl, buildVoidloginsSourceUrl } from "@/lib/utils"
import { applyFieldErrors } from "@/lib/form-utils"
import { productFormSchema, type ProductFormSchema } from "@/lib/validations/product"
import { Loader2, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { ProductFormBasicFields } from "./product-form-basic-fields"
import { ProductFormPricingFields } from "./product-form-pricing-fields"
import { ProductFormTagSelect } from "./product-form-tag-select"
import { ProductFormSettings } from "./product-form-settings"
import { ProductFormRiskWarningFields } from "./product-form-risk-warning-fields"
import { ProductFormPurchaseLimitFields } from "./product-form-purchase-limit-fields"

type Tag = { id: string; name: string; slug: string }

type ProductData = {
    id: string
    name: string
    slug: string
    description: string | null
    summary: string | null
    image: string | null
    price: number
    maxQuantity: number
    status: string
    productType?: "NORMAL" | "AUTO_FETCH"
    sourceUrl?: string | null
    validityHours?: number | null
    allowAccountSwitch?: boolean
    accountSwitchLimit?: number
    couponEnabled?: boolean
    riskWarningEnabled?: boolean
    riskWarningTitle?: string | null
    riskWarningContent?: string | null
    riskWarningCountdown?: number | null
    riskWarningConfirmText?: string | null
    purchaseLimitEnabled?: boolean
    purchaseLimitQuantity?: number
    tags: Tag[]
}

export function ProductForm({
    product,
    allTags,
    sourceUrlOptions = [],
}: {
    product?: ProductData
    allTags: Tag[]
    sourceUrlOptions?: string[]
}) {
    const router = useRouter()
    const isEditing = !!product
    const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)

    const parsedVoidlogins = parseVoidloginsSourceUrl(product?.sourceUrl ?? "")

    const form = useForm<ProductFormSchema>({
        resolver: zodResolver(productFormSchema),
        mode: "onTouched",
        defaultValues: {
            name: product?.name ?? "",
            slug: product?.slug ?? "",
            description: product?.description ?? "",
            summary: product?.summary ?? "",
            image: product?.image ?? "",
            price: product ? String(product.price) : "",
            maxQuantity: product ? String(product.maxQuantity) : "10",
            isActive: product ? product.status === "ACTIVE" : true,
            productType: product?.productType ?? "NORMAL",
            autoFetchType: parsedVoidlogins ? "voidlogins" : "scrape",
            sourceUrl: parsedVoidlogins ? "" : (product?.sourceUrl ?? ""),
            voidloginsCode: parsedVoidlogins?.code ?? "",
            voidloginsPassword: parsedVoidlogins?.password ?? "",
            validityHours: product?.validityHours ? String(product.validityHours) : "",
            allowAccountSwitch: product?.allowAccountSwitch ?? true,
            accountSwitchLimit: product?.accountSwitchLimit != null ? String(product.accountSwitchLimit) : "1",
            tagIds: product?.tags.map((t) => t.id) ?? [],
            couponEnabled: product?.couponEnabled ?? false,
            riskWarningEnabled: product?.riskWarningEnabled ?? false,
            riskWarningTitle: product?.riskWarningTitle ?? "",
            riskWarningContent: product?.riskWarningContent ?? "",
            riskWarningCountdown: product?.riskWarningCountdown != null ? String(product.riskWarningCountdown) : "15",
            riskWarningConfirmText: product?.riskWarningConfirmText ?? "",
            purchaseLimitEnabled: product?.purchaseLimitEnabled ?? false,
            purchaseLimitQuantity: product?.purchaseLimitQuantity != null ? String(product.purchaseLimitQuantity) : "1",
        },
    })

    const { handleSubmit, watch, setValue } = form
    const name = watch("name")
    const productType = watch("productType") ?? "NORMAL"
    const isAutoFetch = productType === "AUTO_FETCH"

    useEffect(() => {
        if (!slugManuallyEdited && !isEditing) {
            setValue("slug", generateSlug(name))
        }
    }, [name, slugManuallyEdited, isEditing, setValue])

    const onSubmit = async (data: ProductFormSchema) => {
        let finalSourceUrl: string | null = null
        if (isAutoFetch) {
            if (data.autoFetchType === "voidlogins") {
                finalSourceUrl = buildVoidloginsSourceUrl(
                    data.voidloginsCode?.trim() ?? "",
                    data.voidloginsPassword?.trim() || undefined,
                )
            } else {
                finalSourceUrl = data.sourceUrl?.trim() || null
            }
        }

        const body = {
            name: data.name.trim(),
            slug: data.slug.trim(),
            description: data.description?.trim() || undefined,
            summary: data.summary?.trim() || null,
            image: data.image || null,
            price: data.price === "" ? (isAutoFetch ? 0 : undefined) : parseFloat(data.price),
            maxQuantity: isAutoFetch ? 1 : (data.maxQuantity === "" ? 10 : parseInt(data.maxQuantity, 10)),
            status: data.isActive ? "ACTIVE" : "INACTIVE",
            productType: data.productType ?? "NORMAL",
            sourceUrl: finalSourceUrl,
            validityHours: data.validityHours && data.validityHours !== "" ? parseInt(data.validityHours, 10) : null,
            ...(isAutoFetch && {
                allowAccountSwitch: data.allowAccountSwitch ?? true,
                accountSwitchLimit: data.accountSwitchLimit && data.accountSwitchLimit !== "" ? parseInt(data.accountSwitchLimit, 10) : 1,
            }),
            tagIds: data.tagIds ?? [],
            couponEnabled: data.couponEnabled ?? false,
            riskWarningEnabled: data.riskWarningEnabled ?? false,
            riskWarningTitle: data.riskWarningTitle?.trim() || null,
            riskWarningContent: data.riskWarningContent?.trim() || null,
            riskWarningCountdown: data.riskWarningCountdown && data.riskWarningCountdown !== "" ? parseInt(data.riskWarningCountdown, 10) : null,
            riskWarningConfirmText: data.riskWarningConfirmText?.trim() || null,
            purchaseLimitEnabled: data.purchaseLimitEnabled ?? false,
            purchaseLimitQuantity: data.purchaseLimitEnabled && data.purchaseLimitQuantity && data.purchaseLimitQuantity !== ""
                ? parseInt(data.purchaseLimitQuantity, 10)
                : 1,
        }

        try {
            const url = isEditing ? `/api/products/${product.id}` : "/api/products"
            const method = isEditing ? "PUT" : "POST"
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })
            if (!res.ok) {
                const responseData = await res.json()
                applyFieldErrors(responseData, form.setError)
                toast.error(responseData.error || "保存商品失败")
                return
            }
            toast.success(isEditing ? "商品已更新" : "商品已创建")
            router.push("/admin/products")
            router.refresh()
        } catch {
            toast.error("发生未知错误")
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin/products">
                        <ArrowLeft className="size-4" />
                    </Link>
                </Button>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">
                        {isEditing ? "编辑商品" : "新建商品"}
                    </h2>
                    <p className="text-muted-foreground">
                        {isEditing ? "更新商品信息" : "创建新的数字商品"}
                    </p>
                </div>
            </div>

            <Form {...form}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid gap-6 lg:grid-cols-3">
                        <div className="min-w-0 lg:col-span-2 space-y-6">
                            <ProductFormBasicFields
                                isEditing={isEditing}
                                onSlugManualEdit={() => setSlugManuallyEdited(true)}
                            />
                            <ProductFormPricingFields isAutoFetch={isAutoFetch} sourceUrlOptions={sourceUrlOptions} />
                            <ProductFormRiskWarningFields />
                            <ProductFormPurchaseLimitFields />
                        </div>

                        <div className="min-w-0 space-y-6 order-first lg:order-0 lg:sticky lg:top-20 lg:self-start">
                            <ProductFormSettings />
                            <ProductFormTagSelect initialTags={allTags} />
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting && (
                                <Loader2 className="size-4 animate-spin" />
                            )}
                            {isEditing ? "保存修改" : "创建商品"}
                        </Button>
                        <Button type="button" variant="outline" asChild>
                            <Link href="/admin/products">取消</Link>
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    )
}
