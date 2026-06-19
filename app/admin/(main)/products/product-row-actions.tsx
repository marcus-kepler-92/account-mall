"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useInvalidateAdminNotifications } from "@/app/admin/hooks/use-admin-notifications"
import { useState } from "react"
import {
    MoreHorizontal,
    Pencil,
    Upload,
    Copy,
    CopyPlus,
    Archive,
    RotateCcw,
    ExternalLink,
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
import { BulkImportCards } from "./[productId]/cards/bulk-import-cards"

type ProductRowActionsProps = {
    productId: string
    productName: string
    slug: string
    status: string
    productType: string
    isFree: boolean
    isSuperAdmin?: boolean
    /** Prefilled into the import dialog's unit cost input. */
    defaultUnitCost?: number | null
    /** Current UNSOLD-card count, shown as restock context in the import dialog. */
    currentStock?: number | null
}

export function ProductRowActions({
    productId,
    productName,
    slug,
    status,
    productType,
    isFree,
    isSuperAdmin = false,
    defaultUnitCost = null,
    currentStock = null,
}: ProductRowActionsProps) {
    const router = useRouter()
    const invalidateNotifications = useInvalidateAdminNotifications()
    const [loading, setLoading] = useState(false)
    const [duplicateLoading, setDuplicateLoading] = useState(false)
    const [statusDialogOpen, setStatusDialogOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [blacklistOpen, setBlacklistOpen] = useState(false)
    const [importOpen, setImportOpen] = useState(false)
    const isActive = status === "ACTIVE"
    const isAutoFetch = productType === "AUTO_FETCH"
    const isManual = productType === "MANUAL"

    const handleDuplicate = async () => {
        setDuplicateLoading(true)
        try {
            const res = await fetch(`/api/products/${productId}/duplicate`, { method: "POST" })
            if (res.ok) {
                toast.success("商品已复制")
                router.refresh()
                invalidateNotifications()
            } else {
                const data = await res.json().catch(() => ({}))
                toast.error(data?.error ?? "复制失败")
            }
        } catch {
            toast.error("复制失败")
        } finally {
            setDuplicateLoading(false)
        }
    }

    const copyLink = async () => {
        const url = `${window.location.origin}/products/${slug}`
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
                invalidateNotifications()
            } else {
                const data = await res.json().catch(() => ({}))
                toast.error(data?.error ?? "操作失败")
            }
        } catch {
            toast.error("操作失败")
        } finally {
            setLoading(false)
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
                invalidateNotifications()
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
                    {!isAutoFetch && !isManual && (
                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setImportOpen(true) }}>
                            <Upload className="size-4" />
                            导入卡密
                        </DropdownMenuItem>
                    )}
                    {isAutoFetch && (
                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setBlacklistOpen(true) }}>
                            <ShieldOff className="size-4" />
                            黑名单管理
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                        <a href={`/products/${slug}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="size-4" />
                            预览
                        </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={copyLink}>
                        <Copy className="size-4" />
                        复制链接
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDuplicate} disabled={duplicateLoading}>
                        {duplicateLoading
                            ? <Loader2 className="size-4 animate-spin" />
                            : <CopyPlus className="size-4" />
                        }
                        复制商品
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
                    {!isActive && isSuperAdmin && (
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
                        <AlertDialogCancel disabled={loading}>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => { e.preventDefault(); handleToggleStatus() }}
                            disabled={loading}
                            className={isActive ? "bg-destructive text-white hover:bg-destructive/90" : ""}
                        >
                            {loading && <Loader2 className="size-4 animate-spin" />}
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
                        <AlertDialogCancel disabled={deleteLoading}>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => { e.preventDefault(); handleDelete() }}
                            disabled={deleteLoading}
                            className="bg-destructive text-white hover:bg-destructive/90"
                        >
                            {deleteLoading && <Loader2 className="size-4 animate-spin" />}
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

            {!isAutoFetch && !isManual && (
                <BulkImportCards
                    productId={productId}
                    defaultUnitCost={defaultUnitCost}
                    currentStock={currentStock}
                    open={importOpen}
                    onOpenChange={setImportOpen}
                />
            )}
        </>
    )
}
