"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { MarkdownEditor } from "@/app/components/markdown-editor"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { applyFieldErrors } from "@/lib/form-utils"
import { ArrowLeft, Loader2 } from "lucide-react"

const guideFormSchema = z.object({
    title: z.string().min(1, "标题不能为空").max(200, "标题过长"),
    content: z.string().max(50000).nullable().optional(),
    tagId: z.string().optional().nullable(),
    status: z.enum(["DRAFT", "PUBLISHED"]),
    sortOrder: z.number().int().min(-1000).max(10000),
})

type GuideFormSchema = z.infer<typeof guideFormSchema>

export type GuideFormData = {
    id: string
    title: string
    content: string | null
    tagId: string | null
    status: string
    sortOrder: number
    publishedAt: string | null
    createdAt: string
    updatedAt: string
}

export type TagOption = {
    id: string
    name: string
    slug: string
}

type GuideFormProps = {
    guide?: GuideFormData
    tags: TagOption[]
}

export function GuideForm({ guide, tags }: GuideFormProps) {
    const router = useRouter()
    const isEditing = !!guide

    const form = useForm<GuideFormSchema>({
        resolver: zodResolver(guideFormSchema),
        mode: "onTouched",
        defaultValues: {
            title: guide?.title ?? "",
            content: guide?.content ?? "",
            tagId: guide?.tagId ?? null,
            status: (guide?.status as "DRAFT" | "PUBLISHED") ?? "DRAFT",
            sortOrder: guide?.sortOrder ?? 0,
        },
    })

    const onSubmit = async (data: GuideFormSchema) => {
        try {
            const body = {
                title: data.title,
                content: data.content && data.content.trim() ? data.content.trim() : null,
                tagId: data.tagId && data.tagId !== "" ? data.tagId : null,
                status: data.status,
                sortOrder: data.sortOrder,
            }
            const url = isEditing
                ? `/api/admin/guides/${guide.id}`
                : "/api/admin/guides"
            const method = isEditing ? "PATCH" : "POST"
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })

            if (!res.ok) {
                const json = await res.json().catch(() => ({}))
                applyFieldErrors(json, form.setError)
                toast.error(json?.error ?? (isEditing ? "更新失败" : "创建失败"))
                return
            }

            toast.success(isEditing ? "指南已更新" : "指南已创建")
            router.push("/admin/guides")
            router.refresh()
        } catch {
            toast.error("发生未知错误")
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin/guides">
                        <ArrowLeft className="size-4" />
                    </Link>
                </Button>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">
                        {isEditing ? "编辑指南" : "新建指南"}
                    </h2>
                    <p className="text-muted-foreground">
                        {isEditing ? "更新指南内容与状态" : "创建分销员入门手册，支持 Markdown，代码块内容可被分销员一键复制"}
                    </p>
                </div>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>指南内容</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FormField
                                control={form.control}
                                name="title"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            标题 <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <Input placeholder="例如：Apple ID 销售指南" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="tagId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>关联类目</FormLabel>
                                        <Select
                                            value={field.value ?? ""}
                                            onValueChange={(v) => field.onChange(v === "" ? null : v)}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="不关联类目" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="">不关联类目</SelectItem>
                                                {tags.map((t) => (
                                                    <SelectItem key={t.id} value={t.id}>
                                                        {t.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormDescription>可选，关联后分销员可按类目筛选</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="content"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>正文（选填）</FormLabel>
                                        <FormControl>
                                            <MarkdownEditor
                                                value={field.value ?? ""}
                                                onChange={field.onChange}
                                                placeholder="输入指南内容，支持 Markdown。将需要分销员复制的话术、描述等放在代码块（```）中，分销员端会自动显示复制按钮。"
                                                height={460}
                                                imageUpload={{ pathPrefix: "guides" }}
                                            />
                                        </FormControl>
                                        <FormDescription>支持 Markdown 语法；代码块内容可被分销员一键复制</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="status"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>状态</FormLabel>
                                            <Select
                                                value={field.value}
                                                onValueChange={field.onChange}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="DRAFT">草稿</SelectItem>
                                                    <SelectItem value="PUBLISHED">已发布</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormDescription>仅「已发布」的指南会在分销员端展示</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="sortOrder"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>排序</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    value={field.value ?? ""}
                                                    onChange={(e) => {
                                                        const v = e.target.valueAsNumber
                                                        field.onChange(Number.isNaN(v) ? 0 : v)
                                                    }}
                                                />
                                            </FormControl>
                                            <FormDescription>数值越大越靠前</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex gap-4">
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting && (
                                <Loader2 className="size-4 animate-spin" />
                            )}
                            {isEditing ? "保存" : "创建"}
                        </Button>
                        <Button type="button" variant="outline" asChild>
                            <Link href="/admin/guides">取消</Link>
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    )
}
