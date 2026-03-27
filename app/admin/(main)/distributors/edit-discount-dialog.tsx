"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Loader2 } from "lucide-react"

const discountSchema = z
    .object({
        enabled: z.boolean(),
        percent: z.string(),
    })
    .superRefine((data, ctx) => {
        if (!data.enabled) return
        const pct = data.percent.trim() === "" ? NaN : parseFloat(data.percent)
        if (Number.isNaN(pct) || pct < 0 || pct > 100) {
            ctx.addIssue({
                code: "custom",
                message: "请填写 0–100 的折扣比例",
                path: ["percent"],
            })
        }
    })

type DiscountFormValues = z.infer<typeof discountSchema>

type EditDiscountDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    distributorId: string
    distributorCode: string | null
    discountCodeEnabled: boolean
    discountPercent: number | null
    onSuccess: () => void
}

export function EditDiscountDialog({
    open,
    onOpenChange,
    distributorId,
    distributorCode,
    discountCodeEnabled,
    discountPercent,
    onSuccess,
}: EditDiscountDialogProps) {
    const form = useForm<DiscountFormValues>({
        resolver: zodResolver(discountSchema),
        defaultValues: { enabled: false, percent: "" },
    })

    useEffect(() => {
        if (open) {
            form.reset({
                enabled: discountCodeEnabled,
                percent: discountPercent != null ? String(discountPercent) : "",
            })
        }
    }, [open, discountCodeEnabled, discountPercent, form])

    const enabled = form.watch("enabled")

    const onSubmit = async (values: DiscountFormValues) => {
        const pctNum = values.percent.trim() === "" ? null : parseFloat(values.percent)
        try {
            const res = await fetch(`/api/admin/distributors/${distributorId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    discountCodeEnabled: values.enabled,
                    discountPercent: values.enabled && pctNum != null ? pctNum : null,
                }),
            })
            if (!res.ok) {
                const err = await res.json()
                toast.error(err.error?.message?.[0] || err.error || "保存失败")
                return
            }
            toast.success("已保存")
            onOpenChange(false)
            onSuccess()
        } catch {
            toast.error("保存失败")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>优惠码设置</DialogTitle>
                    <DialogDescription>
                        {distributorCode ? (
                            <>推荐码 <code className="font-mono text-xs">{distributorCode}</code> 作为优惠码时，仅当开启下方开关并设置折扣比例后，访客下单才享受折扣。</>
                        ) : (
                            "该分销员暂无推荐码，请先确保其已生成推荐码。"
                        )}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="enabled"
                            render={({ field }) => (
                                <FormItem className="flex items-center justify-between space-x-2">
                                    <FormLabel>启用优惠码</FormLabel>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        {enabled && (
                            <FormField
                                control={form.control}
                                name="percent"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>折扣比例（%）</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={100}
                                                step={0.01}
                                                placeholder="如 5 表示 5%"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={form.formState.isSubmitting}
                            >
                                取消
                            </Button>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                                保存
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
