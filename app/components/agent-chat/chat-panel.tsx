"use client"

import { useEffect, useMemo, useState } from "react"
import { ulid } from "ulid"
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  type FeedbackAdapter,
} from "@assistant-ui/react"
import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk"
import { UserBubble, AssistantBubble, ComposerBar } from "./chat-wrappers"
import { WelcomeChips } from "./welcome-chips"
import { FallbackQR } from "./fallback-qr"
import { HandoffCard } from "./handoff-card"
import { getOrderHistory } from "@/lib/order-history-storage"

type FallbackReason = "daily-cap" | "timeout" | "budget"

const SESSION_KEY = "agent_session_id"

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return ""
  let id = window.localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = ulid()
    window.localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

// Customer-service QR + wechat id resolved at runtime by /api/agent/session/start
// (server reads SiteSetting DB row with env fallback). Used by FallbackQR and
// HandoffCard so admin-configured QR / wechat id flow through without
// touching /public/contact-qr.png.
type HandoffInfo = {
  qrUrl: string // may be "" when nothing's configured yet
  wechatId: string
}

export function ChatPanel() {
  // Initialize lazily on the client so SSR returns the same empty marker.
  const [sessionId, setSessionId] = useState<string>("")
  const [sessionReady, setSessionReady] = useState(false)
  const [orderHints, setOrderHints] = useState<string[]>([])
  const [handoff, setHandoff] = useState(false)
  const [handoffInfo, setHandoffInfo] = useState<HandoffInfo>({ qrUrl: "", wechatId: "" })
  const [fallback, setFallback] = useState<FallbackReason | null>(null)

  useEffect(() => {
    setSessionId(getOrCreateSessionId())
    // Pull recent order numbers from localStorage so the server can give the
    // AI immediate context ("you bought X recently") without making the user
    // re-state their order number. Capped at 5 — the API also re-caps and
    // server-side validates each against the Order table, so fabricated /
    // expired entries are silently dropped.
    const hints = getOrderHistory()
      .slice(0, 5)
      .map((o) => o.orderNo)
    setOrderHints(hints)
  }, [])

  // Provision the server-side AgentSession row before the user can send any
  // chat request. Without this gate, a fast click could race the request and
  // hit `/api/agent/chat` first → anti-abuse returns 410 session-expired
  // because the row doesn't exist yet. We wait for /session/start to settle
  // (or fail) before exposing the transport.
  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/agent/session/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        })
        if (res.ok) {
          // Pick up the runtime handoff info (QR URL + wechat id) so
          // FallbackQR / HandoffCard render the admin-configured values
          // rather than the legacy hard-coded /contact-qr.png.
          const data = (await res.json().catch(() => null)) as
            | { handoff?: HandoffInfo }
            | null
          if (!cancelled && data?.handoff) setHandoffInfo(data.handoff)
        }
      } catch {
        // Swallow network errors — the user can still try to chat; if the
        // session never landed they'll see a friendly fallback on the next
        // 410. Logging here would be noisy.
      } finally {
        if (!cancelled) setSessionReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  // Custom fetch intercepts HTTP fallback codes (423 budget, 503 daily-cap, 504 timeout)
  // before the AI SDK tries to stream the response.
  //
  // The transport is created as soon as we have a sessionId, even before
  // /session/start has settled. Returning `undefined` is unsafe: useChatRuntime
  // would fall back to the AI SDK default API path (`/api/chat`), causing the
  // first request to 404 if the user clicks a chip during the brief
  // provisioning window. Session-readiness is enforced via the UI instead
  // (WelcomeChips and ComposerBar disable themselves until sessionReady).
  const transport = useMemo(() => {
    if (!sessionId) return undefined
    return new AssistantChatTransport({
      api: "/api/agent/chat",
      body: { sessionId, orderHints },
      fetch: async (input, init) => {
        const res = await fetch(input as RequestInfo, init)
        if (res.status === 423) setFallback("budget")
        else if (res.status === 503) setFallback("daily-cap")
        else if (res.status === 504) setFallback("timeout")
        return res
      },
    })
  }, [sessionId, orderHints])

  const feedback: FeedbackAdapter = useMemo(
    () => ({
      submit: ({ message, type }) => {
        void fetch("/api/agent/message-feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId: message.id,
            value: type === "positive" ? "up" : "down",
          }),
        }).catch(() => {})
      },
    }),
    [],
  )

  const runtime = useChatRuntime({
    transport,
    adapters: { feedback },
    onToolCall: ({ toolCall }) => {
      if (toolCall.toolName === "escalateToHuman") setHandoff(true)
    },
  })

  if (fallback) return <FallbackQR reason={fallback} handoff={handoffInfo} />
  if (handoff) return <HandoffCard handoff={handoffInfo} />

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="flex h-full flex-col">
        <ThreadPrimitive.Viewport
          autoScroll
          className="min-h-0 flex-1 overflow-y-auto px-2"
        >
          <ThreadPrimitive.Empty>
            <WelcomeChips />
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages
            components={{
              UserMessage: UserBubble,
              AssistantMessage: AssistantBubble,
            }}
          />
        </ThreadPrimitive.Viewport>
        <ComposerBar />
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  )
}
