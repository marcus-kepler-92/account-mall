"use client"

import { useState, useEffect, useCallback } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Copy, Check, Trash2, Loader2, ShieldOff, RefreshCw } from "lucide-react"
import { toast } from "sonner"

interface BlacklistEntry {
    id: string
    account: string
    password: string | null
    reason: string | null
    orderId: string | null
    createdAt: string
}

type Props = {
    productId: string
    productName: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ProductBlacklistModal({ productId, productName, open, onOpenChange }: Props) {
    const [entries, setEntries] = useState<BlacklistEntry[]>([])
    const [loading, setLoading] = useState(false)
    const [removingId, setRemovingId] = useState<string | null>(null)
    const [copiedId, setCopiedId] = useState<string | null>(null)

    const fetchBlacklist = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/products/${productId}/blacklist`)
            if (!res.ok) { toast.error("获取黑名单失败"); return }
            const data = await res.json() as { blacklist: BlacklistEntry[] }
            setEntries(data.blacklist)
        } catch {
            toast.error("网络异常")
        } finally {
            setLoading(false)
        }
    }, [productId])

    useEffect(() => {
        if (open) fetchBlacklist()
    }, [open, fetchBlacklist])

    const handleCopy = async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text)
            setCopiedId(id)
            setTimeout(() => setCopiedId(null), 1500)
        } catch {
            toast.error("复制失败")
        }
    }

    const handleRemove = async (id: string) => {
        setRemovingId(id)
        try {
            const res = await fetch(`/api/admin/products/${productId}/blacklist`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            })
            if (!res.ok) { toast.error("解除失败"); return }
            setEntries((prev) => prev.filter((e) => e.id !== id))
            toast.success("已解除黑名单")
        } catch {
            toast.error("网络异常")
        } finally {
            setRemovingId(null)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShieldOff className="size-4" />
                        账号黑名单
                    </DialogTitle>
                    <DialogDescription>
                        {productName} · 被标记不可用的账号，下单/刷新时不会分配这些账号。
                    </DialogDescription>
                </DialogHeader>

                {/* Action bar */}
                <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                        {loading ? "加载中…" : `共 ${entries.length} 条`}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={loading}
                        onClick={fetchBlacklist}
                        className="gap-1.5"
                    >
                        {loading ? (
                            <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                            <RefreshCw className="size-3.5" />
                        )}
                        刷新
                    </Button>
                </div>

                {/* List */}
                {!loading && entries.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                        暂无被拉黑的账号
                    </div>
                ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {entries.map((entry) => (
                            <div
                                key={entry.id}
                                className="rounded-lg border bg-muted/30 p-3"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    {/* Fields */}
                                    <div className="min-w-0 flex-1 space-y-1.5">
                                        <div className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-x-2">
                                            <span className="text-xs text-muted-foreground text-right">账号</span>
                                            <span className="font-mono text-sm truncate">{entry.account}</span>
                                            <button
                                                onClick={() => handleCopy(entry.account, `acc-${entry.id}`)}
                                                className="text-muted-foreground hover:text-foreground"
                                            >
                                                {copiedId === `acc-${entry.id}` ? (
                                                    <Check className="size-3.5 text-green-500" />
                                                ) : (
                                                    <Copy className="size-3.5" />
                                                )}
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-x-2">
                                            <span className="text-xs text-muted-foreground text-right">密码</span>
                                            {entry.password ? (
                                                <>
                                                    <span className="font-mono text-sm truncate">{entry.password}</span>
                                                    <button
                                                        onClick={() => handleCopy(entry.password!, `pwd-${entry.id}`)}
                                                        className="text-muted-foreground hover:text-foreground"
                                                    >
                                                        {copiedId === `pwd-${entry.id}` ? (
                                                            <Check className="size-3.5 text-green-500" />
                                                        ) : (
                                                            <Copy className="size-3.5" />
                                                        )}
                                                    </button>
                                                </>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">—</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Remove */}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-7 shrink-0 text-destructive hover:text-destructive"
                                        disabled={removingId === entry.id}
                                        onClick={() => handleRemove(entry.id)}
                                    >
                                        {removingId === entry.id ? (
                                            <Loader2 className="size-3.5 animate-spin" />
                                        ) : (
                                            <Trash2 className="size-3.5" />
                                        )}
                                    </Button>
                                </div>

                                {/* Meta */}
                                <div className="mt-2 flex items-center gap-2 pl-[3rem] flex-wrap">
                                    {entry.reason && (
                                        <Badge variant="secondary" className="text-xs">
                                            {entry.reason}
                                        </Badge>
                                    )}
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(entry.createdAt).toLocaleString("zh-CN")}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
