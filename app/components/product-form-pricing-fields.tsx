"use client"

import { useFormContext } from "react-hook-form"
import { Input } from "@/components/ui/input"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { ProductFormSchema } from "@/lib/validations/product"

export function ProductFormPricingFields({ isFreeShared }: { isFreeShared: boolean }) {
    const { control, setValue } = useFormContext<ProductFormSchema>()

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>价格与限制</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormField
                        control={control}
                        name="productType"
                        render={({ field }) => (
                            <FormItem className="space-y-2">
                                <FormLabel>商品类型</FormLabel>
                                <FormControl>
                                    <RadioGroup
                                        value={field.value}
                                        onValueChange={(value) => {
                                            field.onChange(value)
                                            if (value === "FREE_SHARED") {
                                                setValue("price", "0")
                                                setValue("maxQuantity", "1")
                                                setValue("sourceUrl", "")
                                            }
                                        }}
                                        className="flex gap-4"
                                    >
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <RadioGroupItem value="NORMAL" />
                                            <span className="text-sm">普通商品</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <RadioGroupItem value="FREE_SHARED" />
                                            <span className="text-sm">免费共享</span>
                                        </label>
                                    </RadioGroup>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {!isFreeShared && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                                control={control}
                                name="price"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            价格 (¥) <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0.01"
                                                placeholder="0.00"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={control}
                                name="maxQuantity"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>单笔最大购买数量</FormLabel>
                                        <FormControl>
                                            <Input type="number" min={1} max={1000} {...field} />
                                        </FormControl>
                                        <FormDescription>单笔订单最多可购买的数量</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

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
                                        height={480}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </CardContent>
            </Card>
        </>
    )
}
