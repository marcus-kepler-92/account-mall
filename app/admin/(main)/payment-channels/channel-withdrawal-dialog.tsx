"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createChannelWithdrawalSchema, type CreateChannelWithdrawalInput } from "@/lib/validations/payment-channel"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    channelId: string
    channelNickname: string
}

export function ChannelWithdrawalDialog({ open, onOpenChange, channelId, channelNickname }: Props) {
    const router = useRouter()
    const [error, setError] = useState<string | null>(null)

    const form = useForm({
        resolver: zodResolver(createChannelWithdrawalSchema),
        defaultValues: {
            amount: 0,
            note: "",
        },
    })

    useEffect(() => {
        if (!open) {
            form.reset()
        }
    }, [open, form])

    const onSubmit = async (values: CreateChannelWithdrawalInput) => {
        setError(null)
        try {
            const res = await fetch(`/api/admin/payment-channels/${channelId}/withdrawals`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                setError(data.error ?? "操作失败")
                return
            }
            toast.success("提现记录已保存")
            form.reset()
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
                    <DialogTitle>记录提现</DialogTitle>
                    <DialogDescription>{channelNickname}</DialogDescription>
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
                                        <Input
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="0.00"
                                            value={field.value === 0 ? "" : String(field.value)}
                                            onChange={(e) => field.onChange(e.target.value)}
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
                            <Button type="button" variant="outline" onClick={() => { form.reset(); onOpenChange(false) }}>取消</Button>
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
