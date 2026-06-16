"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useState } from "react"
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
import {
    MoreHorizontal,
    Pencil,
    Trash2,
    Loader2,
    Send,
    FileEdit,
    Archive,
} from "lucide-react"
import type { KnowledgeRow } from "./knowledge-columns"

export function KnowledgeRowActions({ row }: { row: KnowledgeRow }) {
    const router = useRouter()
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [busy, setBusy] = useState(false)

    const isPublished = row.status === "PUBLISHED"
    const isArchived = row.status === "ARCHIVED"

    const patchStatus = async (
        status: "DRAFT" | "PUBLISHED" | "ARCHIVED",
        successMsg: string,
    ) => {
        setBusy(true)
        try {
            const res = await fetch(`/api/admin/agent/knowledge/${row.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            })
            if (res.ok) {
                toast.success(successMsg)
                router.refresh()
            } else {
                const data = await res.json().catch(() => ({}))
                toast.error(data?.error ?? "操作失败")
            }
        } catch {
            toast.error("操作失败")
        } finally {
            setBusy(false)
        }
    }

    const handleDelete = async () => {
        setDeleting(true)
        try {
            const res = await fetch(`/api/admin/agent/knowledge/${row.id}`, {
                method: "DELETE",
            })
            if (res.ok) {
                setDeleteOpen(false)
                toast.success("知识条目已删除")
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
                        <Link href={`/admin/agent/knowledge/${row.id}`}>
                            <Pencil className="size-4" />
                            编辑
                        </Link>
                    </DropdownMenuItem>
                    {isPublished ? (
                        <DropdownMenuItem
                            disabled={busy}
                            onSelect={(e) => {
                                e.preventDefault()
                                patchStatus("DRAFT", "已撤回为草稿")
                            }}
                        >
                            {busy ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <FileEdit className="size-4" />
                            )}
                            撤回为草稿
                        </DropdownMenuItem>
                    ) : (
                        <DropdownMenuItem
                            disabled={busy}
                            onSelect={(e) => {
                                e.preventDefault()
                                patchStatus("PUBLISHED", "已发布")
                            }}
                        >
                            {busy ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <Send className="size-4" />
                            )}
                            发布
                        </DropdownMenuItem>
                    )}
                    {!isArchived && (
                        <DropdownMenuItem
                            disabled={busy}
                            onSelect={(e) => {
                                e.preventDefault()
                                patchStatus("ARCHIVED", "已归档")
                            }}
                        >
                            <Archive className="size-4" />
                            归档
                        </DropdownMenuItem>
                    )}
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
                        <AlertDialogTitle>删除知识条目</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要删除「{row.title}」吗？此操作不可恢复。
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
                            className="bg-destructive text-white hover:bg-destructive/90"
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
