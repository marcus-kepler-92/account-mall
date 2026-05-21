"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import type { UIMessage } from "ai"
import { Loader2 } from "lucide-react"
import { UserBubble, AssistantBubble, ComposerBar } from "./chat-wrappers"
import { WelcomeChips } from "./welcome-chips"
import { FallbackQR } from "./fallback-qr"
import { HandoffCard } from "./handoff-card"
import { getOrderHistory } from "@/lib/order-history-storage"

type FallbackReason = "daily-cap" | "timeout" | "budget"

const SESSION_KEY = "agent_session_id"

// Tab-scoped: same tab keeps the same session across in-site navigation,
// closing the tab (or opening a new one) starts a fresh session. This
// matches "每次重新进入平台 = 一次新会话" — was previously localStorage,
// which meant one browser kept one session forever.
function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return ""
  let id = window.sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = ulid()
    window.sessionStorage.setItem(SESSION_KEY, id)
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
  const [historyReady, setHistoryReady] = useState(false)
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([])
  const [orderHints, setOrderHints] = useState<string[]>([])
  const [handoff, setHandoff] = useState(false)
  const [handoffInfo, setHandoffInfo] = useState<HandoffInfo>({ qrUrl: "", wechatId: "" })
  const [fallback, setFallback] = useState<FallbackReason | null>(null)
  // Stable identity so the inner runtime-watcher effect doesn't tear down
  // on every parent render (would otherwise reset its "already fired"
  // guard and double-trigger the handoff card).
  const handleHandoff = useCallback(() => setHandoff(true), [])

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

  // Fetch persisted chat history (AgentMessage rows) for this session and
  // hydrate the runtime via useChatRuntime({ messages }). This is how the
  // widget remembers the conversation after the user closes & reopens the
  // FAB popup — Radix unmounts the popover children so in-memory runtime
  // state is gone, but the server-side AgentMessage table is the source
  // of truth. We block runtime creation on history readiness so the AI
  // SDK only builds its internal state once with the correct messages.
  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(
          `/api/agent/messages?sessionId=${encodeURIComponent(sessionId)}`,
        )
        if (res.ok) {
          const data = (await res.json().catch(() => null)) as
            | { messages?: UIMessage[] }
            | null
          if (!cancelled && Array.isArray(data?.messages)) {
            setInitialMessages(data.messages)
          }
        }
      } catch {
        // Empty history on error — widget still works, user just starts fresh.
      } finally {
        if (!cancelled) setHistoryReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  // Fallback (budget / daily-cap / timeout) is a terminal state — AI can't
  // recover, so we replace the chat entirely and let HMR / session reset
  // be the way back.
  if (fallback) return <FallbackQR reason={fallback} handoff={handoffInfo} />

  // Block mounting the AI SDK runtime until BOTH the session row exists
  // and the history fetch has settled. The runtime captures `messages` as
  // initial state once on first render — flipping `messages` after the
  // fact would have no effect (which is what burned us on the earlier
  // attempt). The loading flash is ~300ms on warm cache.
  if (!sessionId || !sessionReady || !historyReady) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    )
  }

  // HandoffCard is rendered as an OVERLAY on top of ChatPanelInner —
  // never replacing it — so the runtime's in-memory message state
  // survives the user clicking "返回聊天" and coming back. Previous
  // implementation unmounted ChatPanelInner whenever handoff=true,
  // throwing away every message exchanged after the initial history
  // hydration; on dismiss, the chat would only show the stale
  // initialMessages snapshot.
  return (
    <div className="relative h-full">
      <ChatPanelInner
        sessionId={sessionId}
        orderHints={orderHints}
        initialMessages={initialMessages}
        onHandoff={handleHandoff}
        onFallback={setFallback}
      />
      {handoff && (
        <div className="absolute inset-0 bg-background">
          <HandoffCard
            handoff={handoffInfo}
            onBackToChat={() => setHandoff(false)}
          />
        </div>
      )}
    </div>
  )
}

// Inner component — mounted only after sessionReady + historyReady so the
// runtime's `messages` initial state is correct on first render. Lifted out
// so the runtime hook isn't created until we have everything we need; any
// hook-level early return in the parent would have violated the rules of
// hooks (useChatRuntime / useMemo orderings would shift).
type InnerProps = {
  sessionId: string
  orderHints: string[]
  initialMessages: UIMessage[]
  onHandoff: () => void
  onFallback: (reason: FallbackReason) => void
}
function ChatPanelInner({
  sessionId,
  orderHints,
  initialMessages,
  onHandoff,
  onFallback,
}: InnerProps) {
  // Custom fetch intercepts HTTP fallback codes (423 budget, 503 daily-cap,
  // 504 timeout) before the AI SDK tries to stream the response.
  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: "/api/agent/chat",
        body: { sessionId, orderHints },
        fetch: async (input, init) => {
          const res = await fetch(input as RequestInfo, init)
          if (res.status === 423) onFallback("budget")
          else if (res.status === 503) onFallback("daily-cap")
          else if (res.status === 504) onFallback("timeout")
          return res
        },
      }),
    [sessionId, orderHints, onFallback],
  )

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
    messages: initialMessages.length > 0 ? initialMessages : undefined,
    adapters: { feedback },
  })

  // Trigger the handoff card only when escalate_to_human's result says
  // `renderQr: true`. Three cases the server distinguishes:
  //   - customer_support + verified orderNo → renderQr: true
  //   - business_inquiry → renderQr: true (合作咨询绕过订单号)
  //   - customer_support + no/bogus orderNo → renderQr: false; AI re-asks
  //
  // Seeding behavior: on first run we mark every escalate_to_human
  // already present in the hydrated history as "fired". Without this,
  // a reopened chat (sessionStorage preserves the sessionId; history is
  // re-fetched on mount) would auto-replay the QR card every time the
  // user comes back, preventing them from continuing the conversation
  // even after they dismissed the QR. With seeding, only NEW tool
  // calls made post-mount trigger the card.
  const firedForRef = useRef<Set<string>>(new Set())
  const seededRef = useRef(false)
  useEffect(() => {
    const check = () => {
      const messages = runtime.thread.getState().messages

      if (!seededRef.current) {
        seededRef.current = true
        for (const m of messages) {
          if (m.role !== "assistant") continue
          for (const part of m.content) {
            if (
              part.type === "tool-call" &&
              part.toolName === "escalateToHuman"
            ) {
              firedForRef.current.add(part.toolCallId)
            }
          }
        }
        return
      }

      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i]
        if (m.role !== "assistant") continue
        for (const part of m.content) {
          if (part.type !== "tool-call") continue
          if (part.toolName !== "escalateToHuman") continue
          // Skip until the result lands; dedupe by toolCallId so the
          // same call doesn't fire twice on subsequent thread updates.
          if (part.result === undefined || part.isError) return
          if (firedForRef.current.has(part.toolCallId)) return
          const result = part.result as { renderQr?: boolean }
          if (result?.renderQr !== true) return
          firedForRef.current.add(part.toolCallId)
          onHandoff()
          return
        }
      }
    }
    check()
    return runtime.thread.subscribe(check)
  }, [runtime, onHandoff])

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
