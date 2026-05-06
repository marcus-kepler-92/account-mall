"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Trash2, Loader2 } from "lucide-react"
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
import { EditMilestoneDialog } from "./edit-milestone-dialog"

type Props = { id: string; thresholdAmount: number; bonusAmount: number }

export function InvitationMilestoneRowActions({ id, thresholdAmount, bonusAmount }: Props) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const handleDelete = async () => {
        setDeleting(true)
        try {
            const res = await fetch(`/api/admin/invitation-milestones/${id}`, { method: "DELETE" })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                toast.error(err?.error ?? "删除失败")
                return
            }
            setOpen(false)
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
                <EditMilestoneDialog id={id} thresholdAmount={thresholdAmount} bonusAmount={bonusAmount} />
                <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setOpen(true)}
                >
                    <Trash2 className="size-4" />
                    删除
                </Button>
            </div>
            <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认删除</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要删除此里程碑档位吗？若已有奖励发放记录，删除将被拒绝。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={deleting}
                            onClick={(e) => {
                                e.preventDefault()
                                handleDelete()
                            }}
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
