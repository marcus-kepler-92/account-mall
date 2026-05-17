/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { render, screen, fireEvent } from "@testing-library/react"
import { DashboardDateRangePresets } from "@/app/admin/(main)/dashboard/dashboard-date-range-presets"

jest.mock("@/app/admin/(main)/dashboard/dashboard-hkt", () => ({
  todayHKT: () => "2026-05-17",
  getDashboardDateRangePresets: () => [
    { label: "今日", from: "2026-05-17", to: "2026-05-17" },
    { label: "昨日", from: "2026-05-16", to: "2026-05-16" },
    { label: "本周", from: "2026-05-12", to: "2026-05-17" },
    { label: "本月", from: "2026-05-01", to: "2026-05-17" },
  ],
}))

const defaultProps = {
  from: "2026-05-17",
  to: "2026-05-17",
  onChange: jest.fn(),
}

describe("DashboardDateRangePresets", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders date range label and trigger button", () => {
    render(<DashboardDateRangePresets {...defaultProps} />)
    expect(screen.getByText("时间范围")).toBeInTheDocument()
    expect(screen.getByText("2026-05-17")).toBeInTheDocument()
    expect(screen.getByText("今日")).toBeInTheDocument()
  })

  it("shows date range with dash when from !== to", () => {
    render(
      <DashboardDateRangePresets
        {...defaultProps}
        from="2026-05-01"
        to="2026-05-17"
      />
    )
    expect(screen.getByText("2026-05-01 – 2026-05-17")).toBeInTheDocument()
  })

  it("opens popover with options on trigger click", () => {
    render(<DashboardDateRangePresets {...defaultProps} />)
    fireEvent.click(screen.getByRole("button", { name: /今日/ }))
    expect(screen.getByText("昨日")).toBeInTheDocument()
    expect(screen.getByText("本周")).toBeInTheDocument()
    expect(screen.getByText("本月")).toBeInTheDocument()
    expect(screen.getByText("自定义")).toBeInTheDocument()
  })

  it("calls onChange with preset dates when selecting a preset", () => {
    render(<DashboardDateRangePresets {...defaultProps} />)
    fireEvent.click(screen.getByRole("button", { name: /今日/ }))
    fireEvent.click(screen.getByText("本月"))
    expect(defaultProps.onChange).toHaveBeenCalledWith("2026-05-01", "2026-05-17")
  })

  it("shows date inputs only when custom is selected", () => {
    render(<DashboardDateRangePresets {...defaultProps} />)
    fireEvent.click(screen.getByRole("button", { name: /今日/ }))
    expect(screen.queryByDisplayValue("2026-05-17")).not.toBeInTheDocument()
    fireEvent.click(screen.getByText("自定义"))
    expect(screen.getAllByDisplayValue("2026-05-17").length).toBeGreaterThan(0)
  })

  it("does not call onChange when selecting custom (only mode switch)", () => {
    render(<DashboardDateRangePresets {...defaultProps} />)
    fireEvent.click(screen.getByRole("button", { name: /今日/ }))
    fireEvent.click(screen.getByText("自定义"))
    expect(defaultProps.onChange).not.toHaveBeenCalled()
  })
})
