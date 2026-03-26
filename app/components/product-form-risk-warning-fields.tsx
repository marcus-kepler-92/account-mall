"use client"

import { useFormContext } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
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

export function ProductFormRiskWarningFields() {
    const { control, watch } = useFormContext<ProductFormSchema>()
    const riskWarningEnabled = watch("riskWarningEnabled") ?? false

    return (
        <Card>
            <CardHeader>
                <CardTitle>风险提示弹窗</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <FormField
                    control={control}
                    name="riskWarningEnabled"
                    render={({ field }) => (
                        <FormItem className="flex items-center justify-between gap-4">
                            <div className="space-y-0.5">
                                <FormLabel>启用风险提示弹窗</FormLabel>
                                <FormDescription>
                                    用户进入商品页时弹出提示，需阅读并确认后才能继续
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

                {riskWarningEnabled && (
                    <div className="space-y-4 border-l-2 border-muted pl-4">
                        <FormField
                            control={control}
                            name="riskWarningTitle"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>弹窗标题</FormLabel>
                                    <FormControl>
                                        <Input placeholder="风险提示" {...field} value={field.value ?? ""} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={control}
                            name="riskWarningContent"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>提示内容</FormLabel>
                                    <FormControl>
                                        <MarkdownEditor
                                            value={field.value ?? ""}
                                            onChange={field.onChange}
                                            placeholder="输入风险提示内容，支持 Markdown..."
                                            height={200}
                                        />
                                    </FormControl>
                                    <FormDescription>支持 Markdown 语法</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={control}
                                name="riskWarningCountdown"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>倒计时（秒）</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={5}
                                                max={60}
                                                placeholder="15"
                                                {...field}
                                                value={field.value ?? ""}
                                            />
                                        </FormControl>
                                        <FormDescription>5–60 秒，用户需等待后才能确认</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={control}
                                name="riskWarningConfirmText"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>确认按钮文字</FormLabel>
                                        <FormControl>
                                            <Input placeholder="我已知晓" {...field} value={field.value ?? ""} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
