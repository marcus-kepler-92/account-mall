"use client"

import { QrImage } from "./qr-image"

// daily-cap / timeout 都属于"服务端不可用"语义, 文案统一为中性
// "暂时不可用", 不暗示具体原因 (避免在配置错误时骗用户说"额度满"). 真实
// 原因从服务端 console.error 看. budget 是"该用户的单会话额度用尽", 用户
// 视角真实状态, 保留特别文案.
const COPY: Record<"daily-cap" | "timeout" | "budget", string> = {
  "daily-cap": "AI 客服暂时不可用，请扫码加企微人工跟进。",
  timeout: "AI 客服暂时不可用，请扫码加企微人工跟进。",
  budget: "本次咨询次数已用完，请扫码加企微继续。",
}

type Props = {
  reason: "daily-cap" | "timeout" | "budget"
  // QR URL + wechat id resolved from SiteSetting DB row (with env fallback)
  // via /api/agent/session/start. Empty strings mean the admin hasn't
  // configured these yet — QrImage degrades to a static placeholder.
  handoff: { qrUrl: string; wechatId: string }
}

export function FallbackQR({ reason, handoff }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
      <p className="text-center text-sm text-muted-foreground">{COPY[reason]}</p>
      <QrImage src={handoff.qrUrl} />
      {handoff.wechatId && (
        <p className="text-center text-xs text-muted-foreground">
          微信号：<span className="font-mono">{handoff.wechatId}</span>
        </p>
      )}
    </div>
  )
}
