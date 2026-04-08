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
import { createChannelWithdrawalSchema, type CreateChannelWithdrawalInput } from "@/lib/validations/payment-channel"
import type { WithdrawalRow } from "./withdrawal-columns"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    channelId: string
    withdrawal?: WithdrawalRow // if present = edit mode
}

export function WithdrawalFormDialog({ open, onOpenChange, channelId, withdrawal }: Props) {
    const router = useRouter()
    const isEdit = !!withdrawal
    const [error, setError] = useState<string | null>(null)

    const form = useForm<CreateChannelWithdrawalInput>({
        resolver: zodResolver(createChannelWithdrawalSchema),
        defaultValues: { amount: 0, note: "" },
    })

    useEffect(() => {
        if (open) {
            form.reset(
                withdrawal
                    ? { amount: withdrawal.amount, note: withdrawal.note }
                    : { amount: 0, note: "" }
            )
            setError(null)
        }
    }, [open, withdrawal, form])

    const onSubmit = async (values: CreateChannelWithdrawalInput) => {
        setError(null)
        try {
            const url = isEdit
                ? `/api/admin/payment-channels/${channelId}/withdrawals/${withdrawal!.id}`
                : `/api/admin/payment-channels/${channelId}/withdrawals`
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
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "编辑提现记录" : "记录提现"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>提现金额 (元)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
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
