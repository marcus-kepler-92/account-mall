/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ApplyWithdrawalForm } from "@/app/distributor/(main)/commissions/apply-withdrawal-form"

jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: jest.fn() }),
}))

jest.mock("sonner", () => ({
    toast: { error: jest.fn(), success: jest.fn() },
}))

describe("ApplyWithdrawalForm", () => {
    const defaultProps = {
        withdrawableBalance: 200,
        minAmount: 50,
    }

    it("renders amount input with min set to minAmount", () => {
        render(<ApplyWithdrawalForm {...defaultProps} />)
        const input = screen.getByLabelText(/提现金额/i)
        expect(input).toHaveAttribute("min", "50")
    })

    it("shows minimum amount hint in helper text", () => {
        render(<ApplyWithdrawalForm {...defaultProps} />)
        expect(screen.getByText(/至少.*¥50|¥50.*至少/)).toBeInTheDocument()
    })

    it("shows error when amount is below minAmount", async () => {
        render(<ApplyWithdrawalForm {...defaultProps} />)
        const input = screen.getByLabelText(/提现金额/i)
        fireEvent.change(input, { target: { value: "20" } })
        await waitFor(() => {
            expect(screen.getByText(/不能低于最低提现额度/)).toBeInTheDocument()
        })
    })

    it("does not show below-minimum error when amount equals minAmount", () => {
        render(<ApplyWithdrawalForm {...defaultProps} />)
        const input = screen.getByLabelText(/提现金额/i)
        fireEvent.change(input, { target: { value: "50" } })
        expect(screen.queryByText(/不能低于最低提现额度/)).not.toBeInTheDocument()
    })

    it("submit button is disabled when amount is below minAmount", () => {
        render(<ApplyWithdrawalForm {...defaultProps} />)
        const input = screen.getByLabelText(/提现金额/i)
        fireEvent.change(input, { target: { value: "20" } })
        expect(screen.getByRole("button", { name: /提交申请/ })).toBeDisabled()
    })

    it("submit button is disabled when amount is valid but no file selected", () => {
        render(<ApplyWithdrawalForm {...defaultProps} />)
        const input = screen.getByLabelText(/提现金额/i)
        fireEvent.change(input, { target: { value: "80" } })
        expect(screen.getByRole("button", { name: /提交申请/ })).toBeDisabled()
    })

    it("shows error when amount exceeds withdrawable balance", async () => {
        render(<ApplyWithdrawalForm {...defaultProps} />)
        const input = screen.getByLabelText(/提现金额/i)
        fireEvent.change(input, { target: { value: "300" } })
        await waitFor(() => {
            expect(screen.getByText(/不能超过可提现余额/)).toBeInTheDocument()
        })
    })

    it("uses default minAmount of 50 when prop is not provided", async () => {
        render(<ApplyWithdrawalForm withdrawableBalance={200} />)
        const input = screen.getByLabelText(/提现金额/i)
        expect(input).toHaveAttribute("min", "50")
        fireEvent.change(input, { target: { value: "20" } })
        await waitFor(() => {
            expect(screen.getByText(/不能低于最低提现额度/)).toBeInTheDocument()
        })
    })

    it("shows zero balance state when withdrawableBalance is 0", () => {
        render(<ApplyWithdrawalForm withdrawableBalance={0} minAmount={50} />)
        expect(screen.getByText(/暂无可提现余额/)).toBeInTheDocument()
    })
})
