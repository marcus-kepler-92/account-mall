"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createPayoutSchema } from "@/lib/validations/payout"
import type { PayoutRow } from "./payout-columns"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    payout?: PayoutRow
}

export function PayoutFormDialog({ open, onOpenChange, payout }: Props) {
    const router = useRouter()
    const isEdit = !!payout
    const [error, setError] = useState<string | null>(null)

    const form = useForm({
        resolver: zodResolver(createPayoutSchema),
        defaultValues: { amount: 0, note: "" },
    })

    useEffect(() => {
        if (open) {
            form.reset(payout ? { amount: payout.amount, note: payout.note } : { amount: 0, note: "" })
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setError(null)
        }
    }, [open, payout, form])

    const onSubmit = async (values: { amount: number; note?: string }) => {
        setError(null)
        try {
            const url = isEdit ? `/api/admin/payouts/${payout!.id}` : `/api/admin/payouts`
            const res = await fetch(url, {
                method: isEdit ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                setError(data.error ?? "操作失败")
                return
            }
            toast.success(isEdit ? "提现记录已更新" : "提现记录已保存")
            onOpenChange(false)
            router.refresh()
        } catch {
            setError("操作失败")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
                <DialogHeader>
                    <DialogTitle>{isEdit ? "编辑提现记录" : "记录提现"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field: { onChange, value, ...rest } }) => (
                                <FormItem>
                                    <FormLabel>提现金额 (元)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="0.00"
                                            value={value === 0 ? "" : String(value)}
                                            onChange={(e) => onChange(e.target.value)}
                                            {...rest}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="note"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>备注（可选）</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="如：提到招商银行 xxx" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {error && <p className="text-sm text-destructive">{error}</p>}
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? "保存中..." : "确认"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
