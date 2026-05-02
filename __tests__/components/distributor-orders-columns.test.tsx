/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { CommissionCell, type DistributorOrderRow } from "@/app/distributor/(main)/orders/orders-columns"

type RowInput = Pick<DistributorOrderRow, "status" | "commissionAmount">

function makeRow(input: RowInput) {
    return { original: input }
}

describe("CommissionCell", () => {
    it("shows commission amount for completed orders with commission", () => {
        render(<CommissionCell row={makeRow({ status: "COMPLETED", commissionAmount: 21.0 })} />)
        expect(screen.getByText("¥21.00")).toBeInTheDocument()
    })

    it("formats commission to two decimal places", () => {
        render(<CommissionCell row={makeRow({ status: "COMPLETED", commissionAmount: 9.9 })} />)
        expect(screen.getByText("¥9.90")).toBeInTheDocument()
    })

    it("shows 无奖金 badge for completed orders with no commission", () => {
        render(<CommissionCell row={makeRow({ status: "COMPLETED", commissionAmount: null })} />)
        expect(screen.getByText("无奖金")).toBeInTheDocument()
    })

    it("has accessible label explaining why there is no commission", () => {
        render(<CommissionCell row={makeRow({ status: "COMPLETED", commissionAmount: null })} />)
        expect(screen.getByLabelText("无奖金：下单邮箱与您的账号邮箱相同，此订单不计奖金")).toBeInTheDocument()
    })

    it("shows dash for pending orders", () => {
        render(<CommissionCell row={makeRow({ status: "PENDING", commissionAmount: null })} />)
        expect(screen.getByText("—")).toBeInTheDocument()
        expect(screen.queryByText("无奖金")).not.toBeInTheDocument()
    })

    it("shows dash for closed orders", () => {
        render(<CommissionCell row={makeRow({ status: "CLOSED", commissionAmount: null })} />)
        expect(screen.getByText("—")).toBeInTheDocument()
    })

    it("does not show commission amount for pending orders even if amount is set", () => {
        render(<CommissionCell row={makeRow({ status: "PENDING", commissionAmount: 10 })} />)
        expect(screen.queryByText(/¥10/)).not.toBeInTheDocument()
        expect(screen.getByText("—")).toBeInTheDocument()
    })
})
