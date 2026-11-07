"use client"

import { useFormContext, useWatch } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import type { ArticleFormValues } from "./article-form"

export function ArticleFormSeoCard() {
    const { control } = useFormContext<ArticleFormValues>()
    const seoTitle = useWatch({ control, name: "seoTitle" })
    const seoDescription = useWatch({ control, name: "seoDescription" })

    return (
        <Card>
            <CardHeader>
                <CardTitle>搜索引擎优化（SEO）</CardTitle>
                <CardDescription>都可以不填：标题默认用文章标题，描述默认用摘要</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <FormField
                    control={control}
                    name="seoTitle"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>SEO 标题</FormLabel>
                            <FormControl>
                                <Input placeholder="例如：外区Apple ID怎么选？美区/港区/日区/台区对比" {...field} />
                            </FormControl>
                            <FormDescription>
                                主关键词放最前面，末尾会自动加站名。{seoTitle.length}/60
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={control}
                    name="seoDescription"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>SEO 描述</FormLabel>
                            <FormControl>
                                <Textarea rows={3} {...field} />
                            </FormControl>
                            <FormDescription>
                                搜索结果里标题下面那段话，直接回答问题效果最好。{seoDescription.length}/160
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </CardContent>
        </Card>
    )
}
