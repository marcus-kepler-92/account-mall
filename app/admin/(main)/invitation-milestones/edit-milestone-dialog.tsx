"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
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

const schema = z.object({
    thresholdAmount: z
        .string()
        .min(1, "请输入门槛金额")
        .refine((v) => !Number.isNaN(Number(v)), "请输入有效数字")
        .refine((v) => Number(v) > 0, "必须大于 0"),
    thresholdCount: z
        .string()
        .min(1, "请输入达标人数")
        .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1, "至少 1 人（整数）"),
    bonusAmount: z
        .string()
        .min(1, "请输入奖励金额")
        .refine((v) => !Number.isNaN(Number(v)), "请输入有效数字")
        .refine((v) => Number(v) > 0, "必须大于 0"),
})
type FormValues = z.infer<typeof schema>

type Props = {
    id: string
    thresholdAmount: number
    thresholdCount: number
    bonusAmount: number
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function EditMilestoneDialog({ id, thresholdAmount, thresholdCount, bonusAmount, open, onOpenChange }: Props) {
    const router = useRouter()
    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            thresholdAmount: String(thresholdAmount),
            thresholdCount: String(thresholdCount),
            bonusAmount: String(bonusAmount),
        },
    })

    const onSubmit = async (values: FormValues) => {
        try {
            const res = await fetch(`/api/admin/invitation-milestones/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    thresholdAmount: parseFloat(values.thresholdAmount),
                    thresholdCount: parseInt(values.thresholdCount),
                    bonusAmount: parseFloat(values.bonusAmount),
                }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                toast.error(err?.error || "保存失败")
                return
            }
            toast.success("已保存")
            onOpenChange(false)
            router.refresh()
        } catch {
            toast.error("保存失败")
        }
    }

    return (
        <ModalForm
            title="编辑里程碑"
            description="修改门槛或奖励金额。注意：创建时间不变，已触发的奖励不受影响。"
            open={open}
            onOpenChange={(v) => {
                onOpenChange(v)
                if (!v) form.reset()
            }}
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="thresholdAmount"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>累计销售额门槛（元）</FormLabel>
                                <FormControl>
                                    <Input type="number" min={0} step="0.01" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="thresholdCount"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>达标人数</FormLabel>
                                <FormControl>
                                    <Input type="number" min={1} step={1} placeholder="3" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="bonusAmount"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>奖励金额（元）</FormLabel>
                                <FormControl>
                                    <Input type="number" min={0} step="0.01" {...field} />
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
                                onOpenChange(false)
                                form.reset()
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
