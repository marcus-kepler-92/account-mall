"use client"

import { QrImage } from "./qr-image"

type Props = {
  // QR URL + wechat id resolved from SiteSetting DB row (with env fallback)
  // via /api/agent/session/start. Empty strings mean the admin hasn't
  // configured these yet — QrImage degrades to a static placeholder.
  handoff: { qrUrl: string; wechatId: string }
}

export function HandoffCard({ handoff }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
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
