/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { DistributorDetailSheet } from "@/app/admin/(main)/distributors/distributor-detail-sheet"
import type { DistributorViewRow } from "@/app/admin/(main)/distributors/distributors-columns"

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

const row: DistributorViewRow = {
    id: "u1",
    email: "alice@example.com",
    name: "Alice",
    distributorCode: "D001",
    discountCodeEnabled: true,
    discountPercent: 8,
    disabledAt: null,
    createdAt: "2024-01-01T00:00:00Z",
    completedOrderCount: 12,
    salesTotal: 3000,
    weeklySalesTotal: 800,
    totalCommission: 300,
    level1CommissionTotal: 240,
    level2CommissionTotal: 60,
    level1Settled: 200,
    level2Settled: 50,
    paidTotal: 100,
    pendingTotal: 0,
    withdrawableBalance: 150,
    inviteeCount: 3,
    invitees: [
        { id: "u3", name: "Carol", distributorCode: "D003" },
        { id: "u4", name: "Dave", distributorCode: null },
    ],
    inviter: { id: "u2", name: "Bob", distributorCode: "D002" },
    milestoneSummary: null,
}

const tiers = [
    { minAmount: 0, maxAmount: 1000, ratePercent: 5, sortOrder: 1 },
    { minAmount: 1000, maxAmount: 5000, ratePercent: 8, sortOrder: 2 },
]

describe("DistributorDetailSheet", () => {
    it("renders name and email in header", () => {
        render(<DistributorDetailSheet row={row} open={true} onOpenChange={jest.fn()} onSuccess={jest.fn()} tiers={tiers} />)
        expect(screen.getByText("Alice")).toBeInTheDocument()
        expect(screen.getByText("alice@example.com")).toBeInTheDocument()
    })

    it("renders promo code", () => {
        render(<DistributorDetailSheet row={row} open={true} onOpenChange={jest.fn()} onSuccess={jest.fn()} tiers={tiers} />)
        expect(screen.getByText("D001")).toBeInTheDocument()
    })

    it("renders sales figures", () => {
        render(<DistributorDetailSheet row={row} open={true} onOpenChange={jest.fn()} onSuccess={jest.fn()} tiers={tiers} />)
        expect(screen.getByText("¥3000.00")).toBeInTheDocument()
        expect(screen.getByText("12 单")).toBeInTheDocument()
    })

    it("renders commission breakdown", () => {
        render(<DistributorDetailSheet row={row} open={true} onOpenChange={jest.fn()} onSuccess={jest.fn()} tiers={tiers} />)
        expect(screen.getByText("¥300.00")).toBeInTheDocument()
        expect(screen.getByText("¥240.00")).toBeInTheDocument()
        expect(screen.getByText("¥60.00")).toBeInTheDocument()
    })

    it("renders withdrawable balance", () => {
        render(<DistributorDetailSheet row={row} open={true} onOpenChange={jest.fn()} onSuccess={jest.fn()} tiers={tiers} />)
        expect(screen.getByText("¥150.00")).toBeInTheDocument()
    })

    it("renders team info with inviter and invitee count", () => {
        render(<DistributorDetailSheet row={row} open={true} onOpenChange={jest.fn()} onSuccess={jest.fn()} tiers={tiers} />)
        expect(screen.getByText(/Bob/)).toBeInTheDocument()
        expect(screen.getByText(/3 人/)).toBeInTheDocument()
    })

    it("shows 停用 action button when distributor is enabled", () => {
        render(<DistributorDetailSheet row={row} open={true} onOpenChange={jest.fn()} onSuccess={jest.fn()} tiers={tiers} />)
        expect(screen.getByRole("button", { name: /停用/ })).toBeInTheDocument()
    })

    it("shows 启用 action button when distributor is disabled", () => {
        render(<DistributorDetailSheet row={{ ...row, disabledAt: "2024-06-01T00:00:00Z" }} open={true} onOpenChange={jest.fn()} onSuccess={jest.fn()} tiers={tiers} />)
        expect(screen.getByRole("button", { name: /启用/ })).toBeInTheDocument()
    })

    it("renders nothing when row is null", () => {
        const { container } = render(<DistributorDetailSheet row={null} open={true} onOpenChange={jest.fn()} onSuccess={jest.fn()} tiers={tiers} />)
        expect(container).toBeEmptyDOMElement()
    })
})

describe("DistributorDetailSheet — 邀请里程碑", () => {
    it("hides milestone section when milestoneSummary is null", () => {
        render(<DistributorDetailSheet row={row} open={true} onOpenChange={jest.fn()} onSuccess={jest.fn()} tiers={tiers} />)
        expect(screen.queryByText("里程碑已触发")).not.toBeInTheDocument()
    })

    it("shows triggered count and next milestone target", () => {
        const r = {
            ...row,
            milestoneSummary: {
                triggeredCount: 1,
                nextMilestone: { thresholdAmount: 5000, thresholdCount: 3, bonusAmount: 200 },
            },
        }
        render(<DistributorDetailSheet row={r} open={true} onOpenChange={jest.fn()} onSuccess={jest.fn()} tiers={tiers} />)
        expect(screen.getByText("里程碑已触发")).toBeInTheDocument()
        expect(screen.getByText("1 个")).toBeInTheDocument()
        expect(screen.getByText(/3 人各满 ¥5000/)).toBeInTheDocument()
        expect(screen.getByText("¥200")).toBeInTheDocument()
    })

    it("shows '已完成所有里程碑' when nextMilestone is null", () => {
        const r = {
            ...row,
            milestoneSummary: { triggeredCount: 3, nextMilestone: null },
        }
        render(<DistributorDetailSheet row={r} open={true} onOpenChange={jest.fn()} onSuccess={jest.fn()} tiers={tiers} />)
        expect(screen.getByText("里程碑已触发")).toBeInTheDocument()
        expect(screen.getByText("3 个")).toBeInTheDocument()
        expect(screen.getByText("已完成所有里程碑")).toBeInTheDocument()
        expect(screen.queryByText(/各满/)).not.toBeInTheDocument()
    })

    it("shows triggered count 0 with next milestone when not started", () => {
        const r = {
            ...row,
            milestoneSummary: {
                triggeredCount: 0,
                nextMilestone: { thresholdAmount: 1000, thresholdCount: 2, bonusAmount: 100 },
            },
        }
        render(<DistributorDetailSheet row={r} open={true} onOpenChange={jest.fn()} onSuccess={jest.fn()} tiers={tiers} />)
        expect(screen.getByText("0 个")).toBeInTheDocument()
        expect(screen.getByText(/2 人各满 ¥1000/)).toBeInTheDocument()
    })
})
