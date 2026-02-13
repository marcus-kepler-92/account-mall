"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Bell } from "lucide-react"

type RestockReminderFormProps = {
    productId: string
    productName: string
    defaultEmail?: string
}

export function RestockReminderForm({
    productId,
    productName,
    defaultEmail,
}: RestockReminderFormProps) {
    const searchParams = useSearchParams()
    const [open, setOpen] = useState(false)
    const [email, setEmail] = useState(defaultEmail ?? "")
    const [loading, setLoading] = useState(false)
    const [subscribed, setSubscribed] = useState(false)

    useEffect(() => {
        if (defaultEmail) setEmail(defaultEmail)
    }, [defaultEmail])

    useEffect(() => {
        if (searchParams.get("restock") === "1") {
            setOpen(true)
        }
    }, [searchParams])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const trimmed = email.trim()
        if (!trimmed) {
            toast.error("请输入邮箱")
            return
        }

        setLoading(true)
        try {
            const res = await fetch("/api/restock-subscriptions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productId, email: trimmed }),
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
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">
                    到货提醒
                </h3>
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
                    {subscribed ? (
                        <>
                            <Bell className="size-4 shrink-0" />
                            已开启补货提醒
                        </>
                    ) : (
                        <>
                            <Bell className="size-4 shrink-0" />
                            到货提醒我
                        </>
                    )}
                </Button>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent showCloseButton>
                    <DialogHeader>
                        <DialogTitle>到货提醒</DialogTitle>
                        <DialogDescription>
                            输入邮箱，商品补货后我们会第一时间通知你。
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor="restock-email">邮箱</Label>
                            <Input
                                id="restock-email"
                                type="email"
                                placeholder="用于接收补货通知"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={loading}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                                disabled={loading}
                            >
                                取消
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading && (
                                    <Loader2 className="size-4 animate-spin" />
                                )}
                                确认订阅
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    )
}
