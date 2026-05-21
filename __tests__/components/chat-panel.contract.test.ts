/**
 * Contract test for app/components/agent-chat/chat-panel.tsx.
 *
 * Why this file exists:
 *   Returning `undefined` from the `transport` useMemo causes useChatRuntime
 *   to fall back to the AI SDK's default API path (`/api/chat`), which our
 *   backend doesn't serve — every first user message during the brief
 *   /session/start provisioning window 404s. This was hit and fixed once;
 *   this test pins the contract so a future refactor doesn't reintroduce it.
 *
 *   Source-level rather than mount-level because ChatPanel pulls in the
 *   full @assistant-ui runtime, AI SDK chat transport, and a Vercel BotID
 *   client — mocking all of that is more brittle than asserting on the
 *   memoized factory's actual return shape.
 */
import { readFileSync } from "fs"
import { join } from "path"

const SOURCE = readFileSync(
    join(__dirname, "../../app/components/agent-chat/chat-panel.tsx"),
    "utf8",
)

describe("ChatPanel transport contract", () => {
    it("constructs AssistantChatTransport pointing at /api/agent/chat", () => {
        // The factory must instantiate a transport with our backend's path.
        // If anyone changes the api literal, the next session-bound request
        // would silently 404 against AI SDK's /api/chat default.
        expect(SOURCE).toMatch(/new AssistantChatTransport\(\{[\s\S]*?api:\s*"\/api\/agent\/chat"/)
    })

    it("does not return undefined merely because sessionReady is false", () => {
        // The earlier `if (!sessionId || !sessionReady) return undefined`
        // form caused /api/chat fallback. We now gate on sessionId only and
        // disable the UI separately for the session-provisioning window.
        // This regex would flag if anyone re-adds the !sessionReady branch
        // to the early return.
        expect(SOURCE).not.toMatch(/return undefined[\s\S]*?\}\, \[sessionId, sessionReady,/)
        expect(SOURCE).not.toMatch(/if \(!sessionId \|\| !sessionReady\) return undefined/)
    })

    it("intercepts the documented HTTP fallback codes (423/503/504)", () => {
        // These statuses come from anti-abuse + chat-route timeout handling.
        // If a refactor accidentally drops a branch, the UI won't show the
        // matching FallbackQR card and users will see a generic stream error.
        expect(SOURCE).toMatch(/status === 423/)
        expect(SOURCE).toMatch(/status === 503/)
        expect(SOURCE).toMatch(/status === 504/)
    })

    it("waits for /api/agent/session/start to settle before flipping sessionReady", () => {
        // Without an awaited /session/start, a fast user click races the
        // server-side AgentSession row creation and chat returns 410
        // session-expired. The fix awaits the call; this test asserts the
        // await wiring stays in place.
        expect(SOURCE).toMatch(/await fetch\("\/api\/agent\/session\/start"/)
        expect(SOURCE).toMatch(/setSessionReady\(true\)/)
    })

    it("rehydrates chat history from the server before mounting the runtime", () => {
        // Chat history persists in the AgentMessage DB table; the widget
        // fetches it on mount and feeds it into useChatRuntime({ messages })
        // as initial state. The earlier sessionStorage attempt failed
        // because useThread state.messages (ThreadMessage[]) doesn't match
        // useChatRuntime's expected UIMessage[]. The server already stores
        // UIMessage-shaped parts, so the round-trip works.
        //
        // Critical: runtime mount is BLOCKED until the fetch resolves —
        // useChatRuntime captures `messages` as initial state on first
        // render, so a late update would silently no-op.
        expect(SOURCE).toMatch(/\/api\/agent\/messages\?sessionId=/)
        expect(SOURCE).toMatch(/setInitialMessages\(/)
        expect(SOURCE).toMatch(/setHistoryReady\(true\)/)
        // Gate: don't mount the inner Provider until both session + history
        // are ready. Without this, the user can race a chip click and lose
        // their history.
        expect(SOURCE).toMatch(/!sessionReady\s*\|\|\s*!historyReady/)
        // useChatRuntime must receive the fetched messages, not undefined.
        expect(SOURCE).toMatch(/messages:\s*initialMessages\.length\s*>\s*0\s*\?\s*initialMessages/)
    })
})
