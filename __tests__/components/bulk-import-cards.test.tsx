/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { useState } from "react"
import { BulkImportCards } from "@/app/admin/(main)/products/[productId]/cards/bulk-import-cards"

const mockRefresh = jest.fn()
const mockReplace = jest.fn()

jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: mockRefresh, replace: mockReplace }),
    usePathname: () => "/admin/products/prod-1/cards",
}))

jest.mock("sonner", () => ({
    toast: { error: jest.fn(), success: jest.fn() },
}))

jest.mock("@/app/admin/hooks/use-admin-notifications", () => ({
    useInvalidateAdminNotifications: () => jest.fn(),
}))

describe("BulkImportCards", () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe("uncontrolled mode", () => {
        it("renders the built-in trigger and opens on click", async () => {
            render(<BulkImportCards productId="prod-1" />)

            const trigger = screen.getByRole("button", { name: /批量导入/ })
            expect(trigger).toBeInTheDocument()

            fireEvent.click(trigger)

            await waitFor(() => {
                expect(screen.getByText("批量导入卡密")).toBeInTheDocument()
            })
        })
    })

    describe("controlled mode", () => {
        it("does not render the built-in trigger when open is provided", () => {
            render(<BulkImportCards productId="prod-1" open={false} onOpenChange={jest.fn()} />)
            expect(screen.queryByRole("button", { name: /批量导入/ })).not.toBeInTheDocument()
        })

        it("shows the dialog when open is true", () => {
            render(<BulkImportCards productId="prod-1" open onOpenChange={jest.fn()} />)
            expect(screen.getByText("批量导入卡密")).toBeInTheDocument()
        })

        it("hides the dialog when open is false", () => {
            render(<BulkImportCards productId="prod-1" open={false} onOpenChange={jest.fn()} />)
            expect(screen.queryByText("批量导入卡密")).not.toBeInTheDocument()
        })

        it("calls onOpenChange(false) when the dialog is cancelled", async () => {
            const onOpenChange = jest.fn()
            render(<BulkImportCards productId="prod-1" open onOpenChange={onOpenChange} />)

            fireEvent.click(screen.getByRole("button", { name: /取消/ }))

            await waitFor(() => {
                expect(onOpenChange).toHaveBeenCalledWith(false)
            })
        })

        it("prefills the unit cost input from defaultUnitCost", () => {
            render(
                <BulkImportCards productId="prod-1" defaultUnitCost={12.5} open onOpenChange={jest.fn()} />,
            )
            expect(screen.getByLabelText(/采购成本/)).toHaveValue(12.5)
        })

        it("shows current stock context when currentStock is provided", () => {
            render(
                <BulkImportCards productId="prod-1" currentStock={7} open onOpenChange={jest.fn()} />,
            )
            expect(screen.getByText(/当前未售 7 张/)).toBeInTheDocument()
        })

        it("omits current stock context when currentStock is null", () => {
            render(<BulkImportCards productId="prod-1" open onOpenChange={jest.fn()} />)
            expect(screen.queryByText(/当前未售/)).not.toBeInTheDocument()
        })

        it("posts contents and reports imported count on submit", async () => {
            const onOpenChange = jest.fn()
            global.fetch = jest.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => ({ imported: 2 }),
            } as Response)

            render(
                <BulkImportCards productId="prod-1" defaultUnitCost={3} open onOpenChange={onOpenChange} />,
            )

            fireEvent.change(screen.getByRole("textbox"), {
                target: { value: "a|1\nb|2\na|1" },
            })
            // 3 lines pasted, deduped to 2
            expect(screen.getByText(/共 3 条，去重后 2 条/)).toBeInTheDocument()

            fireEvent.click(screen.getByRole("button", { name: /^导入$/ }))

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    "/api/products/prod-1/cards",
                    expect.objectContaining({ method: "POST" }),
                )
            })
            const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
            expect(body).toEqual({ contents: ["a|1", "b|2", "a|1"], unitCost: 3 })
            expect(onOpenChange).toHaveBeenCalledWith(false)
        })
    })
})
