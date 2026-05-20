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

    it("hydrates chat history from sessionStorage on remount and persists on change", () => {
        // Regression: Radix Popover / Sheet unmount their children on close,
        // so opening + closing + reopening the FAB used to wipe the chat
        // thread. We now persist UIMessages keyed by sessionId in
        // sessionStorage and rehydrate via useChatRuntime({ messages }).
        //
        // sessionStorage is the right scope here:
        //   - persists across mount/unmount within the same tab (the actual bug)
        //   - cleared on tab close (no stale leakage to next visitor)
        //   - never shared across tabs (each tab has its own thread)

        // Hydration on mount
        expect(SOURCE).toMatch(/readPersistedMessages\(sessionId\)/)
        expect(SOURCE).toMatch(/messages:\s*initialMessages/)

        // Persistence on change — PersistMessages subscribes to thread state
        expect(SOURCE).toMatch(/function PersistMessages/)
        expect(SOURCE).toMatch(/useThread\(\(state\)\s*=>\s*state\.messages\)/)
        expect(SOURCE).toMatch(/sessionStorage\.setItem\(\s*MESSAGES_KEY_PREFIX/)

        // Storage key is scoped by sessionId so different sessions don't collide
        expect(SOURCE).toMatch(/MESSAGES_KEY_PREFIX\s*\+\s*sessionId/)
    })
})
