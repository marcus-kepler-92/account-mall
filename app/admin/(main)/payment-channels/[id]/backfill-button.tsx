"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2, GitMerge } from "lucide-react"

type Props = {
    channelId: string
    channelNickname: string
    pendingCount: number
    typeLabel: string
}

export function BackfillButton({ channelId, channelNickname, pendingCount, typeLabel }: Props) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    if (pendingCount === 0) return null

    const handleBackfill = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/payment-channels/${channelId}/backfill`, {
                method: "POST",
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                toast.error(err?.error ?? "归因失败")
                return
            }
            const { data } = await res.json()
            setOpen(false)
            toast.success(`已归因 ${data.updated} 条历史订单到「${channelNickname}」`)
            router.refresh()
        } catch {
            toast.error("归因失败")
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                <GitMerge className="size-4" />
                归因历史订单 ({pendingCount})
            </Button>

            <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>归因历史订单</AlertDialogTitle>
                        <AlertDialogDescription>
                            共 <strong>{pendingCount}</strong> 条{typeLabel}历史订单尚未归属渠道，将全部归因到「{channelNickname}」。
                            <br />
                            归因后这些订单的收入将计入该渠道的年度收入和余额。此操作不可撤销。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={loading}>取消</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={loading}
                            onClick={(e) => {
                                e.preventDefault()
                                handleBackfill()
                            }}
                        >
                            {loading && <Loader2 className="size-4 animate-spin" />}
                            确认归因
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
