"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useState } from "react"
import {
    MoreHorizontal,
    Pencil,
    CreditCard,
    Copy,
    Archive,
    RotateCcw,
    ExternalLink,
    Pin,
    PinOff,
    Trash2,
    ShieldOff,
    Loader2,
} from "lucide-react"
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
import { ProductBlacklistModal } from "./product-blacklist-modal"

type ProductRowActionsProps = {
    productId: string
    productName: string
    slug: string
    status: string
    productType: string
    isFree: boolean
    pinnedAt: string | null
}

export function ProductRowActions({
    productId,
    productName,
    slug,
    status,
    productType,
    isFree,
    pinnedAt,
}: ProductRowActionsProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [pinLoading, setPinLoading] = useState(false)
    const [statusDialogOpen, setStatusDialogOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [blacklistOpen, setBlacklistOpen] = useState(false)
    const isActive = status === "ACTIVE"
    const isPinned = !!pinnedAt
    const isAutoFetch = productType === "AUTO_FETCH"

    const copyLink = async () => {
        const url = `${window.location.origin}/products/${productId}-${slug}`
        await navigator.clipboard.writeText(url)
        toast.success("链接已复制")
    }

    const handleToggleStatus = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/products/${productId}`, {
                method: isActive ? "DELETE" : "PUT",
                ...(isActive
                    ? {}
                    : {
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "ACTIVE" }),
                      }),
            })
            if (res.ok) {
                setStatusDialogOpen(false)
                toast.success(isActive ? "商品已下架" : "商品已上架")
                router.refresh()
            }
        } catch {
            toast.error("操作失败")
        } finally {
            setLoading(false)
        }
    }

    const handleTogglePin = async () => {
        setPinLoading(true)
        try {
            const res = await fetch(`/api/products/${productId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pinned: !isPinned }),
            })
            if (res.ok) {
                toast.success(isPinned ? "已取消置顶" : "已置顶")
                router.refresh()
            }
        } catch {
            toast.error("操作失败")
        } finally {
            setPinLoading(false)
        }
    }

    const handleDelete = async () => {
        setDeleteLoading(true)
        try {
            const res = await fetch(`/api/products/${productId}?permanent=true`, {
                method: "DELETE",
            })
            if (res.ok) {
                setDeleteOpen(false)
                toast.success("商品已删除")
                router.refresh()
            } else if (res.status === 400) {
                const data = await res.json().catch(() => ({}))
                toast.error(data?.error ?? "该商品存在关联订单，无法删除")
            } else {
                toast.error("操作失败")
            }
        } catch {
            toast.error("操作失败")
        } finally {
            setDeleteLoading(false)
        }
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">操作菜单</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                        <Link href={`/admin/products/${productId}`}>
                            <Pencil className="size-4" />
                            编辑
                        </Link>
                    </DropdownMenuItem>
                    {!isAutoFetch && (
                        <DropdownMenuItem asChild>
                            <Link href={`/admin/products/${productId}/cards`}>
                                <CreditCard className="size-4" />
                                管理卡密
                            </Link>
                        </DropdownMenuItem>
                    )}
                    {isAutoFetch && (
                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setBlacklistOpen(true) }}>
                            <ShieldOff className="size-4" />
                            黑名单管理
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                        <a href={`/products/${productId}-${slug}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="size-4" />
                            预览
                        </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={copyLink}>
                        <Copy className="size-4" />
                        复制链接
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleTogglePin} disabled={pinLoading}>
                        {isPinned ? (
                            <>
                                <PinOff className="size-4" />
                                取消置顶
                            </>
                        ) : (
                            <>
                                <Pin className="size-4" />
                                置顶
                            </>
                        )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onSelect={(e) => { e.preventDefault(); setStatusDialogOpen(true) }}
                        className={isActive ? "text-destructive focus:text-destructive" : ""}
                    >
                        {isActive ? (
                            <>
                                <Archive className="size-4" />
                                下架
                            </>
                        ) : (
                            <>
                                <RotateCcw className="size-4" />
                                上架
                            </>
                        )}
                    </DropdownMenuItem>
                    {!isActive && (
                        <DropdownMenuItem
                            onSelect={(e) => { e.preventDefault(); setDeleteOpen(true) }}
                            className="text-destructive focus:text-destructive"
                        >
                            <Trash2 className="size-4" />
                            删除
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {isActive ? "下架商品" : "上架商品"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {isActive
                                ? `确定要下架「${productName}」吗？商品将从前台隐藏。`
                                : `确定要上架「${productName}」吗？商品将重新在前台展示。`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleToggleStatus}
                            disabled={loading}
                            className={isActive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
                        >
                            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                            {isActive ? "下架" : "上架"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>永久删除商品</AlertDialogTitle>
                        <AlertDialogDescription>
                            此操作不可恢复，商品及其所有卡密将被永久删除。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleteLoading}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleteLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {isAutoFetch && (
                <ProductBlacklistModal
                    productId={productId}
                    productName={productName}
                    open={blacklistOpen}
                    onOpenChange={setBlacklistOpen}
                />
            )}
        </>
    )
}
