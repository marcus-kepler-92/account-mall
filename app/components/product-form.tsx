"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import { generateSlug } from "@/lib/utils"
import { applyFieldErrors } from "@/lib/form-utils"
import { productFormSchema, type ProductFormSchema } from "@/lib/validations/product"
import { Loader2, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { ProductFormBasicFields } from "./product-form-basic-fields"
import { ProductFormPricingFields } from "./product-form-pricing-fields"
import { ProductFormTagSelect } from "./product-form-tag-select"
import { ProductFormSettings } from "./product-form-settings"

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
    productType?: "NORMAL" | "FREE_SHARED"
    sourceUrl?: string | null
    tags: Tag[]
}

export function ProductForm({
    product,
    allTags,
}: {
    product?: ProductData
    allTags: Tag[]
}) {
    const router = useRouter()
    const isEditing = !!product
    const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)

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
            sourceUrl: product?.sourceUrl ?? "",
            tagIds: product?.tags.map((t) => t.id) ?? [],
        },
    })

    const { handleSubmit, watch, setValue } = form
    const name = watch("name")
    const productType = watch("productType") ?? "NORMAL"
    const isFreeShared = productType === "FREE_SHARED"

    useEffect(() => {
        if (!slugManuallyEdited && !isEditing) {
            setValue("slug", generateSlug(name))
        }
    }, [name, slugManuallyEdited, isEditing, setValue])

    const onSubmit = async (data: ProductFormSchema) => {
        const body = {
            name: data.name.trim(),
            slug: data.slug.trim(),
            description: data.description?.trim() || undefined,
            summary: data.summary?.trim() || null,
            image: data.image || null,
            price: isFreeShared ? 0 : (data.price === "" ? undefined : parseFloat(data.price)),
            maxQuantity: isFreeShared ? 1 : (data.maxQuantity === "" ? 10 : parseInt(data.maxQuantity, 10)),
            status: data.isActive ? "ACTIVE" : "INACTIVE",
            productType: data.productType ?? "NORMAL",
            sourceUrl: isFreeShared ? null : (data.sourceUrl?.trim() || null),
            tagIds: data.tagIds ?? [],
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
                        <div className="lg:col-span-2 space-y-6">
                            <ProductFormBasicFields
                                isEditing={isEditing}
                                onSlugManualEdit={() => setSlugManuallyEdited(true)}
                            />
                            <ProductFormPricingFields isFreeShared={isFreeShared} />
                        </div>

                        <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
                            <ProductFormSettings />
                            <ProductFormTagSelect initialTags={allTags} />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
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
