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

    it("feeds the trimmed messages — not the full array — into convertToModelMessages", () => {
        // The model only sees `trimmedMessages`. Regression guard against
        // someone passing the original `messages` straight to streamText.
        expect(SOURCE).toMatch(/convertToModelMessages\(trimmedMessages\)/)
    })
})
