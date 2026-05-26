/**
 * Contract test for app/components/agent-chat/chat-wrappers.tsx.
 *
 * The DeepSeek `unknown variant image_url` incident had two contributing
 * client-side defaults: useChatRuntime injecting vercelAttachmentAdapter
 * (covered in chat-panel.contract.test.ts) AND ComposerPrimitive.Input's
 * `addAttachmentOnPaste = true` default — together they let any pasted
 * screenshot land in messages[*].parts as a file content part, bypassing
 * the 4 KB text-only size cap and DeepSeek's text-only request shape.
 *
 * Source-level rather than mount-level because the composer pulls in the
 * full @assistant-ui runtime context; mocking it is more brittle than
 * pinning the literal prop.
 */
import { readFileSync } from "fs"
import { join } from "path"

const SOURCE = readFileSync(
    join(__dirname, "../../app/components/agent-chat/chat-wrappers.tsx"),
    "utf8",
)

describe("ComposerBar paste-to-attach contract", () => {
    it("disables paste-to-attach on ComposerPrimitive.Input", () => {
        // Belt-and-suspenders alongside the runtime-level attachments
        // adapter disable. Even if a future refactor flips the adapter
        // back on (e.g. to support a legitimate attach-button feature),
        // this prop keeps clipboard images from silently smuggling
        // file parts into user messages.
        expect(SOURCE).toMatch(/<ComposerPrimitive\.Input[\s\S]*?addAttachmentOnPaste=\{false\}/)
    })
})
