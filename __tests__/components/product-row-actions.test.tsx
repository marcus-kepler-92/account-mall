/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ProductRowActions } from "@/app/admin/(main)/products/product-row-actions"

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

// Radix DropdownMenu relies on pointer-capture / scrollIntoView APIs that jsdom
// does not implement. Stub them so the menu can open.
beforeAll(() => {
    Element.prototype.hasPointerCapture = jest.fn()
    Element.prototype.setPointerCapture = jest.fn()
    Element.prototype.releasePointerCapture = jest.fn()
    Element.prototype.scrollIntoView = jest.fn()
})

const baseProps = {
    productId: "prod-1",
    productName: "测试商品",
    slug: "test-product",
    status: "ACTIVE",
    isFree: false,
    isSuperAdmin: false,
    costPerUnit: 8.8,
}

function openMenu() {
    const trigger = screen.getByRole("button", { name: /操作菜单/ })
    fireEvent.keyDown(trigger, { key: "Enter" })
}

describe("ProductRowActions — 导入卡密 menu item", () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it("shows both 导入卡密 and 管理卡密 for NORMAL products", async () => {
        render(<ProductRowActions {...baseProps} productType="NORMAL" />)
        openMenu()

        await waitFor(() => {
            expect(screen.getByRole("menuitem", { name: /导入卡密/ })).toBeInTheDocument()
            expect(screen.getByRole("menuitem", { name: /管理卡密/ })).toBeInTheDocument()
        })
    })

    it("hides 导入卡密 for AUTO_FETCH products", async () => {
        render(<ProductRowActions {...baseProps} productType="AUTO_FETCH" />)
        openMenu()

        await waitFor(() => {
            // 黑名单管理 confirms the menu is open for this product type
            expect(screen.getByRole("menuitem", { name: /黑名单管理/ })).toBeInTheDocument()
        })
        expect(screen.queryByRole("menuitem", { name: /导入卡密/ })).not.toBeInTheDocument()
        expect(screen.queryByRole("menuitem", { name: /管理卡密/ })).not.toBeInTheDocument()
    })

    it("hides 导入卡密 for MANUAL products", async () => {
        render(<ProductRowActions {...baseProps} productType="MANUAL" />)
        openMenu()

        await waitFor(() => {
            // 编辑 is always present — confirms the menu opened
            expect(screen.getByRole("menuitem", { name: /编辑/ })).toBeInTheDocument()
        })
        expect(screen.queryByRole("menuitem", { name: /导入卡密/ })).not.toBeInTheDocument()
    })

    it("opens the import dialog (prefilled with costPerUnit) when 导入卡密 is clicked", async () => {
        render(<ProductRowActions {...baseProps} productType="NORMAL" />)
        openMenu()

        const item = await screen.findByRole("menuitem", { name: /导入卡密/ })
        fireEvent.click(item)

        await waitFor(() => {
            expect(screen.getByText("批量导入卡密")).toBeInTheDocument()
        })
        expect(screen.getByLabelText(/采购成本/)).toHaveValue(8.8)
    })
})
