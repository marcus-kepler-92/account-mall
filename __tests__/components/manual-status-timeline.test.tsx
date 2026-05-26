/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { ManualStatusTimeline } from "@/app/orders/[orderNo]/manual-status-timeline"

describe("ManualStatusTimeline", () => {
    it("renders all four happy-path step labels", () => {
        render(<ManualStatusTimeline current="AWAITING_FULFILLMENT" />)
        expect(screen.getByText("待付款")).toBeInTheDocument()
        expect(screen.getByText("待发货")).toBeInTheDocument()
        expect(screen.getByText("处理中")).toBeInTheDocument()
        expect(screen.getByText("已完成")).toBeInTheDocument()
    })

    it("renders trailing ETA text when provided", () => {
        render(
            <ManualStatusTimeline
                current="AWAITING_FULFILLMENT"
                etaText="卖家通常在 15 分钟内发货"
            />,
        )
        expect(screen.getByText("卖家通常在 15 分钟内发货")).toBeInTheDocument()
    })

    it("does not render ETA text when omitted", () => {
        const { container } = render(<ManualStatusTimeline current="PROCESSING" />)
        // No trailing list item whose text starts with "卖家" — only the step
        // label "处理中" should be active.
        expect(container.textContent).not.toMatch(/卖家通常/)
    })

    it("short-circuits to a muted single-line message for CLOSED", () => {
        render(<ManualStatusTimeline current="CLOSED" />)
        expect(screen.getByText("订单已关闭，如有疑问联系客服。")).toBeInTheDocument()
        // Step labels must NOT appear in the CLOSED branch.
        expect(screen.queryByText("待付款")).not.toBeInTheDocument()
        expect(screen.queryByText("已完成")).not.toBeInTheDocument()
    })

    it("marks the PENDING step as active (in-progress, blue) when current = PENDING", () => {
        const { container } = render(<ManualStatusTimeline current="PENDING" />)
        const items = container.querySelectorAll("li")
        // The four step items + (no eta) → 4 items total.
        expect(items).toHaveLength(4)
        // PENDING is in-progress (non-terminal) → primary blue;
        // future steps stay muted.
        expect(items[0].className).toContain("text-primary")
        expect(items[1].className).toContain("text-muted-foreground")
    })

    it("paints the entire chain success-green when current = COMPLETED (terminal)", () => {
        const { container } = render(<ManualStatusTimeline current="COMPLETED" />)
        const items = container.querySelectorAll("li")
        // 待付款 / 待发货 / 处理中 (done) and 已完成 (active+terminal) all
        // use the success token — the visual reads "fully done", not "still
        // running on the last step".
        expect(items[0].className).toContain("text-success")
        expect(items[1].className).toContain("text-success")
        expect(items[2].className).toContain("text-success")
        expect(items[3].className).toContain("text-success")
    })

    it("renders a checkmark (not a spinner) on the COMPLETED step because it is terminal", () => {
        const { container } = render(<ManualStatusTimeline current="COMPLETED" />)
        // No spinning loader anywhere — COMPLETED is a terminal success state,
        // not a "we're working on it" state. The active step icon should be a
        // checkmark, matching the visual contract of "done".
        expect(container.querySelector(".animate-spin")).toBeNull()
    })

    it("renders a spinner on the active step for intermediate states (PROCESSING)", () => {
        const { container } = render(<ManualStatusTimeline current="PROCESSING" />)
        // PROCESSING is intermediate — the active node should show a spinner.
        expect(container.querySelector(".animate-spin")).not.toBeNull()
    })
})
