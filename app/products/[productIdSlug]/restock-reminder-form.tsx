"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import { Input } from "@/components/ui/input"
import { Loader2, Bell } from "lucide-react"

const schema = z.object({
    email: z.string().email("请输入有效的邮箱地址"),
})
type FormValues = z.infer<typeof schema>

type RestockReminderFormProps = {
    productId: string
    productName: string
    defaultEmail?: string
}

export function RestockReminderForm({
    productId,
    defaultEmail,
}: RestockReminderFormProps) {
    const searchParams = useSearchParams()
    const [open, setOpen] = useState(false)
    const [subscribed, setSubscribed] = useState(false)

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { email: defaultEmail ?? "" },
    })

    useEffect(() => {
        if (searchParams.get("restock") === "1") setOpen(true)
    }, [searchParams])

    useEffect(() => {
        if (defaultEmail) form.reset({ email: defaultEmail })
    }, [defaultEmail, form])

    const onSubmit = async ({ email }: FormValues) => {
        try {
            const res = await fetch("/api/restock-subscriptions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productId, email }),
            })
            const data = await res.json()

            if (res.ok) {
                toast.success("已为你开启补货提醒")
                setSubscribed(true)
                setOpen(false)
                return
            }

            if (data.error === "Product is in stock") {
                toast.info(data.message ?? "当前有货，可直接下单购买")
                setOpen(false)
                return
            }

            toast.error(data.error ?? "订阅失败，请稍后重试")
        } catch {
            toast.error("订阅失败，请稍后重试")
        }
    }

    return (
        <>
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">补货提醒</h3>
                <p className="text-sm text-muted-foreground">
                    商品补货后，我们会通过邮箱第一时间通知你。
                </p>
                <Button
                    type="button"
                    variant={subscribed ? "secondary" : "default"}
                    disabled={subscribed}
                    onClick={() => setOpen(true)}
                    className="w-full sm:w-auto"
                >
                    <Bell className="size-4 shrink-0" />
                    {subscribed ? "已开启补货提醒" : "补货提醒我"}
                </Button>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent showCloseButton>
                    <DialogHeader>
                        <DialogTitle>补货提醒</DialogTitle>
                        <DialogDescription>
                            输入邮箱，商品补货后我们会第一时间通知你。
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>邮箱</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="email"
                                                placeholder="用于接收补货通知"
                                                disabled={form.formState.isSubmitting}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="flex justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setOpen(false)}
                                    disabled={form.formState.isSubmitting}
                                >
                                    取消
                                </Button>
                                <Button type="submit" disabled={form.formState.isSubmitting}>
                                    {form.formState.isSubmitting && (
                                        <Loader2 className="size-4 animate-spin" />
                                    )}
                                    确认订阅
                                </Button>
                            </div>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </>
    )
}
