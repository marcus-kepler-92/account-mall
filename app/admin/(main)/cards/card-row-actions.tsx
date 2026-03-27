"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { MoreHorizontal, Copy, Eye, PowerOff, CircleDot, Trash2, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { parseAutoFetchCardContent, formatAutoFetchCardForCopy } from "@/lib/auto-fetch-card"
import type { CardRow } from "./cards-columns"

// Row actions for the cards admin list (dropdown menu style)
export function CardRowActions({ card }: { card: CardRow }) {
    const router = useRouter()
    const [actionLoading, setActionLoading] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [viewDialogOpen, setViewDialogOpen] = useState(false)

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(card.content)
            toast.success("已复制到剪贴板")
        } catch {
            toast.error("复制失败")
        }
    }

    const handleToggleStatus = async () => {
        const targetStatus = card.status === "UNSOLD" ? "DISABLED" : "UNSOLD"
        setActionLoading(true)
        try {
            const res = await fetch(`/api/cards/${card.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: targetStatus }),
            })
            const data = await res.json()
            if (!res.ok) {
                toast.error(data.error || "操作失败")
                return
            }
            toast.success(targetStatus === "DISABLED" ? "已停用" : "已启用")
            router.refresh()
        } catch {
            toast.error("操作失败")
        } finally {
            setActionLoading(false)
        }
    }

    const handleDelete = async () => {
        setActionLoading(true)
        try {
            const res = await fetch(`/api/cards/${card.id}`, {
                method: "DELETE",
            })
            const data = await res.json()
            if (!res.ok) {
                toast.error(data.error || "删除失败")
                return
            }
            toast.success("已删除")
            router.refresh()
        } catch {
            toast.error("删除失败")
        } finally {
            setActionLoading(false)
            setDeleteDialogOpen(false)
        }
    }

    const canDelete = card.status === "UNSOLD"
    const canToggle = card.status === "UNSOLD" || card.status === "DISABLED"

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8">
                        <span className="sr-only">打开菜单</span>
                        {actionLoading ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <MoreHorizontal className="size-4" />
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleCopy}>
                        <Copy className="mr-2 size-4" />
                        复制卡密
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setViewDialogOpen(true)}>
                        <Eye className="mr-2 size-4" />
                        查看完整内容
                    </DropdownMenuItem>
                    {!card.product.isFree && (
                        <DropdownMenuItem asChild>
                            <Link href={`/admin/products/${card.product.id}/cards`}>
                                <ExternalLink className="mr-2 size-4" />
                                前往商品卡密页
                            </Link>
                        </DropdownMenuItem>
                    )}
                    {canToggle && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleToggleStatus} disabled={actionLoading}>
                                {card.status === "UNSOLD" ? (
                                    <>
                                        <PowerOff className="mr-2 size-4" />
                                        停用
                                    </>
                                ) : (
                                    <>
                                        <CircleDot className="mr-2 size-4" />
                                        启用
                                    </>
                                )}
                            </DropdownMenuItem>
                        </>
                    )}
                    {canDelete && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setDeleteDialogOpen(true)}
                            >
                                <Trash2 className="mr-2 size-4" />
                                删除
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认删除</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要删除这条卡密吗？此操作无法撤销。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={actionLoading}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {actionLoading ? "删除中..." : "删除"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>完整卡密内容</DialogTitle>
                        <DialogDescription>
                            商品：{card.product.name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-md bg-muted p-4 font-mono text-sm break-all">
                        {card.content}
                    </div>
                    <Button onClick={handleCopy} variant="outline" className="w-full">
                        <Copy className="mr-2 size-4" />
                        复制到剪贴板
                    </Button>
                </DialogContent>
            </Dialog>
        </>
    )
}

// Compact inline actions for the order detail page (tooltip icon buttons)
export function CardCompactActions({
    cardId,
    content,
    status,
    productId,
}: {
    cardId: string
    content: string
    status: string
    productId: string
}) {
    const router = useRouter()
    const [copied, setCopied] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)

    const textToCopy = (() => {
        const parsed = parseAutoFetchCardContent(content)
        return parsed ? formatAutoFetchCardForCopy(parsed) : content
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
