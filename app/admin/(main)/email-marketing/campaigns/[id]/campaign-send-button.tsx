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
import { Send, Loader2 } from "lucide-react"

type Props = {
  campaignId: string
  recipientCount: number
  status: "DRAFT" | "SENDING" | "SENT" | "FAILED"
}

export function CampaignSendButton({ campaignId, recipientCount, status }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [resetting, setResetting] = useState(false)

  const handleReset = async () => {
    setResetting(true)
    try {
      const res = await fetch(`/api/admin/email-marketing/campaigns/${campaignId}`, {
        method: "PATCH",
      })
      if (res.ok) {
        toast.success("已重置为草稿")
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? "重置失败")
      }
    } catch {
      toast.error("重置失败")
    } finally {
      setResetting(false)
    }
  }

  const handleSend = async () => {
    setSending(true)
    try {
      const res = await fetch(`/api/admin/email-marketing/campaigns/${campaignId}/send`, {
        method: "POST",
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(`发送完成，成功 ${data.successCount} / 失败 ${data.failCount}`)
        router.refresh()
      } else {
        toast.error(data?.error ?? "发送失败")
      }
    } catch {
      toast.error("发送失败")
    } finally {
      setSending(false)
      setOpen(false)
    }
  }

  if (status === "SENDING" || status === "FAILED") {
    return (
      <Button size="sm" variant="outline" onClick={handleReset} disabled={resetting}>
        {resetting && <Loader2 className="size-4 animate-spin" />}
        重置为草稿
      </Button>
    )
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={recipientCount === 0}>
        <Send className="size-4" />
        {recipientCount === 0 ? "无收件人" : "发送活动"}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认发送</AlertDialogTitle>
            <AlertDialogDescription>
              即将向 <strong>{recipientCount} 位</strong>收件人发送邮件，发送后无法撤销。
              <br />
              <span className="text-xs mt-2 block text-muted-foreground">
                注意：Resend 免费版配额 100 封/天、3000 封/月
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleSend() }}
              disabled={sending}
            >
              {sending && <Loader2 className="size-4 animate-spin" />}
              确认发送给 {recipientCount} 位收件人
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
