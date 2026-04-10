/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import type { DistributorRow } from "@/app/admin/(main)/distributors/distributors-columns"
import { DistributorIdentityCell, DistributorTeamCell } from "@/app/admin/(main)/distributors/distributors-columns"

const baseRow: DistributorRow = {
  id: "1",
  email: "alice@example.com",
  name: "Alice",
  distributorCode: "D001",
  discountCodeEnabled: false,
  discountPercent: null,
  disabledAt: null,
  createdAt: "2024-01-01T00:00:00Z",
  completedOrderCount: 3,
  salesTotal: 500,
  totalCommission: 50,
  level1CommissionTotal: 40,
  level2CommissionTotal: 10,
  level1Settled: 40,
  level2Settled: 10,
  paidTotal: 0,
  pendingTotal: 0,
  withdrawableBalance: 50,
  inviteeCount: 2,
  inviter: { id: "2", name: "Bob", distributorCode: "D002" },
}

describe("DistributorIdentityCell", () => {
  it("shows name, email, and promo code", () => {
    render(<DistributorIdentityCell row={baseRow} />)
    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.getByText("alice@example.com")).toBeInTheDocument()
    expect(screen.getByText("D001")).toBeInTheDocument()
  })

  it("shows '启用' badge when not disabled", () => {
    render(<DistributorIdentityCell row={baseRow} />)
    expect(screen.getByText("启用")).toBeInTheDocument()
  })

  it("shows '已停用' badge when disabledAt is set", () => {
    render(<DistributorIdentityCell row={{ ...baseRow, disabledAt: "2024-06-01T00:00:00Z" }} />)
    expect(screen.getByText("已停用")).toBeInTheDocument()
  })

  it("does not show promo code when distributorCode is null", () => {
    render(<DistributorIdentityCell row={{ ...baseRow, distributorCode: null }} />)
    expect(screen.queryByText("D001")).not.toBeInTheDocument()
  })
})

describe("DistributorTeamCell", () => {
  it("shows inviter name and invitee count", () => {
    render(<DistributorTeamCell row={baseRow} />)
    expect(screen.getByText("Bob")).toBeInTheDocument()
    expect(screen.getByText("下线 2")).toBeInTheDocument()
  })

  it("shows dash when no inviter", () => {
    render(<DistributorTeamCell row={{ ...baseRow, inviter: null }} />)
    expect(screen.getByText("—")).toBeInTheDocument()
  })
})

describe("DistributorRow type includes salesTotal", () => {
  it("accepts salesTotal field", () => {
    const row: DistributorRow = {
      id: "1",
      email: "a@b.com",
      name: "Alice",
      distributorCode: "D001",
      discountCodeEnabled: false,
      discountPercent: null,
      disabledAt: null,
      createdAt: new Date().toISOString(),
      completedOrderCount: 3,
      salesTotal: 500,
      totalCommission: 50,
      level1CommissionTotal: 40,
      level2CommissionTotal: 10,
      level1Settled: 40,
      level2Settled: 10,
      paidTotal: 0,
      pendingTotal: 0,
      withdrawableBalance: 50,
      inviteeCount: 2,
      inviter: null,
    }
    expect(row.salesTotal).toBe(500)
  })
})
