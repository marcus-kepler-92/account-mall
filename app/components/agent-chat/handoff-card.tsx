"use client"

import Image from "next/image"
import { QrCode } from "lucide-react"

type Props = {
  // QR URL + wechat id resolved from SiteSetting DB row (with env fallback)
  // via /api/agent/session/start. Empty strings mean the admin hasn't
  // configured these yet — we degrade to a static QrCode placeholder.
  handoff: { qrUrl: string; wechatId: string }
}

export function HandoffCard({ handoff }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
      <p className="text-center text-sm">
        已为您转接人工客服，请扫码加客服并发送您的订单号给我们，
        我们会从后台查询您的对话和订单情况。
      </p>
      {handoff.qrUrl ? (
        <Image
          src={handoff.qrUrl}
          alt="客服二维码"
          width={168}
          height={168}
          unoptimized
          className="h-auto w-[168px] rounded"
        />
      ) : (
        <div className="flex h-[168px] w-[168px] flex-col items-center justify-center gap-1 rounded border bg-muted text-muted-foreground">
          <QrCode className="size-12" />
          <span className="text-xs">客服二维码暂未配置</span>
        </div>
      )}
      {handoff.wechatId && (
        <p className="text-center text-xs text-muted-foreground">
          微信号：<span className="font-mono">{handoff.wechatId}</span>
        </p>
      )}
    </div>
  )
}
