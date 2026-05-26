/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { ProductBottomBar } from "@/app/components/product-bottom-bar"
import { useProductPriceSyncStore } from "@/lib/stores/product-price-sync"
import { useTurnstileStore } from "@/lib/stores/turnstile"
import type { ManualDisplay } from "@/lib/manual-display"

function resetStores() {
    act(() => {
        useProductPriceSyncStore.setState({ display: null })
        useTurnstileStore.setState({ token: null, status: "ready" })
    })
}

const manualSoldOut: ManualDisplay = {
    isManual: true,
    isUnavailable: false,
    priceMin: 9.9,
    priceMax: 24.9,
    priceLabel: "¥9.90 起",
}

describe("ProductBottomBar — MANUAL sold-out CTA", () => {
    beforeEach(() => {
        resetStores()
    })

    it("renders 联系客服 button text when MANUAL and out of stock", () => {
        render(
            <ProductBottomBar
                price={0}
                inStock={false}
                orderSectionId="order-section"
                manual={manualSoldOut}
            />,
        )
        expect(screen.getByRole("button", { name: /联系客服/ })).toBeInTheDocument()
    })

    it("does NOT show 催货 in the bottom-bar hint when MANUAL", () => {
        render(
            <ProductBottomBar
                price={0}
                inStock={false}
                orderSectionId="order-section"
                manual={manualSoldOut}
            />,
        )
        expect(screen.queryByText(/催货告诉我们你要/)).not.toBeInTheDocument()
        expect(screen.getByText(/暂无库存，可联系客服/)).toBeInTheDocument()
    })

    it("dispatches `open-customer-service` event when sold-out MANUAL CTA is clicked", () => {
        const listener = jest.fn()
        document.addEventListener("open-customer-service", listener)

        render(
            <ProductBottomBar
                price={0}
                inStock={false}
                orderSectionId="order-section"
                manual={manualSoldOut}
            />,
        )

        fireEvent.click(screen.getByRole("button", { name: /联系客服/ }))
        expect(listener).toHaveBeenCalledTimes(1)

        document.removeEventListener("open-customer-service", listener)
    })

    it("does NOT dispatch open-restock-dialog for MANUAL", () => {
        const restockListener = jest.fn()
        document.addEventListener("open-restock-dialog", restockListener)

        render(
            <ProductBottomBar
                price={0}
                inStock={false}
                orderSectionId="order-section"
                manual={manualSoldOut}
            />,
        )
        fireEvent.click(screen.getByRole("button", { name: /联系客服/ }))
        expect(restockListener).not.toHaveBeenCalled()

        document.removeEventListener("open-restock-dialog", restockListener)
    })

    it("shows the MANUAL price label (with 起 for ranged pricing) when no live variant price is selected", () => {
        render(
            <ProductBottomBar
                price={0}
                inStock={false}
                orderSectionId="order-section"
                manual={manualSoldOut}
            />,
        )
        // Bottom bar renders "¥<price-or-label>", and for MANUAL falls back to
        // the helper's preformatted label minus its leading ¥.
        expect(screen.getByText(/¥9.90 起/)).toBeInTheDocument()
    })
})

describe("ProductBottomBar — NORMAL sold-out keeps 催货", () => {
    beforeEach(() => {
        resetStores()
    })

    it("renders 催货 CTA and dispatches open-restock-dialog (not customer-service)", () => {
        const restockListener = jest.fn()
        const csListener = jest.fn()
        document.addEventListener("open-restock-dialog", restockListener)
        document.addEventListener("open-customer-service", csListener)

        render(
            <ProductBottomBar
                price={19.9}
                inStock={false}
                orderSectionId="order-section"
            />,
        )

        const cta = screen.getByRole("button", { name: /催货/ })
        fireEvent.click(cta)

        expect(restockListener).toHaveBeenCalledTimes(1)
        expect(csListener).not.toHaveBeenCalled()

        document.removeEventListener("open-restock-dialog", restockListener)
        document.removeEventListener("open-customer-service", csListener)
    })
})
