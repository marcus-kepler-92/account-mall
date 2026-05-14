"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { DialogFooter } from "@/components/ui/dialog"
import { ModalForm } from "@/app/admin/components"
import { toCents } from "@/lib/utils"

const schema = z
    .object({
        minAmount: z
            .string()
            .refine((v) => !Number.isNaN(parseFloat(v)), "请输入有效数字")
            .refine((v) => parseFloat(v) >= 0, "不能为负数"),
        maxAmount: z
            .string()
            .refine((v) => !Number.isNaN(parseFloat(v)), "请输入有效数字")
            .refine((v) => parseFloat(v) >= 0, "不能为负数"),
        ratePercent: z
            .string()
            .refine((v) => !Number.isNaN(parseFloat(v)), "请输入有效数字")
            .refine((v) => parseFloat(v) >= 0, "不能为负数")
            .refine((v) => parseFloat(v) <= 100, "最大 100"),
    })
    .refine((d) => toCents(parseFloat(d.minAmount)) < toCents(parseFloat(d.maxAmount)), {
        message: "销售额下限必须小于上限",
        path: ["minAmount"],
    })

type FormValues = z.infer<typeof schema>

type Tier = { id: string; minAmount: number; maxAmount: number; ratePercent: number }

export function EditTierDialog({ tier }: { tier: Tier }) {
    const router = useRouter()
    const [open, setOpen] = useState(false)

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            minAmount: String(tier.minAmount),
            maxAmount: String(tier.maxAmount),
            ratePercent: String(tier.ratePercent),
        },
    })

    const onSubmit = async (values: FormValues) => {
        try {
            const res = await fetch(`/api/admin/commission-tiers/${tier.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    minAmount: parseFloat(values.minAmount),
                    maxAmount: parseFloat(values.maxAmount),
                    ratePercent: parseFloat(values.ratePercent),
                }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                toast.error(err?.error || "修改失败")
                return
            }
            toast.success("已修改")
            setOpen(false)
            router.refresh()
        } catch {
            toast.error("修改失败")
        }
    }

    const resetToTierValues = () =>
        form.reset({
            minAmount: String(tier.minAmount),
            maxAmount: String(tier.maxAmount),
            ratePercent: String(tier.ratePercent),
        })

    return (
        <ModalForm
            trigger={
                <Button variant="ghost" size="sm">
                    <Pencil className="size-4" />
                    编辑
                </Button>
            }
            title="编辑阶梯档位"
            description="当周该分销员已完成订单金额落入 [下限, 上限) 时，阶梯佣金 = 订单金额 × 佣金比例%。"
            open={open}
            onOpenChange={(v) => {
                setOpen(v)
                if (!v) resetToTierValues()
            }}
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="minAmount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>当周销售额下限（元）</FormLabel>
                                    <FormControl>
                                        <Input type="number" min={0} step="0.01" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="maxAmount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>当周销售额上限（元）</FormLabel>
                                    <FormControl>
                                        <Input type="number" min={0} step="0.01" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <FormField
                        control={form.control}
                        name="ratePercent"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>佣金比例（%）</FormLabel>
                                <FormControl>
                                    <Input type="number" min={0} max={100} step="0.01" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setOpen(false)
                                resetToTierValues()
                            }}
                        >
                            取消
                        </Button>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? "保存中…" : "保存"}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </ModalForm>
    )
}
