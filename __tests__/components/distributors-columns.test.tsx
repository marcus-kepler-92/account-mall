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
  weeklySalesTotal: 100,
  totalCommission: 50,
  level1CommissionTotal: 40,
  level2CommissionTotal: 10,
  level1Settled: 40,
  level2Settled: 10,
  paidTotal: 0,
  pendingTotal: 0,
  withdrawableBalance: 50,
  inviteeCount: 2,
  invitees: [{ id: "3", name: "Carol", distributorCode: "D003" }],
  inviter: { id: "2", name: "Bob", distributorCode: "D002" },
  milestoneSummary: null,
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

  it("shows dash when no inviter and no invitees", () => {
    render(<DistributorTeamCell row={{ ...baseRow, inviter: null, inviteeCount: 0, invitees: [] }} />)
    expect(screen.getByText("—")).toBeInTheDocument()
  })

  it("shows invitee count badge when no inviter but has invitees", () => {
    render(<DistributorTeamCell row={{ ...baseRow, inviter: null }} />)
    expect(screen.getByText("下线 2")).toBeInTheDocument()
  })
})

import { DistributorSalesCell, DistributorDiscountCell } from "@/app/admin/(main)/distributors/distributors-columns"

describe("DistributorSalesCell", () => {
  it("shows formatted GMV and order count", () => {
    render(<DistributorSalesCell row={baseRow} />)
    expect(screen.getByText("¥500.00")).toBeInTheDocument()
    expect(screen.getByText("3 单")).toBeInTheDocument()
  })

  it("shows ¥0.00 and 0 单 when sales are zero", () => {
    render(<DistributorSalesCell row={{ ...baseRow, salesTotal: 0, completedOrderCount: 0 }} />)
    expect(screen.getByText("¥0.00")).toBeInTheDocument()
    expect(screen.getByText("0 单")).toBeInTheDocument()
  })
})

describe("DistributorDiscountCell", () => {
  it("shows '关闭' when discount code is not enabled", () => {
    render(<DistributorDiscountCell row={baseRow} />)
    expect(screen.getByText("关闭")).toBeInTheDocument()
  })

  it("shows enabled badge with percent", () => {
    render(<DistributorDiscountCell row={{ ...baseRow, discountCodeEnabled: true, discountPercent: 8 }} />)
    expect(screen.getByText("已启用 · 8%")).toBeInTheDocument()
  })

  it("shows enabled badge without percent when percent is null", () => {
    render(<DistributorDiscountCell row={{ ...baseRow, discountCodeEnabled: true, discountPercent: null }} />)
    expect(screen.getByText("已启用")).toBeInTheDocument()
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
      weeklySalesTotal: 100,
      totalCommission: 50,
      level1CommissionTotal: 40,
      level2CommissionTotal: 10,
      level1Settled: 40,
      level2Settled: 10,
      paidTotal: 0,
      pendingTotal: 0,
      withdrawableBalance: 50,
      inviteeCount: 2,
      invitees: [],
      inviter: null,
      milestoneSummary: null,
    }
    expect(row.salesTotal).toBe(500)
  })
})
