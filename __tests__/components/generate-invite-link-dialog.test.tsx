/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react"
import { GenerateInviteLinkDialog } from "@/app/distributor/(main)/generate-invite-link-dialog"
import { toast } from "sonner"

jest.mock("sonner", () => ({
    toast: { error: jest.fn(), success: jest.fn() },
}))

function setup(open: boolean, onOpenChange = jest.fn()) {
    return render(<GenerateInviteLinkDialog open={open} onOpenChange={onOpenChange} />)
}

describe("GenerateInviteLinkDialog", () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it("auto-generates link immediately when dialog opens", async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({ link: "https://example.com/invite/abc" }),
        } as Response)

        setup(true)

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                "/api/distributor/invite",
                expect.objectContaining({ method: "POST" })
            )
        })
        await waitFor(() => {
            expect(screen.getByDisplayValue("https://example.com/invite/abc")).toBeInTheDocument()
        })
    })

    it("shows loading spinner while generating", async () => {
        let resolve: (v: unknown) => void
        global.fetch = jest.fn().mockReturnValueOnce(
            new Promise((r) => { resolve = r })
        )

        setup(true)

        expect(screen.getByText("生成中...")).toBeInTheDocument()

        await act(async () => {
            resolve!({
                ok: true,
                json: async () => ({ link: "https://example.com/invite/abc" }),
            })
        })
    })

    it("shows error toast when API returns error", async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error: "生成失败" }),
        } as Response)

        setup(true)

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("生成失败")
        })
    })

    it("shows fallback error toast when API error has no message", async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: false,
            json: async () => ({}),
        } as Response)

        setup(true)

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("生成失败，请稍后重试")
        })
    })

    it("shows error toast when fetch throws", async () => {
        global.fetch = jest.fn().mockRejectedValueOnce(new Error("network"))

        setup(true)

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("生成失败，请稍后重试")
        })
    })

    it("does not show error toast when request is aborted", async () => {
        global.fetch = jest.fn().mockRejectedValueOnce(new DOMException("Aborted", "AbortError"))

        setup(true)

        await waitFor(() => expect(global.fetch).toHaveBeenCalled())
        await new Promise((r) => setTimeout(r, 50))
        expect(toast.error).not.toHaveBeenCalled()
    })

    it("does not generate when dialog is closed", () => {
        global.fetch = jest.fn()
        setup(false)
        expect(global.fetch).not.toHaveBeenCalled()
    })

    it("generates a fresh link each time dialog reopens", async () => {
        global.fetch = jest.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ link: "https://example.com/invite/first" }),
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ link: "https://example.com/invite/second" }),
            } as Response)

        const onOpenChange = jest.fn()
        const { rerender } = render(
            <GenerateInviteLinkDialog open={true} onOpenChange={onOpenChange} />
        )

        await waitFor(() => {
            expect(screen.getByDisplayValue("https://example.com/invite/first")).toBeInTheDocument()
        })

        rerender(<GenerateInviteLinkDialog open={false} onOpenChange={onOpenChange} />)
        rerender(<GenerateInviteLinkDialog open={true} onOpenChange={onOpenChange} />)

        await waitFor(() => {
            expect(screen.getByDisplayValue("https://example.com/invite/second")).toBeInTheDocument()
        })
        expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it("copies link to clipboard and shows success toast", async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({ link: "https://example.com/invite/abc" }),
        } as Response)
        Object.assign(navigator, {
            clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
        })

        setup(true)

        await waitFor(() => {
            expect(screen.getByDisplayValue("https://example.com/invite/abc")).toBeInTheDocument()
        })

        const [copyBtn] = screen.getAllByRole("button")
        fireEvent.click(copyBtn)
        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://example.com/invite/abc")
            expect(toast.success).toHaveBeenCalledWith("链接已复制")
        })
    })

    it("shows error toast when clipboard write fails", async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({ link: "https://example.com/invite/abc" }),
        } as Response)
        Object.assign(navigator, {
            clipboard: { writeText: jest.fn().mockRejectedValue(new Error("denied")) },
        })

        setup(true)

        await waitFor(() => {
            expect(screen.getByDisplayValue("https://example.com/invite/abc")).toBeInTheDocument()
        })

        const [copyBtn] = screen.getAllByRole("button")
        fireEvent.click(copyBtn)
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("复制失败，请手动复制")
        })
    })

    it("shows Check icon after copying and Copy icon before", async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({ link: "https://example.com/invite/abc" }),
        } as Response)
        Object.assign(navigator, {
            clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
        })

        setup(true)

        await waitFor(() => {
            expect(screen.getByDisplayValue("https://example.com/invite/abc")).toBeInTheDocument()
        })

        expect(document.querySelector(".lucide-copy")).toBeInTheDocument()
        expect(document.querySelector(".lucide-check")).not.toBeInTheDocument()

        const [copyBtn] = screen.getAllByRole("button")
        fireEvent.click(copyBtn)
        await waitFor(() => {
            expect(document.querySelector(".lucide-check")).toBeInTheDocument()
            expect(document.querySelector(".lucide-copy")).not.toBeInTheDocument()
        })
    })
})
