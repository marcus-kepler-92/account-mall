/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ProductStockCell } from "@/app/admin/(main)/products/product-stock-cell"

jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: jest.fn(), replace: jest.fn() }),
    usePathname: () => "/admin/products",
}))

jest.mock("sonner", () => ({
    toast: { error: jest.fn(), success: jest.fn() },
}))

jest.mock("@/app/admin/hooks/use-admin-notifications", () => ({
    useInvalidateAdminNotifications: () => jest.fn(),
}))

const baseProps = {
    productId: "prod-1",
    stock: 128,
    stockLabel: "128",
    subscriberCount: 0,
    costPerUnit: 8.8,
}

describe("ProductStockCell", () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe("clickability by product type", () => {
        it("renders a restock button for NORMAL products", () => {
            render(<ProductStockCell {...baseProps} productType="NORMAL" />)
            const btn = screen.getByRole("button", { name: "128" })
            expect(btn).toHaveAttribute("title", "点击补货")
        })

        it("renders plain text (no button) for AUTO_FETCH products", () => {
            render(
                <ProductStockCell {...baseProps} productType="AUTO_FETCH" stockLabel="不限" />,
            )
            expect(screen.queryByRole("button")).not.toBeInTheDocument()
            expect(screen.getByText("不限")).toBeInTheDocument()
        })

        it("renders plain text (no button) for MANUAL products", () => {
            render(<ProductStockCell {...baseProps} productType="MANUAL" />)
            expect(screen.queryByRole("button")).not.toBeInTheDocument()
        })
    })

    describe("alert tone", () => {
        it("marks out-of-stock (0) as destructive", () => {
            render(
                <ProductStockCell {...baseProps} productType="NORMAL" stock={0} stockLabel="0" />,
            )
            expect(screen.getByRole("button", { name: "0" })).toHaveClass("text-destructive")
        })

        it("marks waiting-for-restock (0 with subscribers) as destructive and surfaces count in title", () => {
            render(
                <ProductStockCell
                    {...baseProps}
                    productType="NORMAL"
                    stock={0}
                    stockLabel="0"
                    subscriberCount={3}
                />,
            )
            const btn = screen.getByRole("button", { name: "0" })
            expect(btn).toHaveClass("text-destructive")
            expect(btn).toHaveAttribute("title", "3 人等待补货，点击补货")
        })

        it("marks low stock (< 3) as amber", () => {
            render(
                <ProductStockCell {...baseProps} productType="NORMAL" stock={2} stockLabel="2" />,
            )
            expect(screen.getByRole("button", { name: "2" })).toHaveClass("text-amber-600")
        })

        it("leaves healthy stock untinted", () => {
            render(<ProductStockCell {...baseProps} productType="NORMAL" />)
            const btn = screen.getByRole("button", { name: "128" })
            expect(btn).not.toHaveClass("text-destructive")
            expect(btn).not.toHaveClass("text-amber-600")
        })
    })

    describe("import dialog wiring", () => {
        it("opens the import dialog with current stock and prefilled cost on click", async () => {
            render(
                <ProductStockCell
                    {...baseProps}
                    productType="NORMAL"
                    stock={2}
                    stockLabel="2"
                    costPerUnit={5.5}
                />,
            )

            fireEvent.click(screen.getByRole("button", { name: "2" }))

            await waitFor(() => {
                expect(screen.getByText("批量导入卡密")).toBeInTheDocument()
            })
            expect(screen.getByText(/当前未售 2 张/)).toBeInTheDocument()
            expect(screen.getByLabelText(/采购成本/)).toHaveValue(5.5)
        })
    })
})
