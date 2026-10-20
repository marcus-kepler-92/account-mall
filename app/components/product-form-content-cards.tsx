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
import { MarkdownEditor } from "@/app/components/markdown-editor"
import type { ProductFormSchema } from "@/lib/validations/product"

/**
 * Renders the "content" Cards (商品简介 + 商品描述 + 搜索引擎优化) for the product form.
 *
 * Split out of product-form-pricing-fields so that the SKU 管理 Card can sit
 * visually adjacent to the 价格与限制 Card without the markdown editor wedging
 * itself in between.
 */
export function ProductFormContentCards() {
    const { control } = useFormContext<ProductFormSchema>()

    return (
        <>
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>商品简介</CardTitle>
                    <p className="text-sm font-normal text-muted-foreground">
                        用于首页商品卡片下方展示，建议 1～2 句；留空则使用商品描述前 80 字
                    </p>
                </CardHeader>
                <CardContent className="space-y-2">
                    <FormField
                        control={control}
                        name="summary"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <Input
                                        placeholder="简短介绍商品，最多 300 字"
                                        className="w-full"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </CardContent>
            </Card>

            <Card className="w-full">
                <CardHeader>
                    <CardTitle>商品描述</CardTitle>
                    <p className="text-sm font-normal text-muted-foreground">
                        支持 Markdown，用于商品详情页展示
                    </p>
                </CardHeader>
                <CardContent>
                    <FormField
                        control={control}
                        name="description"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <MarkdownEditor
                                        value={field.value ?? ""}
                                        onChange={field.onChange}
                                        placeholder="描述你的商品，支持 Markdown…"
                                        height={320}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </CardContent>
            </Card>

            <Card className="w-full">
                <CardHeader>
                    <CardTitle>搜索引擎优化（SEO）</CardTitle>
                    <p className="text-sm font-normal text-muted-foreground">
                        仅影响搜索结果与分享卡片，不改变页面展示；留空则使用商品名称与简介
                    </p>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormField
                        control={control}
                        name="seoTitle"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>SEO 标题</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="如：美区Apple ID购买（独享）- 美国苹果账号"
                                        className="w-full"
                                        {...field}
                                    />
                                </FormControl>
                                <FormDescription>
                                    用户搜索的词放最前面，建议 30 字以内（{field.value?.length ?? 0}/60）；站点名会自动追加在末尾
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
                                    <Textarea
                                        placeholder="一两句话说清卖什么、有什么保障、怎么发货"
                                        rows={3}
                                        {...field}
                                    />
                                </FormControl>
                                <FormDescription>
                                    建议 70～110 字，内容须与页面一致（{field.value?.length ?? 0}/160）
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </CardContent>
            </Card>
        </>
    )
}
