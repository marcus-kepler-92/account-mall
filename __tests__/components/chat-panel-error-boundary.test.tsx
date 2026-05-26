/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { ChatPanelErrorBoundary } from "@/app/components/agent-chat/error-boundary"

// next/image is heavy in jsdom and not relevant to the boundary's
// fallback contract; lightweight stub keeps the render synchronous.
// QrImage will receive src="" from the boundary, which short-circuits
// to a placeholder before this stub even runs — but mocking is still
// the safe default for components that import next/image.
jest.mock("next/image", () => ({
    __esModule: true,
    default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

// Child that throws on render. We swallow React's noisy console.error
// for the throwing render so the test output stays clean.
function Boom(): never {
    throw new Error("synthetic test crash")
}

describe("ChatPanelErrorBoundary", () => {
    let consoleErrorSpy: jest.SpyInstance

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
    })

    afterEach(() => {
        consoleErrorSpy.mockRestore()
    })

    it("passes children through when no error is thrown", () => {
        render(
            <ChatPanelErrorBoundary>
                <div data-testid="happy-child">all good</div>
            </ChatPanelErrorBoundary>,
        )
        expect(screen.getByTestId("happy-child")).toHaveTextContent("all good")
    })

    it("renders the QR fallback when a child throws", () => {
        // The boundary must catch and degrade — without this, the entire
        // Popover/Sheet would surface React's default red error screen and
        // the user would have no path to human support.
        render(
            <ChatPanelErrorBoundary>
                <Boom />
            </ChatPanelErrorBoundary>,
        )
        expect(
            screen.getByText("AI 客服暂时不可用，请扫码加企微人工跟进。"),
        ).toBeInTheDocument()
    })

    it("falls back to the unconfigured-QR placeholder (src='') so admins notice the gap", () => {
        // We intentionally don't try to fetch handoff info from the
        // boundary — the runtime state that produced it is gone. The
        // empty src degrades to QrImage's standard "客服二维码暂未配置"
        // placeholder, which doubles as a config-health signal for admins.
        render(
            <ChatPanelErrorBoundary>
                <Boom />
            </ChatPanelErrorBoundary>,
        )
        expect(screen.getByText("客服二维码暂未配置")).toBeInTheDocument()
    })

    it("surfaces a copyable wechat id from client config so the user has a non-QR escape hatch", () => {
        // configClient.supportWechat has an env default ("Mashangbang0"),
        // so even with no NEXT_PUBLIC_* override the user gets a contact
        // string they can paste into WeChat manually.
        render(
            <ChatPanelErrorBoundary>
                <Boom />
            </ChatPanelErrorBoundary>,
        )
        expect(screen.getByText(/微信号/)).toBeInTheDocument()
    })

    it("logs the underlying error to console.error for ops visibility", () => {
        render(
            <ChatPanelErrorBoundary>
                <Boom />
            </ChatPanelErrorBoundary>,
        )
        // React itself logs the boundary catch; we just verify our prefixed
        // log was one of the calls so a future refactor doesn't silently
        // drop the tag.
        const tagged = consoleErrorSpy.mock.calls.find(
            (args) =>
                typeof args[0] === "string" &&
                args[0].includes("[agent-chat] ChatPanel render crashed"),
        )
        expect(tagged).toBeDefined()
    })
})
