"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
import { Loader2, Pencil, Trash2 } from "lucide-react"
import { PayoutFormDialog } from "./payout-form-dialog"
import type { PayoutRow } from "./payout-columns"

export function PayoutRowActions({ row }: { row: PayoutRow }) {
    const router = useRouter()
    const [editOpen, setEditOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const handleDelete = async () => {
        setDeleting(true)
        try {
            const res = await fetch(`/api/admin/payouts/${row.id}`, { method: "DELETE" })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                toast.error(err?.error ?? "删除失败")
                return
            }
            setDeleteOpen(false)
            toast.success("已删除")
            router.refresh()
        } catch {
            toast.error("删除失败")
        } finally {
            setDeleting(false)
        }
    }

    return (
        <>
            <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditOpen(true)}>
                    <Pencil className="size-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteOpen(true)}
                >
                    <Trash2 className="size-4" />
                </Button>
            </div>

            <PayoutFormDialog open={editOpen} onOpenChange={setEditOpen} payout={row} />

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>删除提现记录</AlertDialogTitle>
                        <AlertDialogDescription>
                            确认删除该提现记录？删除后余额将相应恢复。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={deleting}
                            onClick={(e) => { e.preventDefault(); handleDelete() }}
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
