"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { useInvalidateAdminNotifications } from "@/app/admin/hooks/use-admin-notifications"

type LeadStatus =
    | "PENDING_CONTACT"
    | "NEW"
    | "CONTACTED"
    | "RESOLVED"
    | "DROPPED"

const NEXT: Record<LeadStatus, LeadStatus[]> = {
    PENDING_CONTACT: ["CONTACTED", "DROPPED"],
    NEW: ["CONTACTED"],
    CONTACTED: ["RESOLVED", "DROPPED"],
    RESOLVED: [],
    DROPPED: [],
}

const LABEL: Record<LeadStatus, string> = {
    PENDING_CONTACT: "待补充",
    NEW: "待跟进",
    CONTACTED: "已联系",
    RESOLVED: "已解决",
    DROPPED: "已放弃",
}

const VARIANT: Record<
    LeadStatus,
    "default" | "secondary" | "outline" | "destructive"
> = {
    PENDING_CONTACT: "outline",
    NEW: "default",
    CONTACTED: "default",
    RESOLVED: "default",
    DROPPED: "destructive",
}

interface LeadStatusFormProps {
    leadId: string
    currentStatus: LeadStatus
    initialNotes: string
}

export function LeadStatusForm({
    leadId,
    currentStatus,
    initialNotes,
}: LeadStatusFormProps) {
    const router = useRouter()
    const invalidateNotifications = useInvalidateAdminNotifications()
    const [notes, setNotes] = useState(initialNotes)
    const [savingNotes, setSavingNotes] = useState(false)
    const [pendingStatus, setPendingStatus] = useState<LeadStatus | null>(null)

    const allowedNext = NEXT[currentStatus]

    const patch = async (payload: { status?: LeadStatus; notes?: string }) => {
        const res = await fetch(`/api/admin/agent/leads/${leadId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        })
        if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error(data?.error ?? "操作失败")
        }
    }

    const handleSaveNotes = async () => {
        setSavingNotes(true)
        try {
            await patch({ notes })
            toast.success("备注已保存")
            router.refresh()
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "操作失败")
        } finally {
            setSavingNotes(false)
        }
    }

    const handleStatusChange = async (next: LeadStatus) => {
        setPendingStatus(next)
        try {
            await patch({ status: next })
            toast.success(`状态已更新为「${LABEL[next]}」`)
            router.refresh()
            invalidateNotifications()
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "操作失败")
        } finally {
            setPendingStatus(null)
        }
    }

    return (
        <div className="space-y-5">
            <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">当前状态</Label>
                <p className="text-sm font-medium">{LABEL[currentStatus]}</p>
            </div>

            {allowedNext.length > 0 ? (
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">流转到</Label>
                    <div className="flex flex-wrap gap-2">
                        {allowedNext.map((s) => (
                            <Button
                                key={s}
                                size="sm"
                                variant={VARIANT[s]}
                                disabled={pendingStatus !== null}
                                onClick={() => handleStatusChange(s)}
                            >
                                {pendingStatus === s && (
                                    <Loader2 className="size-4 animate-spin" />
                                )}
                                {LABEL[s]}
                            </Button>
                        ))}
                    </div>
                </div>
            ) : (
                <p className="text-xs text-muted-foreground">该状态为终态，不可继续流转</p>
            )}

            <div className="space-y-2">
                <Label htmlFor="notes" className="text-xs text-muted-foreground">
                    跟进备注
                </Label>
                <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="记录联系结果、客户反馈等"
                    rows={6}
                    maxLength={2000}
                />
                <Button
                    size="sm"
                    onClick={handleSaveNotes}
                    disabled={savingNotes || notes === initialNotes}
                >
                    {savingNotes && <Loader2 className="size-4 animate-spin" />}
                    保存备注
                </Button>
            </div>
        </div>
    )
}
