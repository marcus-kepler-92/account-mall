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
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { DialogFooter } from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ModalForm } from "@/app/admin/components"

const schema = z.object({
    type: z.enum(["INVITATION", "SALES"]),
    thresholdCount: z.string().optional(),
    thresholdAmount: z.string().optional(),
    bonusAmount: z
        .string()
        .min(1, "请输入奖励金额")
        .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, "必须大于 0"),
}).superRefine((data, ctx) => {
    if (data.type === "INVITATION") {
        if (!data.thresholdCount || !Number.isInteger(Number(data.thresholdCount)) || Number(data.thresholdCount) < 1) {
            ctx.addIssue({ code: "custom", message: "邀请人数至少为 1（整数）", path: ["thresholdCount"] })
        }
    }
    if (data.type === "SALES") {
        if (!data.thresholdAmount || isNaN(Number(data.thresholdAmount)) || Number(data.thresholdAmount) <= 0) {
            ctx.addIssue({ code: "custom", message: "门槛金额必须大于 0", path: ["thresholdAmount"] })
        }
    }
})
type FormValues = z.infer<typeof schema>

export function AddMilestoneDialog() {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { type: "INVITATION" as const, thresholdCount: "", thresholdAmount: "", bonusAmount: "" },
    })
    const watchedType = form.watch("type")

    const onSubmit = async (values: FormValues) => {
        try {
            const res = await fetch("/api/admin/invitation-milestones", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: values.type,
                    thresholdCount: values.type === "INVITATION" ? parseInt(values.thresholdCount!) : 0,
                    thresholdAmount: values.type === "SALES" ? parseFloat(values.thresholdAmount!) : 0,
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
                    <Plus className="size-4 mr-1" />
                    添加里程碑
                </Button>
            }
            title="添加邀请里程碑"
            description="当您名下有 N 位被邀请分销员各自累计销售额（自本里程碑创建日起）达到门槛时，您一次性获得奖励。"
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
                        name="type"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>里程碑类型</FormLabel>
                                <FormControl>
                                    <RadioGroup
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        className="flex gap-4"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <RadioGroupItem value="INVITATION" id="add-type-invitation" />
                                            <label htmlFor="add-type-invitation" className="text-sm cursor-pointer">邀请里程碑</label>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <RadioGroupItem value="SALES" id="add-type-sales" />
                                            <label htmlFor="add-type-sales" className="text-sm cursor-pointer">销售里程碑</label>
                                        </div>
                                    </RadioGroup>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    {watchedType === "INVITATION" && (
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
                    )}
                    {watchedType === "SALES" && (
                        <FormField
                            control={form.control}
                            name="thresholdAmount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>累计销售额门槛（元）</FormLabel>
                                    <FormControl>
                                        <Input type="number" min={0} step="0.01" placeholder="500" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}
                    <FormField
                        control={form.control}
                        name="bonusAmount"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>奖励金额（元）</FormLabel>
                                <FormControl>
                                    <Input type="number" min={0} step="0.01" placeholder="20" {...field} />
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
