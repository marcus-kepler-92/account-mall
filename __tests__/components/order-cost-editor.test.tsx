/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { OrderCostEditor } from "@/app/admin/(main)/orders/[orderId]/order-cost-editor"
import { toast } from "sonner"

const mockRefresh = jest.fn()

jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: mockRefresh }),
}))

jest.mock("sonner", () => ({
    toast: { error: jest.fn(), success: jest.fn() },
}))

function openDialog() {
    fireEvent.click(screen.getByRole("button", { name: /编辑成本/ }))
}

describe("OrderCostEditor", () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it("renders nothing when not editable", () => {
        const { container } = render(
            <OrderCostEditor orderId="order-1" cost={10} editable={false} />,
        )
        expect(container).toBeEmptyDOMElement()
        expect(
            screen.queryByRole("button", { name: /编辑成本/ }),
        ).not.toBeInTheDocument()
    })

    it("shows the edit button only when editable", () => {
        render(<OrderCostEditor orderId="order-1" cost={10} editable />)
        expect(
            screen.getByRole("button", { name: /编辑成本/ }),
        ).toBeInTheDocument()
    })

    it("pre-fills the input with the current cost on open", async () => {
        render(<OrderCostEditor orderId="order-1" cost={12.5} editable />)
        openDialog()
        await waitFor(() => {
            expect(screen.getByLabelText(/成本总额/)).toHaveValue(12.5)
        })
    })

    it("defaults the input to 0 when cost is null", async () => {
        render(<OrderCostEditor orderId="order-1" cost={null} editable />)
        openDialog()
        await waitFor(() => {
            expect(screen.getByLabelText(/成本总额/)).toHaveValue(0)
        })
    })

    it("shows a validation error for a negative cost", async () => {
        render(<OrderCostEditor orderId="order-1" cost={10} editable />)
        openDialog()
        await waitFor(() => screen.getByLabelText(/成本总额/))

        fireEvent.change(screen.getByLabelText(/成本总额/), {
            target: { value: "-5" },
        })
        // fireEvent.submit on the form directly — clicking a submit button inside
        // a form with min="0" triggers native constraint validation in jsdom,
        // which blocks submission before react-hook-form/Zod runs.
        fireEvent.submit(screen.getByLabelText(/成本总额/).closest("form")!)

        await waitFor(() => {
            expect(screen.getByText("成本不能为负")).toBeInTheDocument()
        })
    })

    it("PATCHes the cost endpoint and shows success on valid submit", async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({ ok: true }),
        } as Response)

        render(<OrderCostEditor orderId="order-1" cost={10} editable />)
        openDialog()
        await waitFor(() => screen.getByLabelText(/成本总额/))

        fireEvent.change(screen.getByLabelText(/成本总额/), {
            target: { value: "20" },
        })
        fireEvent.click(screen.getByRole("button", { name: /^保存$/ }))

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                "/api/admin/orders/order-1/cost",
                expect.objectContaining({ method: "PATCH" }),
            )
            expect(toast.success).toHaveBeenCalledWith("成本已更新")
            expect(mockRefresh).toHaveBeenCalled()
        })

        const [, init] = (global.fetch as jest.Mock).mock.calls[0]
        expect(JSON.parse(init.body)).toEqual({ costTotal: 20 })
    })

    it("shows an error toast when the request fails", async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error: "保存失败" }),
        } as Response)

        render(<OrderCostEditor orderId="order-1" cost={10} editable />)
        openDialog()
        await waitFor(() => screen.getByLabelText(/成本总额/))

        fireEvent.click(screen.getByRole("button", { name: /^保存$/ }))

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("保存失败")
        })
        expect(mockRefresh).not.toHaveBeenCalled()
    })
})
