"use client"

import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MarkdownEditor } from "@/app/components/markdown-editor"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
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
        defaultValues: {
            title: announcement?.title ?? "",
            content: announcement?.content ?? "",
            status: (announcement?.status as "DRAFT" | "PUBLISHED") ?? "DRAFT",
            sortOrder: announcement?.sortOrder ?? 0,
        },
    })

    const { register, handleSubmit, formState: { errors }, setValue, watch, control } = form
    const status = watch("status")

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

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>公告内容</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="title">
                                标题 <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="title"
                                {...register("title")}
                                placeholder="例如：系统维护通知"
                            />
                            {errors.title && (
                                <p className="text-sm text-destructive">{errors.title.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>正文（选填）</Label>
                            <p className="text-sm text-muted-foreground">支持 Markdown 语法：**加粗**、*斜体*、列表、链接等</p>
                            <Controller
                                name="content"
                                control={control}
                                render={({ field }) => (
                                    <MarkdownEditor
                                        value={field.value ?? ""}
                                        onChange={field.onChange}
                                        placeholder="输入公告内容，支持 Markdown…"
                                        height={460}
                                    />
                                )}
                            />
                            {errors.content && (
                                <p className="text-sm text-destructive">{errors.content.message}</p>
                            )}
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>状态</Label>
                                <Select
                                    value={status}
                                    onValueChange={(v) => setValue("status", v as "DRAFT" | "PUBLISHED")}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="DRAFT">草稿</SelectItem>
                                        <SelectItem value="PUBLISHED">已发布</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    仅「已发布」的公告会在前台展示
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sortOrder">排序</Label>
                                <Input
                                    id="sortOrder"
                                    type="number"
                                    {...register("sortOrder", { valueAsNumber: true })}
                                />
                                {errors.sortOrder && (
                                    <p className="text-sm text-destructive">{errors.sortOrder.message}</p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    数值越大越靠前
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex gap-4">
                    <Button type="submit">
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
        </div>
    )
}
