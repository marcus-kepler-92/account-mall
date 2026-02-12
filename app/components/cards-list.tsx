"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Eye, EyeOff, Loader2, Trash2 } from "lucide-react"

type CardItem = {
    id: string
    content: string
    status: string
    orderNo: string | null
    createdAt: string
}

type CardsListProps = {
    productId: string
    cards: CardItem[]
    stats: { UNSOLD: number; RESERVED: number; SOLD: number }
}

const MASK_LEN = 8

function maskContent(content: string) {
    if (content.length <= MASK_LEN) return content
    return content.slice(0, MASK_LEN) + "***"
}

const statusLabel: Record<string, string> = {
    UNSOLD: "未售",
    RESERVED: "预占中",
    SOLD: "已售",
}

export function CardsList({ productId, cards, stats }: CardsListProps) {
    const router = useRouter()
    const [statusFilter, setStatusFilter] = useState<"all" | "UNSOLD" | "RESERVED" | "SOLD">("all")
    const [deleteTarget, setDeleteTarget] = useState<CardItem | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set())

    const filteredCards = useMemo(() => {
        if (statusFilter === "all") return cards
        return cards.filter((c) => c.status === statusFilter)
    }, [cards, statusFilter])

    const toggleReveal = (id: string) => {
        setRevealedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const handleDelete = async () => {
        if (!deleteTarget) return
        setDeleteLoading(true)
        try {
            const res = await fetch(`/api/cards/${deleteTarget.id}`, { method: "DELETE" })
            if (!res.ok) {
                const data = await res.json()
                toast.error(data.error || "删除失败")
                return
            }
            setDeleteTarget(null)
            toast.success("卡密已删除")
            router.refresh()
        } catch {
            toast.error("删除失败")
        } finally {
            setDeleteLoading(false)
        }
    }

    const filterOptions = [
        { label: "全部", value: "all" as const },
        { label: "未售", value: "UNSOLD" as const },
        { label: "预占中", value: "RESERVED" as const },
        { label: "已售", value: "SOLD" as const },
    ]

    return (
        <>
            <div className="space-y-4">
                {/* Status filter tabs */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground mr-1">状态：</span>
                    {filterOptions.map((opt) => (
                        <Button
                            key={opt.value}
                            variant={statusFilter === opt.value ? "default" : "outline"}
                            size="sm"
                            onClick={() => setStatusFilter(opt.value)}
                        >
                            {opt.label}
                        </Button>
                    ))}
                </div>

                {/* Desktop: Table */}
                <div className="hidden md:block rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>卡密内容</TableHead>
                                <TableHead>状态</TableHead>
                                <TableHead>关联订单</TableHead>
                                <TableHead>创建时间</TableHead>
                                <TableHead className="text-right w-20">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredCards.map((c) => {
                                const showFull = revealedIds.has(c.id)
                                const displayContent = showFull ? c.content : maskContent(c.content)
                                return (
                                    <TableRow key={c.id}>
                                        <TableCell className="font-mono text-sm">
                                            <span className="break-all">{displayContent}</span>
                                            {c.content.length > MASK_LEN && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-6 ml-1 align-middle"
                                                    onClick={() => toggleReveal(c.id)}
                                                    aria-label={showFull ? "隐藏" : "显示完整"}
                                                >
                                                    {showFull ? (
                                                        <EyeOff className="size-3.5" />
                                                    ) : (
                                                        <Eye className="size-3.5" />
                                                    )}
                                                </Button>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    c.status === "UNSOLD"
                                                        ? "secondary"
                                                        : c.status === "RESERVED"
                                                          ? "outline"
                                                          : "default"
                                                }
                                            >
                                                {statusLabel[c.status] ?? c.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {c.orderNo ?? "—"}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {new Date(c.createdAt).toLocaleString("zh-CN")}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {c.status === "UNSOLD" && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-8 text-destructive hover:text-destructive"
                                                    onClick={() => setDeleteTarget(c)}
                                                    aria-label="删除"
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                    {filteredCards.length === 0 && (
                        <div className="py-8 text-center text-muted-foreground text-sm">
                            {statusFilter === "all" ? "暂无卡密" : `当前筛选条件下暂无卡密`}
                        </div>
                    )}
                </div>

                {/* Mobile: Cards */}
                <div className="md:hidden space-y-3">
                    {filteredCards.map((c) => {
                        const showFull = revealedIds.has(c.id)
                        const displayContent = showFull ? c.content : maskContent(c.content)
                        return (
                            <Card key={c.id}>
                                <CardContent className="pt-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="font-mono text-sm break-all flex items-center gap-1">
                                                {displayContent}
                                                {c.content.length > MASK_LEN && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-6 shrink-0"
                                                        onClick={() => toggleReveal(c.id)}
                                                    >
                                                        {showFull ? (
                                                            <EyeOff className="size-3.5" />
                                                        ) : (
                                                            <Eye className="size-3.5" />
                                                        )}
                                                    </Button>
                                                )}
                                            </p>
                                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                                                <Badge
                                                    variant={
                                                        c.status === "UNSOLD"
                                                            ? "secondary"
                                                            : c.status === "RESERVED"
                                                              ? "outline"
                                                              : "default"
                                                    }
                                                >
                                                    {statusLabel[c.status] ?? c.status}
                                                </Badge>
                                                {c.orderNo && (
                                                    <span className="text-xs text-muted-foreground">
                                                        订单: {c.orderNo}
                                                    </span>
                                                )}
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(c.createdAt).toLocaleString("zh-CN")}
                                                </span>
                                            </div>
                                        </div>
                                        {c.status === "UNSOLD" && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="size-8 shrink-0 text-destructive"
                                                onClick={() => setDeleteTarget(c)}
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                    {filteredCards.length === 0 && (
                        <div className="py-8 text-center text-muted-foreground text-sm">
                            {statusFilter === "all" ? "暂无卡密" : "当前筛选条件下暂无卡密"}
                        </div>
                    )}
                </div>
            </div>

            {/* Delete confirmation dialog */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>删除卡密</DialogTitle>
                        <DialogDescription>
                            确定要删除这条未售卡密吗？此操作不可恢复。
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteTarget(null)}
                        >
                            取消
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={deleteLoading}
                        >
                            {deleteLoading && <Loader2 className="size-4 animate-spin" />}
                            删除
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
