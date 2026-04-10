/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { EditTierDialog } from "@/app/admin/(main)/commission-tiers/edit-tier-dialog"

const mockRefresh = jest.fn()

jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: mockRefresh }),
}))

jest.mock("sonner", () => ({
    toast: { error: jest.fn(), success: jest.fn() },
}))

const defaultTier = { id: "tier-1", minAmount: 0, maxAmount: 1000, ratePercent: 5 }

function openDialog() {
    fireEvent.click(screen.getByRole("button", { name: /编辑/ }))
}

describe("EditTierDialog", () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it("renders the edit trigger button", () => {
        render(<EditTierDialog tier={defaultTier} />)
        expect(screen.getByRole("button", { name: /编辑/ })).toBeInTheDocument()
    })

    it("pre-fills form fields with current tier values", async () => {
        render(<EditTierDialog tier={defaultTier} />)
        openDialog()
        await waitFor(() => {
            expect(screen.getByLabelText(/当周销售额下限/)).toHaveValue(0)
            expect(screen.getByLabelText(/当周销售额上限/)).toHaveValue(1000)
            expect(screen.getByLabelText(/佣金比例/)).toHaveValue(5)
        })
    })

    it("shows validation error when minAmount >= maxAmount", async () => {
        render(<EditTierDialog tier={defaultTier} />)
        openDialog()
        await waitFor(() => screen.getByLabelText(/当周销售额下限/))

        fireEvent.change(screen.getByLabelText(/当周销售额下限/), { target: { value: "2000" } })
        fireEvent.click(screen.getByRole("button", { name: /^保存$/ }))

        await waitFor(() => {
            expect(screen.getByText("销售额下限必须小于上限")).toBeInTheDocument()
        })
    })

    it("shows validation error when ratePercent > 100", async () => {
        render(<EditTierDialog tier={defaultTier} />)
        openDialog()
        await waitFor(() => screen.getByLabelText(/佣金比例/))

        fireEvent.change(screen.getByLabelText(/佣金比例/), { target: { value: "101" } })
        // Use fireEvent.submit on the form directly — fireEvent.click on a submit button inside
        // a form with max/min HTML attributes triggers native constraint validation in jsdom,
        // which silently blocks submission before react-hook-form/Zod ever runs.
        fireEvent.submit(screen.getByLabelText(/佣金比例/).closest("form")!)

        await waitFor(() => {
            expect(screen.getByText("最大 100")).toBeInTheDocument()
        })
    })

    it("calls PATCH and shows success toast on valid submit", async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({}),
        } as Response)

        render(<EditTierDialog tier={defaultTier} />)
        openDialog()
        await waitFor(() => screen.getByLabelText(/当周销售额上限/))

        fireEvent.change(screen.getByLabelText(/当周销售额上限/), { target: { value: "2000" } })
        fireEvent.click(screen.getByRole("button", { name: /^保存$/ }))

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                "/api/admin/commission-tiers/tier-1",
                expect.objectContaining({ method: "PATCH" })
            )
            expect(require("sonner").toast.success).toHaveBeenCalledWith("已修改")
            expect(mockRefresh).toHaveBeenCalled()
        })
    })

    it("shows error toast when PATCH fails", async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error: "服务器错误" }),
        } as Response)

        render(<EditTierDialog tier={defaultTier} />)
        openDialog()
        await waitFor(() => screen.getByLabelText(/当周销售额上限/))

        fireEvent.click(screen.getByRole("button", { name: /^保存$/ }))

        await waitFor(() => {
            expect(require("sonner").toast.error).toHaveBeenCalledWith("服务器错误")
        })
    })
})
