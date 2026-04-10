/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import type { DistributorRow } from "@/app/admin/(main)/distributors/distributors-columns"

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
