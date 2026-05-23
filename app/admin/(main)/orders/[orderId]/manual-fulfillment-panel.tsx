"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type Props = {
    orderId: string
    status: "AWAITING_FULFILLMENT" | "PROCESSING" | "COMPLETED" | "CLOSED"
    existingContent: string | null
    dunCount: number
    lastDunAt: string | null
}

export function ManualFulfillmentPanel({
    orderId,
    status,
    existingContent,
    dunCount,
    lastDunAt,
}: Props) {
    const router = useRouter()
    const [content, setContent] = useState("")
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [busy, setBusy] = useState(false)

    if (status === "COMPLETED" || status === "CLOSED") {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">发货内容</CardTitle>
                </CardHeader>
                <CardContent>
                    <pre className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm">
                        {existingContent ?? "—"}
                    </pre>
                </CardContent>
            </Card>
        )
    }

    const take = async () => {
        setBusy(true)
        const res = await fetch(`/api/admin/orders/${orderId}/take`, {
            method: "POST",
        })
        setBusy(false)
        if (!res.ok) {
            const j = await res.json().catch(() => ({}))
            toast.error(j?.error ?? "接单失败")
            return
        }
        toast.success("已接单")
        router.refresh()
    }

    const fulfill = async () => {
        setBusy(true)
        const res = await fetch(`/api/admin/orders/${orderId}/fulfill`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
        })
        setBusy(false)
        setConfirmOpen(false)
        if (!res.ok) {
            const j = await res.json().catch(() => ({}))
            toast.error(j?.error ?? "发货失败")
            return
        }
        toast.success("已发货")
        router.refresh()
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">发货操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                    催发货 {dunCount} 次
                    {lastDunAt
                        ? `（最近 ${new Date(lastDunAt).toLocaleString("zh-CN")}）`
                        : ""}
                </div>
                {status === "AWAITING_FULFILLMENT" && (
                    <Button variant="outline" disabled={busy} onClick={take}>
                        接单
                    </Button>
                )}
                <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={6}
                    maxLength={5000}
                    placeholder="账号/卡密/网盘链接等发货内容；最多 5000 字"
                />
                <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                    <AlertDialogTrigger asChild>
                        <Button disabled={busy || content.trim().length === 0}>
                            发货
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>确认发货？</AlertDialogTitle>
                            <AlertDialogDescription>
                                发货内容提交后无法修改，且会立即推送给买家。
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction onClick={fulfill}>
                                确认发货
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    )
}
