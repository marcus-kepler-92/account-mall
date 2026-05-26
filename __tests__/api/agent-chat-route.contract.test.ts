/**
 * Contract test for app/api/agent/chat/route.ts.
 *
 * Pins behaviors that aren't easy to assert with full request mocking —
 * specifically the sliding-window history cap. Without this guard a
 * future refactor could quietly drop the slice and re-introduce O(N²)
 * token cost growth per session.
 */
import { readFileSync } from "fs"
import { join } from "path"

const SOURCE = readFileSync(
    join(__dirname, "../../app/api/agent/chat/route.ts"),
    "utf8",
)

describe("/api/agent/chat — sliding history window", () => {
    it("caps history sent to the LLM at a fixed recent window", () => {
        // The full transcript stays in the UI / DB; only the LLM input is
        // trimmed. This keeps per-turn token cost bounded so a long
        // session doesn't blow the per-session agentTokenBudget early.
        expect(SOURCE).toMatch(/MAX_LLM_HISTORY\s*=\s*\d+/)
        expect(SOURCE).toMatch(/messages\.slice\(-MAX_LLM_HISTORY\)/)
    })

    it("feeds the sanitized messages — not the raw trimmed array — into convertToModelMessages", () => {
        // The model only sees `sanitized` (the file-part-stripped derivative
        // of trimmedMessages). Regression guard against someone passing
        // `messages` or `trimmedMessages` straight to streamText and
        // re-opening the DeepSeek `image_url` rejection path.
        expect(SOURCE).toMatch(/convertToModelMessages\(sanitized\)/)
        expect(SOURCE).not.toMatch(/convertToModelMessages\(messages\)/)
        expect(SOURCE).not.toMatch(/convertToModelMessages\(trimmedMessages\)/)
    })
})

describe("/api/agent/chat — non-text part sanitization", () => {
    // DeepSeek-chat is text-only. A file/image content part in a user
    // message gets serialized as `image_url` by convertToModelMessages,
    // which DeepSeek rejects with `unknown variant image_url`. This is
    // the durable server-side guard against any future path that smuggles
    // attachments into chat history (incl. already-polluted sessions
    // replaying old in-memory messages).
    it("derives `sanitized` from `trimmedMessages` before convertToModelMessages", () => {
        expect(SOURCE).toMatch(/const\s+sanitized\s*=\s*trimmedMessages\.map/)
    })

    it("filters user-message parts to only `type === \"text\"`", () => {
        expect(SOURCE).toMatch(
            /m\.role\s*===\s*"user"[\s\S]*?parts:\s*m\.parts\.filter\(\(p\)\s*=>\s*p\.type\s*===\s*"text"\)/,
        )
    })

    it("leaves non-user messages untouched (assistant / tool roles round-trip)", () => {
        // The filter only runs on role === "user"; assistant tool-call /
        // tool-result parts must survive verbatim so the AI SDK can rebuild
        // the multi-step thread context.
        expect(SOURCE).toMatch(/m\.role\s*===\s*"user"\s*\?\s*\{[\s\S]*?\}\s*:\s*m/)
    })
})
