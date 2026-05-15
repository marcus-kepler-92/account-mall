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

type Props = {
    id: string
    type: "INVITATION" | "SALES"
    thresholdAmount: number
    thresholdCount: number
    bonusAmount: number
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function EditMilestoneDialog({ id, type, thresholdAmount, thresholdCount, bonusAmount, open, onOpenChange }: Props) {
    const router = useRouter()
    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            type,
            thresholdAmount: String(thresholdAmount),
            thresholdCount: String(thresholdCount),
            bonusAmount: String(bonusAmount),
        },
    })
    const watchedType = form.watch("type")

    const onSubmit = async (values: FormValues) => {
        try {
            const res = await fetch(`/api/admin/invitation-milestones/${id}`, {
                method: "PATCH",
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
                                            <RadioGroupItem value="INVITATION" id="edit-type-invitation" />
                                            <label htmlFor="edit-type-invitation" className="text-sm cursor-pointer">邀请里程碑</label>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <RadioGroupItem value="SALES" id="edit-type-sales" />
                                            <label htmlFor="edit-type-sales" className="text-sm cursor-pointer">销售里程碑</label>
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
                                        <Input type="number" min={0} step="0.01" {...field} />
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
