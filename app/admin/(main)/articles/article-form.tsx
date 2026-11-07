"use client"

import { useRouter } from "next/navigation"
import { FormProvider, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import Link from "next/link"
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { applyFieldErrors } from "@/lib/form-utils"
import { ARTICLE_SLUG_PATTERN } from "@/lib/validations/article"
import { ArticleFormContentCard } from "./article-form-content-card"
import { ArticleFormSeoCard } from "./article-form-seo-card"
import {
    ArticleFormProductsCard,
    type ArticleProductOption,
} from "./article-form-products-card"

// Client-side mirror of lib/validations/article.ts (that schema trims and
// null-coalesces on the server; the form keeps plain strings for inputs).
const articleFormSchema = z.object({
    title: z.string().trim().min(1, "标题不能为空").max(200, "标题最多 200 字"),
    slug: z
        .string()
        .trim()
        .min(1, "网址不能为空")
        .max(100, "网址最多 100 个字符")
        .regex(ARTICLE_SLUG_PATTERN, "只能用小写英文字母、数字和连字符，如 us-apple-id-guide"),
    seoTitle: z.string().max(60, "SEO 标题最多 60 字"),
    seoDescription: z.string().max(160, "SEO 描述最多 160 字"),
    summary: z.string().max(300, "摘要最多 300 字"),
    content: z.string().max(100000, "正文过长"),
    status: z.enum(["DRAFT", "PUBLISHED"]),
    productIds: z.array(z.string()).max(20, "最多关联 20 个商品"),
})

export type ArticleFormValues = z.infer<typeof articleFormSchema>

export type ArticleFormData = {
    id: string
    title: string
    slug: string
    seoTitle: string | null
    seoDescription: string | null
    summary: string | null
    content: string | null
    status: "DRAFT" | "PUBLISHED"
    productIds: string[]
}

type ArticleFormProps = {
    article?: ArticleFormData
    products: ArticleProductOption[]
}

export function ArticleForm({ article, products }: ArticleFormProps) {
    const router = useRouter()
    const isEditing = !!article

    const form = useForm<ArticleFormValues>({
        resolver: zodResolver(articleFormSchema),
        mode: "onTouched",
        defaultValues: {
            title: article?.title ?? "",
            slug: article?.slug ?? "",
            seoTitle: article?.seoTitle ?? "",
            seoDescription: article?.seoDescription ?? "",
            summary: article?.summary ?? "",
            content: article?.content ?? "",
            status: article?.status ?? "DRAFT",
            productIds: article?.productIds ?? [],
        },
    })

    const onSubmit = async (data: ArticleFormValues) => {
        try {
            const url = isEditing ? `/api/admin/articles/${article.id}` : "/api/admin/articles"
            const res = await fetch(url, {
                method: isEditing ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })

            if (!res.ok) {
                const json = await res.json().catch(() => ({}))
                applyFieldErrors(json, form.setError)
                toast.error(json?.error ?? (isEditing ? "更新失败" : "创建失败"))
                return
            }

            toast.success(isEditing ? "文章已更新" : "文章已创建")
            router.push("/admin/articles")
            router.refresh()
        } catch {
            toast.error("发生未知错误")
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin/articles">
                        <ArrowLeft className="size-4" />
                    </Link>
                </Button>
                <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-bold tracking-tight">
                        {isEditing ? "编辑文章" : "新建文章"}
                    </h2>
                    <p className="text-muted-foreground">
                        已发布的文章公开展示在 /guides，并出现在关联商品页的「相关教程」中
                    </p>
                </div>
                {isEditing && article.status === "PUBLISHED" && (
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/guides/${article.slug}`} target="_blank">
                            <ExternalLink className="size-4" />
                            查看
                        </Link>
                    </Button>
                )}
            </div>

            <FormProvider {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <ArticleFormContentCard />
                    <ArticleFormSeoCard />
                    <ArticleFormProductsCard products={products} />

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
                            {isEditing ? "保存" : "创建"}
                        </Button>
                        <Button type="button" variant="outline" asChild>
                            <Link href="/admin/articles">取消</Link>
                        </Button>
                    </div>
                </form>
            </FormProvider>
        </div>
    )
}
