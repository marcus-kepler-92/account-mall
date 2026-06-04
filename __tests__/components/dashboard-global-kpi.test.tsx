/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { DashboardGlobalKPI } from "@/app/admin/(main)/dashboard/dashboard-global-kpi"
import type { GlobalKPI } from "@/app/admin/(main)/dashboard/dashboard-data"

const baseKpi: GlobalKPI = {
  todayFreeCount: 18,
  todayPaidCount: 2,
  todayConversionRate: 0.1,
  todayNewDistributors: 3,
  todayRefundAmount: 0,
  awaitingFulfillmentCount: 0,
}

function renderKpi(overrides: Partial<GlobalKPI> = {}) {
  return render(<DashboardGlobalKPI kpi={{ ...baseKpi, ...overrides }} />)
}

describe("DashboardGlobalKPI", () => {
  it("renders today's conversion rate with a paid/free breakdown", () => {
    renderKpi({ todayConversionRate: 0.1, todayPaidCount: 2, todayFreeCount: 18 })
    expect(screen.getByText("今日转化率")).toBeInTheDocument()
    expect(screen.getByText("10.0%")).toBeInTheDocument()
    expect(screen.getByText("付费 2 · 领取 18")).toBeInTheDocument()
  })

  it("renders new distributor count", () => {
    renderKpi({ todayNewDistributors: 3 })
    expect(screen.getByText("今日新增分销员")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
  })

  it("renders refund amount in destructive color only when positive", () => {
    const { rerender } = renderKpi({ todayRefundAmount: 59.5 })
    const positive = screen.getByText("¥59.50")
    expect(positive).toBeInTheDocument()
    expect(positive).toHaveClass("text-destructive")

    rerender(<DashboardGlobalKPI kpi={{ ...baseKpi, todayRefundAmount: 0 }} />)
    const zero = screen.getByText("¥0.00")
    expect(zero).not.toHaveClass("text-destructive")
  })

  it("shows the fulfillment backlog count and links to the fulfillment page", () => {
    renderKpi({ awaitingFulfillmentCount: 7 })
    expect(screen.getByText("7 单")).toBeInTheDocument()
    const link = screen.getByRole("link")
    expect(link).toHaveAttribute("href", "/admin/fulfillment")
  })

  it("shows an empty state for the fulfillment card when backlog is cleared", () => {
    renderKpi({ awaitingFulfillmentCount: 0 })
    expect(screen.getByText("已清空")).toBeInTheDocument()
  })
})
