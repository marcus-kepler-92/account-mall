"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    MoreHorizontal,
    Pencil,
    CreditCard,
    Copy,
    Archive,
    RotateCcw,
    ExternalLink,
} from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import { useState } from "react"

type ProductRowActionsProps = {
    productId: string
    productName: string
    slug: string
    status: string
}

export function ProductRowActions({
    productId,
    productName,
    slug,
    status,
}: ProductRowActionsProps) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const isActive = status === "ACTIVE"

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
                setOpen(false)
                toast.success(isActive ? "商品已下架" : "商品已上架")
                router.refresh()
            }
        } catch {
            toast.error("操作失败")
        } finally {
            setLoading(false)
        }
    }

    return (
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
                <DropdownMenuItem asChild>
                    <Link href={`/admin/products/${productId}/cards`}>
                        <CreditCard className="size-4" />
                        管理卡密
                    </Link>
                </DropdownMenuItem>
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
                <DropdownMenuSeparator />
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <DropdownMenuItem
                            onSelect={(e) => e.preventDefault()}
                            className={isActive ? "text-destructive" : ""}
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
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {isActive ? "下架商品" : "上架商品"}
                            </DialogTitle>
                            <DialogDescription>
                                {isActive
                                    ? `确定要下架「${productName}」吗？商品将从前台隐藏。`
                                    : `确定要上架「${productName}」吗？商品将重新在前台展示。`}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setOpen(false)}>
                                取消
                            </Button>
                            <Button
                                variant={isActive ? "destructive" : "default"}
                                onClick={handleToggleStatus}
                                disabled={loading}
                            >
                                {loading && <Loader2 className="size-4 animate-spin" />}
                                {isActive ? "下架" : "上架"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
