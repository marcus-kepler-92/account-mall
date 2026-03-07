"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { parseFreeSharedCardContent, formatFreeSharedCardForCopy } from "@/lib/free-shared-card"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Copy, ExternalLink, Eye, Loader2, PowerOff, CircleDot } from "lucide-react"

type CardRowActionsProps = {
    cardId: string
    content: string
    status: string
    productId: string
}

export function CardRowActions({
    cardId,
    content,
    status,
    productId,
}: CardRowActionsProps) {
    const router = useRouter()
    const [copied, setCopied] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)

    const textToCopy = (() => {
        const parsed = parseFreeSharedCardContent(content)
        return parsed ? formatFreeSharedCardForCopy(parsed) : content
    })()

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(textToCopy)
            setCopied(true)
            toast.success("已复制")
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error("复制失败")
        }
    }

    const handleDisable = async () => {
        setActionLoading(true)
        try {
            const res = await fetch(`/api/cards/${cardId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "DISABLED" }),
            })
            const data = await res.json()
            if (!res.ok) {
                toast.error(data.error || "停用失败")
                return
            }
            toast.success("已停用")
            router.refresh()
        } catch {
            toast.error("停用失败")
        } finally {
            setActionLoading(false)
        }
    }

    const handleEnable = async () => {
        setActionLoading(true)
        try {
            const res = await fetch(`/api/cards/${cardId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "UNSOLD" }),
            })
            const data = await res.json()
            if (!res.ok) {
                toast.error(data.error || "启用失败")
                return
            }
            toast.success("已启用")
            router.refresh()
        } catch {
            toast.error("启用失败")
        } finally {
            setActionLoading(false)
        }
    }

    return (
        <TooltipProvider delayDuration={0}>
            <div className="flex items-center justify-end gap-0.5">
                {status === "UNSOLD" && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 shrink-0"
                                onClick={handleCopy}
                            >
                                <Copy className="size-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{copied ? "已复制" : "复制卡密"}</TooltipContent>
                    </Tooltip>
                )}
                {(status === "UNSOLD" || status === "DISABLED") && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
                                onClick={status === "UNSOLD" ? handleDisable : handleEnable}
                                disabled={actionLoading}
                                aria-label={status === "UNSOLD" ? "停用" : "启用"}
                            >
                                {actionLoading ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : status === "UNSOLD" ? (
                                    <PowerOff className="size-4" />
                                ) : (
                                    <CircleDot className="size-4" />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{status === "UNSOLD" ? "停用" : "启用"}</TooltipContent>
                    </Tooltip>
                )}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8 shrink-0" asChild>
                            <Link href={`/admin/products/${productId}/cards`} title="前往该商品卡密管理">
                                <ExternalLink className="size-4" />
                            </Link>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>前往该商品卡密管理</TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="查看完整卡密">
                            <Eye className="size-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-sm break-all font-mono text-xs whitespace-pre-wrap">
                        <span className="block text-muted-foreground mb-1">完整卡密</span>
                        {textToCopy}
                    </TooltipContent>
                </Tooltip>
            </div>
        </TooltipProvider>
    )
}
