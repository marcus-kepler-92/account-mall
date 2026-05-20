"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import * as z from "zod"
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
import { applyFieldErrors } from "@/lib/form-utils"
import { ArrowLeft, Loader2 } from "lucide-react"
import type { KnowledgeRow } from "./knowledge-columns"

const formSchema = z.object({
    title: z.string().min(1, "标题不能为空").max(100, "标题过长"),
    content: z.string().min(1, "内容不能为空").max(10_000, "内容过长"),
    tagsInput: z.string().max(500),
})

type FormSchema = z.infer<typeof formSchema>

type KnowledgeFormProps = {
    id?: string
    initial?: KnowledgeRow
}

function arrayToInput(tags: string[] | undefined): string {
    return (tags ?? []).join(", ")
}

function inputToArray(input: string): string[] {
    return input
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
}

export function KnowledgeForm({ id, initial }: KnowledgeFormProps) {
    const router = useRouter()
    const isEditing = !!id

    const form = useForm<FormSchema>({
        resolver: zodResolver(formSchema),
        mode: "onTouched",
        defaultValues: {
            title: initial?.title ?? "",
            content: initial?.content ?? "",
            tagsInput: arrayToInput(initial?.tags),
        },
    })

    const onSubmit = async (data: FormSchema) => {
        try {
            const body = {
                title: data.title,
                content: data.content,
                tags: inputToArray(data.tagsInput),
            }
            const url = isEditing
                ? `/api/admin/agent/knowledge/${id}`
                : "/api/admin/agent/knowledge"
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

            toast.success(isEditing ? "知识条目已更新" : "知识条目已创建")
            router.push("/admin/agent/knowledge")
            router.refresh()
        } catch {
            toast.error("发生未知错误")
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin/agent/knowledge">
                        <ArrowLeft className="size-4" />
                    </Link>
                </Button>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">
                        {isEditing ? "编辑知识条目" : "新建知识条目"}
                    </h2>
                    <p className="text-muted-foreground">
                        {isEditing ? "更新平台规则与知识条目" : "为客服 Agent 添加可检索的知识"}
                    </p>
                </div>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>知识内容</CardTitle>
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
                                            <Input
                                                placeholder="例如：如何使用卡密"
                                                {...field}
                                            />
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
                                        <FormLabel>
                                            正文 <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <MarkdownEditor
                                                value={field.value ?? ""}
                                                onChange={field.onChange}
                                                placeholder="输入知识内容，支持 Markdown…"
                                                height={360}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            支持 Markdown 语法；建议清晰、聚焦单一主题以便检索
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="tagsInput"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>标签</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="使用,逗号,分隔"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            最多 10 个，每个 30 字以内
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting && (
                                <Loader2 className="size-4 animate-spin" />
                            )}
                            {isEditing ? "保存" : "创建"}
                        </Button>
                        <Button type="button" variant="outline" asChild>
                            <Link href="/admin/agent/knowledge">取消</Link>
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    )
}
