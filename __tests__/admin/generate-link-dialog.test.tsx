/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react"
import { GenerateLinkDialog } from "@/app/admin/(main)/distributors/generate-link-dialog"
import { toast } from "sonner"

jest.mock("sonner", () => ({
    toast: { error: jest.fn(), success: jest.fn() },
}))

const API = "/api/admin/distributors/invite"

function setup(open: boolean, onOpenChange = jest.fn()) {
    return render(<GenerateLinkDialog open={open} onOpenChange={onOpenChange} apiEndpoint={API} />)
}

async function openAndGenerate(maxUses?: number) {
    setup(true)
    if (maxUses !== undefined) {
        const input = screen.getByLabelText(/可注册人数/)
        fireEvent.change(input, { target: { value: String(maxUses) } })
    }
    fireEvent.click(screen.getByRole("button", { name: "生成链接" }))
}

describe("GenerateLinkDialog (admin)", () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    // ── Config state ────────────────────────────────────────────────────────────

    it("shows config state with input and generate button on open", () => {
        global.fetch = jest.fn()
        setup(true)
        expect(screen.getByLabelText(/可注册人数/)).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "生成链接" })).toBeInTheDocument()
        expect(global.fetch).not.toHaveBeenCalled()
    })

    it("does not fetch when dialog is closed", () => {
        global.fetch = jest.fn()
        setup(false)
        expect(global.fetch).not.toHaveBeenCalled()
    })

    // ── Generate flow ───────────────────────────────────────────────────────────

    it("fetches and shows link when generate button is clicked", async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({ link: "https://example.com/invite/admin-abc" }),
        } as Response)

        await openAndGenerate()

        await waitFor(() => {
            expect(screen.getByDisplayValue("https://example.com/invite/admin-abc")).toBeInTheDocument()
        })
        expect(global.fetch).toHaveBeenCalledWith(
            API,
            expect.objectContaining({ method: "POST" })
        )
    })

    it("sends the correct maxUses value in request body", async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({ link: "https://example.com/invite/admin-abc" }),
        } as Response)

        await openAndGenerate(20)

        await waitFor(() => expect(global.fetch).toHaveBeenCalled())
        const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
        expect(body.maxUses).toBe(20)
    })

    it("shows loading spinner while generating", async () => {
        let resolve: (v: unknown) => void
        global.fetch = jest.fn().mockReturnValueOnce(new Promise((r) => { resolve = r }))

        setup(true)
        fireEvent.click(screen.getByRole("button", { name: "生成链接" }))

        expect(screen.getByText("生成中...")).toBeInTheDocument()

        await act(async () => {
            resolve!({ ok: true, json: async () => ({ link: "https://example.com/invite/admin-abc" }) })
        })
    })

    // ── Error handling ──────────────────────────────────────────────────────────

    it("shows error toast and returns to config when API returns error", async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error: "无权限" }),
        } as Response)

        await openAndGenerate()

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("无权限")
        })
        expect(screen.getByRole("button", { name: "生成链接" })).toBeInTheDocument()
    })

    it("shows error toast when fetch throws", async () => {
        global.fetch = jest.fn().mockRejectedValueOnce(new Error("network"))

        await openAndGenerate()

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("生成失败，请稍后重试")
        })
    })

    // ── Reset on reopen ─────────────────────────────────────────────────────────

    it("resets to config state when dialog closes and reopens", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ link: "https://example.com/invite/admin-abc" }),
        } as Response)

        const onOpenChange = jest.fn()
        const { rerender } = render(
            <GenerateLinkDialog open={true} onOpenChange={onOpenChange} apiEndpoint={API} />
        )

        fireEvent.click(screen.getByRole("button", { name: "生成链接" }))
        await waitFor(() => {
            expect(screen.getByDisplayValue("https://example.com/invite/admin-abc")).toBeInTheDocument()
        })

        rerender(<GenerateLinkDialog open={false} onOpenChange={onOpenChange} apiEndpoint={API} />)
        rerender(<GenerateLinkDialog open={true} onOpenChange={onOpenChange} apiEndpoint={API} />)

        expect(screen.getByRole("button", { name: "生成链接" })).toBeInTheDocument()
        expect(screen.queryByDisplayValue("https://example.com/invite/admin-abc")).not.toBeInTheDocument()
    })

    // ── Copy ────────────────────────────────────────────────────────────────────

    it("copies link to clipboard and shows success toast", async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({ link: "https://example.com/invite/admin-abc" }),
        } as Response)
        Object.assign(navigator, {
            clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
        })

        await openAndGenerate()

        await waitFor(() => {
            expect(screen.getByDisplayValue("https://example.com/invite/admin-abc")).toBeInTheDocument()
        })

        fireEvent.click(screen.getByRole("button", { name: "复制链接" }))
        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://example.com/invite/admin-abc")
            expect(toast.success).toHaveBeenCalledWith("链接已复制")
        })
    })

    it("shows error toast when clipboard write fails", async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({ link: "https://example.com/invite/admin-abc" }),
        } as Response)
        Object.assign(navigator, {
            clipboard: { writeText: jest.fn().mockRejectedValue(new Error("denied")) },
        })

        await openAndGenerate()

        await waitFor(() => {
            expect(screen.getByDisplayValue("https://example.com/invite/admin-abc")).toBeInTheDocument()
        })

        fireEvent.click(screen.getByRole("button", { name: "复制链接" }))
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("复制失败，请手动复制")
        })
    })

    it("shows Check icon after copying and Copy icon before", async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({ link: "https://example.com/invite/admin-abc" }),
        } as Response)
        Object.assign(navigator, {
            clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
        })

        await openAndGenerate()

        await waitFor(() => {
            expect(screen.getByDisplayValue("https://example.com/invite/admin-abc")).toBeInTheDocument()
        })

        expect(document.querySelector(".lucide-copy")).toBeInTheDocument()
        expect(document.querySelector(".lucide-check")).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole("button", { name: "复制链接" }))
        await waitFor(() => {
            expect(document.querySelector(".lucide-check")).toBeInTheDocument()
            expect(document.querySelector(".lucide-copy")).not.toBeInTheDocument()
        })
    })
})
