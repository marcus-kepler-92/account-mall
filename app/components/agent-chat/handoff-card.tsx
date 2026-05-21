"use client"

import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { QrImage } from "./qr-image"

type Props = {
  // QR URL + wechat id resolved from SiteSetting DB row (with env fallback)
  // via /api/agent/session/start. Empty strings mean the admin hasn't
  // configured these yet — QrImage degrades to a static placeholder.
  handoff: { qrUrl: string; wechatId: string }
  // Lets the user dismiss the QR and return to chat. Without this, a
  // successful escalate_to_human permanently replaces the chat UI for
  // the lifetime of this ChatPanel mount, making "二次人工二维码拉起"
  // impossible — nobody can type to ask AI to re-render the QR.
  onBackToChat?: () => void
}

export function HandoffCard({ handoff, onBackToChat }: Props) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-3 p-4">
      {onBackToChat && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onBackToChat}
          className="absolute left-2 top-2 h-8 gap-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          返回聊天
        </Button>
      )}
      <p className="text-center text-sm">
        已为您转接人工客服，请扫码加客服并发送您的订单号给我们，
        我们会从后台查询您的对话和订单情况。
      </p>
      <QrImage src={handoff.qrUrl} />
      {handoff.wechatId && (
        <p className="text-center text-xs text-muted-foreground">
          微信号：<span className="font-mono">{handoff.wechatId}</span>
        </p>
      )}
    </div>
  )
}
