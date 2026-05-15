"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { DialogFooter } from "@/components/ui/dialog"
import { ModalForm } from "@/app/admin/components"

const schema = z.object({
    thresholdCount: z
        .string()
        .min(1, "请输入达标人数")
        .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1, "至少 1 人（整数）"),
    thresholdAmount: z
        .string()
        .min(1, "请输入每人最低消费")
        .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, "必须大于 0"),
    bonusAmount: z
        .string()
        .min(1, "请输入奖励金额")
        .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, "必须大于 0"),
})
type FormValues = z.infer<typeof schema>

export function AddMilestoneDialog() {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { thresholdCount: "", thresholdAmount: "", bonusAmount: "" },
    })

    const onSubmit = async (values: FormValues) => {
        try {
            const res = await fetch("/api/admin/invitation-milestones", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    thresholdCount: parseInt(values.thresholdCount),
                    thresholdAmount: parseFloat(values.thresholdAmount),
                    bonusAmount: parseFloat(values.bonusAmount),
                }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                toast.error(err?.error || "添加失败")
                return
            }
            toast.success("已添加")
            setOpen(false)
            form.reset()
            router.refresh()
        } catch {
            toast.error("添加失败")
        }
    }

    return (
        <ModalForm
            trigger={
                <Button>
                    <Plus className="mr-1 size-4" />
                    添加里程碑
                </Button>
            }
            title="添加邀请里程碑"
            description="当您名下有 N 位被邀分销员各自消费满指定金额（自本里程碑创建日起计算），您一次性获得奖励。"
            open={open}
            onOpenChange={(v) => {
                setOpen(v)
                if (!v) form.reset()
            }}
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="thresholdCount"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>达标人数</FormLabel>
                                <FormControl>
                                    <Input type="number" min={1} step={1} placeholder="3" {...field} />
                                </FormControl>
                                <FormDescription>需要有多少位下线各自达标</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="thresholdAmount"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>每人最低消费（元）</FormLabel>
                                <FormControl>
                                    <Input type="number" min={0.01} step="0.01" placeholder="40" {...field} />
                                </FormControl>
                                <FormDescription>每位下线各自累计消费须达到的金额</FormDescription>
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
                                    <Input type="number" min={0.01} step="0.01" placeholder="20" {...field} />
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
                                form.reset()
                            }}
                        >
                            取消
                        </Button>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? "添加中…" : "添加"}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </ModalForm>
    )
}
