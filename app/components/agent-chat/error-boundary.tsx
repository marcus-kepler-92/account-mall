"use client"

import { Component, type ReactNode } from "react"
import { configClient } from "@/lib/config-client"
import { QrImage } from "./qr-image"

type Props = { children: ReactNode }
type State = { hasError: boolean }

// Last-resort safety net for any uncaught render error inside ChatPanel
// (runtime hook crash, child component throw, etc.). Without this, the
// whole Popover content would render React's default error screen and
// the user would have no way to reach human support.
//
// Fallback intentionally does NOT depend on ChatPanel's runtime state
// (handoffInfo from /session/start) — that state is gone the moment we
// land here. The QR src is empty → QrImage degrades to the standard
// "客服二维码暂未配置" placeholder, and supportWechat from env (with
// a default value) still gives the user a copyable contact string.
export class ChatPanelErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error("[agent-chat] ChatPanel render crashed:", error)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
        <p className="text-center text-sm text-muted-foreground">
          AI 客服暂时不可用，请扫码加企微人工跟进。
        </p>
        <QrImage src="" />
        {configClient.supportWechat && (
          <p className="text-center text-xs text-muted-foreground">
            微信号：<span className="font-mono">{configClient.supportWechat}</span>
          </p>
        )}
      </div>
    )
  }
}
