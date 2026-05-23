"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
    MoreHorizontal,
    Pencil,
    Trash2,
    Loader2,
    Power,
    PowerOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
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
import { VariantFormDialog } from "./variant-form-dialog"
import type { VariantRow } from "./variants-section"

type Props = {
    productId: string
    variant: VariantRow
    onChanged?: () => void
}

export function VariantRowActions({ productId, variant, onChanged }: Props) {
    const [editOpen, setEditOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [toggling, setToggling] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const handleToggleActive = async () => {
        setToggling(true)
        try {
            const res = await fetch(
                `/api/admin/products/${productId}/variants/${variant.id}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ isActive: !variant.isActive }),
                }
            )
            if (res.ok) {
                toast.success(variant.isActive ? "已停用" : "已启用")
                onChanged?.()
            } else {
                const data = await res.json().catch(() => ({}))
                toast.error(data?.error ?? "操作失败")
            }
        } catch {
            toast.error("操作失败")
        } finally {
            setToggling(false)
        }
    }

    const handleDelete = async () => {
        setDeleting(true)
        try {
            const res = await fetch(
                `/api/admin/products/${productId}/variants/${variant.id}`,
                { method: "DELETE" }
            )
            if (res.ok) {
                setDeleteOpen(false)
                toast.success("SKU 已删除")
                onChanged?.()
                return
            }
            if (res.status === 409) {
                toast.error("存在关联订单，请改为停用")
            } else {
                const data = await res.json().catch(() => ({}))
                toast.error(data?.error ?? "删除失败")
            }
            setDeleteOpen(false)
        } catch {
            toast.error("删除失败")
        } finally {
            setDeleting(false)
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
                    <DropdownMenuItem
                        onSelect={(e) => {
                            e.preventDefault()
                            setEditOpen(true)
                        }}
                    >
                        <Pencil className="size-4" />
                        编辑
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        disabled={toggling}
                        onSelect={(e) => {
                            e.preventDefault()
                            handleToggleActive()
                        }}
                    >
                        {toggling ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : variant.isActive ? (
                            <PowerOff className="size-4" />
                        ) : (
                            <Power className="size-4" />
                        )}
                        {variant.isActive ? "停用" : "启用"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={(e) => {
                            e.preventDefault()
                            setDeleteOpen(true)
                        }}
                    >
                        <Trash2 className="size-4" />
                        删除
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <VariantFormDialog
                productId={productId}
                mode="edit"
                variant={variant}
                open={editOpen}
                onOpenChange={setEditOpen}
                onSuccess={onChanged}
            />

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>删除 SKU</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要删除「{variant.name}」吗？此操作不可恢复。如果该
                            SKU 已有关联订单，将无法删除——可改为停用。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>
                            取消
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault()
                                handleDelete()
                            }}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting && (
                                <Loader2 className="size-4 animate-spin" />
                            )}
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
