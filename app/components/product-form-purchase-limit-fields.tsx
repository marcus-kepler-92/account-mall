"use client"

import { useFormContext } from "react-hook-form"
import { Switch } from "@/components/ui/switch"
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
import type { ProductFormSchema } from "@/lib/validations/product"

export function ProductFormPurchaseLimitFields() {
    const { control, watch } = useFormContext<ProductFormSchema>()
    const purchaseLimitEnabled = watch("purchaseLimitEnabled") ?? false

    return (
        <Card>
            <CardHeader>
                <CardTitle>限购设置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <FormField
                    control={control}
                    name="purchaseLimitEnabled"
                    render={({ field }) => (
                        <FormItem className="flex items-center justify-between gap-4">
                            <div className="space-y-0.5">
                                <FormLabel>启用限购</FormLabel>
                                <FormDescription>
                                    开启后，同一用户（邮箱 / 指纹 / IP 识别）最多购买指定次数
                                </FormDescription>
                            </div>
                            <FormControl>
                                <Switch
                                    checked={field.value ?? false}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />

                {purchaseLimitEnabled && (
                    <div className="border-l-2 border-muted pl-4">
                        <FormField
                            control={control}
                            name="purchaseLimitQuantity"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>限购数量</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min={1}
                                            step={1}
                                            placeholder="1"
                                            {...field}
                                            value={field.value ?? "1"}
                                            onChange={(e) =>
                                                field.onChange(e.target.value.replace(/[^0-9]/g, ""))
                                            }
                                        />
                                    </FormControl>
                                    <FormDescription>每位用户最多可购买的次数</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
