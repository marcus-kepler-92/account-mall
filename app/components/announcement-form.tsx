"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
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

const announcementFormSchema = z.object({
    title: z.string().min(1, "标题不能为空").max(200, "标题过长"),
    content: z.string().max(10000).nullable().optional(), // Markdown
    status: z.enum(["DRAFT", "PUBLISHED"]),
    sortOrder: z.number().int().min(-1000).max(10000),
})

type AnnouncementFormSchema = z.infer<typeof announcementFormSchema>

export type AnnouncementFormData = {
    id: string
    title: string
    content: string | null
    status: string
    sortOrder: number
    publishedAt: string | null
    createdAt: string
    updatedAt: string
}

type AnnouncementFormProps = {
    announcement?: AnnouncementFormData
}

export function AnnouncementForm({ announcement }: AnnouncementFormProps) {
    const router = useRouter()
    const isEditing = !!announcement

    const form = useForm<AnnouncementFormSchema>({
        resolver: zodResolver(announcementFormSchema),
        mode: "onTouched",
        defaultValues: {
            title: announcement?.title ?? "",
            content: announcement?.content ?? "",
            status: (announcement?.status as "DRAFT" | "PUBLISHED") ?? "DRAFT",
            sortOrder: announcement?.sortOrder ?? 0,
        },
    })

    const onSubmit = async (data: AnnouncementFormSchema) => {
        try {
            const body = {
                title: data.title,
                content: data.content && data.content.trim() ? data.content.trim() : null,
                status: data.status,
                sortOrder: data.sortOrder,
            }
            const url = isEditing
                ? `/api/announcements/${announcement.id}`
                : "/api/announcements"
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

            toast.success(isEditing ? "公告已更新" : "公告已创建")
            router.push("/admin/announcements")
            router.refresh()
        } catch {
            toast.error("发生未知错误")
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin/announcements">
                        <ArrowLeft className="size-4" />
                    </Link>
                </Button>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">
                        {isEditing ? "编辑公告" : "新建公告"}
                    </h2>
                    <p className="text-muted-foreground">
                        {isEditing ? "更新公告内容与状态" : "创建新的站内公告"}
                    </p>
                </div>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>公告内容</CardTitle>
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
                                            <Input placeholder="例如：系统维护通知" {...field} />
                                        </FormControl>
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
                                                placeholder="输入公告内容，支持 Markdown…"
                                                height={460}
                                            />
                                        </FormControl>
                                        <FormDescription>支持 Markdown 语法：**加粗**、*斜体*、列表、链接等</FormDescription>
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
                                            <FormDescription>仅「已发布」的公告会在前台展示</FormDescription>
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
                            <Link href="/admin/announcements">取消</Link>
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    )
}
