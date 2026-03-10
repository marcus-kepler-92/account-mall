"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
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
import { MoreHorizontal, Pencil, Trash2, Loader2, Send, FileEdit } from "lucide-react"
import { useState } from "react"

type GuideRowActionsProps = {
    id: string
    title: string
    status: string
}

export function GuideRowActions({ id, title, status }: GuideRowActionsProps) {
    const router = useRouter()
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [toggling, setToggling] = useState(false)
    const isPublished = status === "PUBLISHED"

    const handleToggleStatus = async () => {
        setToggling(true)
        try {
            const newStatus = isPublished ? "DRAFT" : "PUBLISHED"
            const res = await fetch(`/api/admin/guides/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            })
            if (res.ok) {
                toast.success(newStatus === "PUBLISHED" ? "已发布" : "已转为草稿")
                router.refresh()
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
            const res = await fetch(`/api/admin/guides/${id}`, { method: "DELETE" })
            if (res.ok) {
                setDeleteOpen(false)
                toast.success("指南已删除")
                router.refresh()
            } else {
                const data = await res.json().catch(() => ({}))
                toast.error(data?.error ?? "删除失败")
            }
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
                    <DropdownMenuItem asChild>
                        <Link href={`/admin/guides/${id}`}>
                            <Pencil className="size-4" />
                            编辑
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        disabled={toggling}
                        onSelect={(e) => {
                            e.preventDefault()
                            handleToggleStatus()
                        }}
                    >
                        {toggling ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : isPublished ? (
                            <FileEdit className="size-4" />
                        ) : (
                            <Send className="size-4" />
                        )}
                        {isPublished ? "转为草稿" : "发布"}
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

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>删除指南</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要删除「{title}」吗？此操作不可恢复。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault()
                                handleDelete()
                            }}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting && <Loader2 className="size-4 animate-spin" />}
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
