/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { render, screen, fireEvent } from "@testing-library/react"
import { ProductVariantSelector } from "@/app/components/product-variant-selector"

const variants = [
    { id: "v1", name: "1 个月", price: "9.90", stockQuantity: 5, isActive: true },
    { id: "v2", name: "3 个月", price: "24.90", stockQuantity: 0, isActive: true },
    { id: "v3", name: "下架款", price: "99.00", stockQuantity: 10, isActive: false },
]

describe("ProductVariantSelector", () => {
    it("renders only active variants", () => {
        render(<ProductVariantSelector variants={variants} value={null} onChange={() => {}} />)
        expect(screen.getByText("1 个月")).toBeInTheDocument()
        expect(screen.getByText("3 个月")).toBeInTheDocument()
        expect(screen.queryByText("下架款")).not.toBeInTheDocument()
    })

    it("marks sold-out variant as disabled and shows tag", () => {
        render(<ProductVariantSelector variants={variants} value={null} onChange={() => {}} />)
        const soldOutButton = screen.getByText("3 个月").closest("button")
        expect(soldOutButton).toBeDisabled()
        expect(screen.getByText("已售罄")).toBeInTheDocument()
    })

    it("calls onChange when user picks a variant", () => {
        const onChange = jest.fn()
        render(<ProductVariantSelector variants={variants} value={null} onChange={onChange} />)
        fireEvent.click(screen.getByText("1 个月"))
        expect(onChange).toHaveBeenCalledWith("v1")
    })

    it("ignores clicks on sold-out variants", () => {
        const onChange = jest.fn()
        render(<ProductVariantSelector variants={variants} value={null} onChange={onChange} />)
        fireEvent.click(screen.getByText("3 个月"))
        expect(onChange).not.toHaveBeenCalled()
    })

    it("renders price with ¥ prefix", () => {
        render(<ProductVariantSelector variants={variants} value={null} onChange={() => {}} />)
        expect(screen.getByText("¥9.90")).toBeInTheDocument()
        expect(screen.getByText("¥24.90")).toBeInTheDocument()
    })

    it("aria-pressed reflects current selection", () => {
        render(<ProductVariantSelector variants={variants} value="v1" onChange={() => {}} />)
        const selected = screen.getByText("1 个月").closest("button")
        const other = screen.getByText("3 个月").closest("button")
        expect(selected).toHaveAttribute("aria-pressed", "true")
        expect(other).toHaveAttribute("aria-pressed", "false")
    })

    it("renders nothing when no active variants", () => {
        const { container } = render(
            <ProductVariantSelector
                variants={[{ id: "v1", name: "x", price: "1.00", stockQuantity: 5, isActive: false }]}
                value={null}
                onChange={() => {}}
            />,
        )
        expect(container).toBeEmptyDOMElement()
    })
})
