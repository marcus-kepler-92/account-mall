"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { createPaymentChannelSchema, updatePaymentChannelSchema } from "@/lib/validations/payment-channel"
import type { ChannelRow } from "./payment-channels-columns"

// Use z.output to get the resolved type (defaults filled in) for form field values
type FormValues = {
    nickname: string
    pid: string
    key: string
    submitUrl: string
    siteName: string
    type: "alipay" | "wxpay" | "qqpay"
    annualLimit: number
    sortOrder: number
    isActive: boolean
}

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    channel?: ChannelRow | null
}

export function ChannelFormDialog({ open, onOpenChange, channel }: Props) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const isEdit = !!channel

    const form = useForm<FormValues>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(isEdit ? updatePaymentChannelSchema : createPaymentChannelSchema) as any,
        defaultValues: channel
            ? {
                  nickname: channel.nickname,
                  pid: channel.pid,
                  key: channel.key,
                  submitUrl: channel.submitUrl,
                  siteName: channel.siteName,
                  type: channel.type as "alipay" | "wxpay" | "qqpay",
                  annualLimit: channel.annualLimit,
                  sortOrder: channel.sortOrder,
                  isActive: channel.isActive,
              }
            : {
                  nickname: "",
                  pid: "",
                  key: "",
                  submitUrl: "",
                  siteName: "",
                  type: "alipay",
                  annualLimit: 65000,
                  sortOrder: 0,
                  isActive: true,
              },
    })

    const onSubmit = async (data: FormValues) => {
        setLoading(true)
        try {
            const url = isEdit
                ? `/api/admin/payment-channels/${channel!.id}`
                : "/api/admin/payment-channels"
            const res = await fetch(url, {
                method: isEdit ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })
            if (!res.ok) {
                const err = await res.json()
                toast.error(err.error || "操作失败")
                return
            }
            toast.success(isEdit ? "已更新渠道" : "已添加渠道")
            onOpenChange(false)
            router.refresh()
        } catch {
            toast.error("操作失败")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "编辑渠道" : "添加渠道"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="nickname"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>备注名</FormLabel>
                                        <FormControl><Input placeholder="张三支付宝" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>支付类型</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="alipay">支付宝</SelectItem>
                                                <SelectItem value="wxpay">微信支付</SelectItem>
                                                <SelectItem value="qqpay">QQ支付</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="pid"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>商户号 (pid)</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="key"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>密钥 (key)</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="submitUrl"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>接口地址</FormLabel>
                                    <FormControl><Input placeholder="https://z-pay.cn/submit.php" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="siteName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>站点名称</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="annualLimit"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>年限额 (元)</FormLabel>
                                        <FormControl><Input type="number" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="sortOrder"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>排序（越小越优先）</FormLabel>
                                        <FormControl><Input type="number" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="isActive"
                            render={({ field }) => (
                                <FormItem className="flex items-center gap-3">
                                    <FormControl>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                    <FormLabel className="mt-0!">参与轮转</FormLabel>
                                </FormItem>
                            )}
                        />
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? "保存中..." : "保存"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
