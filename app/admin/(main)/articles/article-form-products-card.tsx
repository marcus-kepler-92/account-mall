"use client"

import { useFormContext } from "react-hook-form"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import type { ArticleFormValues } from "./article-form"

export type ArticleProductOption = {
    id: string
    name: string
    status: "ACTIVE" | "INACTIVE"
}

export function ArticleFormProductsCard({ products }: { products: ArticleProductOption[] }) {
    const { control } = useFormContext<ArticleFormValues>()

    return (
        <Card>
            <CardHeader>
                <CardTitle>关联商品</CardTitle>
                <CardDescription>
                    文章底部会推荐这些商品，对应商品页也会显示这篇文章（站内互链）
                </CardDescription>
            </CardHeader>
            <CardContent>
                <FormField
                    control={control}
                    name="productIds"
                    render={({ field }) => {
                        const selected = new Set(field.value)
                        const toggle = (id: string, checked: boolean) => {
                            const next = new Set(selected)
                            if (checked) next.add(id)
                            else next.delete(id)
                            field.onChange([...next])
                        }
                        return (
                            <FormItem>
                                <ScrollArea className="h-64 rounded-md border">
                                    <div className="p-2 space-y-1">
                                        {products.length === 0 && (
                                            <p className="p-2 text-sm text-muted-foreground">暂无商品</p>
                                        )}
                                        {products.map((p) => (
                                            <FormLabel
                                                key={p.id}
                                                className="flex items-center gap-3 rounded-md px-2 py-2 font-normal hover:bg-muted cursor-pointer"
                                            >
                                                <FormControl>
                                                    <Checkbox
                                                        checked={selected.has(p.id)}
                                                        onCheckedChange={(v) => toggle(p.id, v === true)}
                                                    />
                                                </FormControl>
                                                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                                                {p.status !== "ACTIVE" && (
                                                    <Badge variant="secondary">已下架</Badge>
                                                )}
                                            </FormLabel>
                                        ))}
                                    </div>
                                </ScrollArea>
                                <p className="text-xs text-muted-foreground">已选 {selected.size} 个</p>
                                <FormMessage />
                            </FormItem>
                        )
                    }}
                />
            </CardContent>
        </Card>
    )
}
