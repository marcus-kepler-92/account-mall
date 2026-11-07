"use client"

import { useFormContext } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { MarkdownEditor } from "@/app/components/markdown-editor"
import type { ArticleFormValues } from "./article-form"

export function ArticleFormContentCard() {
    const { control } = useFormContext<ArticleFormValues>()

    return (
        <Card>
            <CardHeader>
                <CardTitle>文章内容</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <FormField
                    control={control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>
                                标题 <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                                <Input placeholder="例如：外区Apple ID怎么选？美区、港区、日区、台区用途对比" {...field} />
                            </FormControl>
                            <FormDescription>页面 H1，建议直接写成用户会搜的问题</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={control}
                    name="slug"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>
                                网址 <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                                <div className="flex items-center rounded-md border focus-within:ring-2 focus-within:ring-ring">
                                    <span className="pl-3 text-sm text-muted-foreground shrink-0">/guides/</span>
                                    <Input
                                        className="border-0 shadow-none focus-visible:ring-0 pl-1"
                                        placeholder="which-region-apple-id"
                                        {...field}
                                    />
                                </div>
                            </FormControl>
                            <FormDescription>
                                小写英文 + 连字符。发布后尽量不要再改，改了旧链接会失效
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={control}
                    name="summary"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>摘要</FormLabel>
                            <FormControl>
                                <Textarea rows={2} placeholder="一两句话说明这篇文章解决什么问题" {...field} />
                            </FormControl>
                            <FormDescription>显示在教程列表；没填 SEO 描述时也用作搜索结果摘要</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={control}
                    name="content"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>正文</FormLabel>
                            <FormControl>
                                <MarkdownEditor
                                    value={field.value}
                                    onChange={field.onChange}
                                    placeholder="支持 Markdown。用 ## 二级标题分段；链接到商品请写站内地址，如 [美区Apple ID](/products/apple-id-us)"
                                    height={480}
                                    imageUpload={{ pathPrefix: "articles" }}
                                />
                            </FormControl>
                            <FormDescription>
                                正文里的 # 一级标题会自动降为二级标题（页面只保留一个 H1）
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={control}
                    name="status"
                    render={({ field }) => (
                        <FormItem className="sm:max-w-xs">
                            <FormLabel>状态</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
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
                            <FormDescription>只有「已发布」的文章会公开并进入 sitemap</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </CardContent>
        </Card>
    )
}
