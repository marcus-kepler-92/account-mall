"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { z } from "zod"

const formSchema = z.object({
    enabled: z.boolean(),
    discountPercent: z.number().min(0).max(50),
    ttlMinutes: z.number().int().min(5).max(180),
})

type FormValues = z.infer<typeof formSchema>

type Props = {
    setting: { enabled: boolean; discountPercent: number; ttlMinutes: number }
}

export function CrossSellSettingsForm({ setting }: Props) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            enabled: setting.enabled,
            discountPercent: setting.discountPercent,
            ttlMinutes: setting.ttlMinutes,
        },
    })

    const onSubmit = async (data: FormValues) => {
        setLoading(true)
        try {
            const res = await fetch("/api/admin/cross-sell-setting", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                toast.error(body.error || "保存失败")
                return
            }
            toast.success("设置已保存")
            router.refresh()
        } catch {
            toast.error("保存失败，请稍后重试")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">折扣配置</CardTitle>
                <CardDescription>
                    用户完成订单后，成功页会展示推荐商品并附带限时折扣链接
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                        <FormField
                            control={form.control}
                            name="enabled"
                            render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                    <div>
                                        <FormLabel className="text-sm font-medium">启用联推折扣</FormLabel>
                                        <FormDescription className="text-xs">
                                            关闭后成功页不再显示推荐商品
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="discountPercent"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>折扣力度（%）</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min={0}
                                            max={50}
                                            {...field}
                                            onChange={(e) => field.onChange(e.target.valueAsNumber)}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        在原价基础上减免的百分比，范围 0-50。0 表示纯推荐不打折，10 表示九折
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="ttlMinutes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>折扣有效时长（分钟）</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min={5}
                                            max={180}
                                            {...field}
                                            onChange={(e) => field.onChange(e.target.valueAsNumber)}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        从用户打开成功页开始计时，范围 5-180 分钟
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <Button type="submit" disabled={loading}>
                            {loading ? "保存中…" : "保存设置"}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}
