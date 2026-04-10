/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { TierProgress } from "@/app/distributor/(main)/tier-progress"

describe("TierProgress", () => {
  it("renders current sales and next tier threshold labels", () => {
    render(<TierProgress weeklySalesTotal={300} nextTierMinAmount={1000} />)
    expect(screen.getByText("¥300.00")).toBeInTheDocument()
    expect(screen.getByText("¥1000.00")).toBeInTheDocument()
  })

  it("sets progress bar width proportionally", () => {
    const { container } = render(
      <TierProgress weeklySalesTotal={500} nextTierMinAmount={1000} />,
    )
    const bar = container.querySelector(".bg-primary") as HTMLElement
    expect(bar.style.width).toBe("50%")
  })

  it("clamps progress bar width to 100% when sales exceed next tier threshold", () => {
    const { container } = render(
      <TierProgress weeklySalesTotal={1500} nextTierMinAmount={1000} />,
    )
    const bar = container.querySelector(".bg-primary") as HTMLElement
    expect(bar.style.width).toBe("100%")
  })

  it("sets width to 0% when there are no sales", () => {
    const { container } = render(
      <TierProgress weeklySalesTotal={0} nextTierMinAmount={1000} />,
    )
    const bar = container.querySelector(".bg-primary") as HTMLElement
    expect(bar.style.width).toBe("0%")
  })

  it("formats labels to two decimal places", () => {
    render(<TierProgress weeklySalesTotal={123.4} nextTierMinAmount={500.1} />)
    expect(screen.getByText("¥123.40")).toBeInTheDocument()
    expect(screen.getByText("¥500.10")).toBeInTheDocument()
  })
})
