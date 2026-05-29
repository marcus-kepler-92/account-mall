import { prismaMock } from "../../../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

// ProductsTableWrapper renders client components — stub it out
jest.mock(
    "@/app/admin/(main)/products/products-table-wrapper",
    () => ({ ProductsTableWrapper: () => null }),
)
jest.mock("@/app/admin/components", () => ({ PageHeader: () => null }))
jest.mock("@/lib/admin-permissions", () => ({
    __esModule: true,
    getAdminPermissions: jest.fn().mockResolvedValue({ isSuperAdmin: true }),
}))

import AdminProductsPage from "@/app/admin/(main)/products/page"

const baseProduct = {
    id: "p1",
    name: "Product A",
    slug: "product-a",
    status: "ACTIVE" as const,
    productType: "CARD",
    price: 100,
    sortOrder: 0,
    tags: [],
    // page.tsx fetches products with `include: { variants }` and maps over
    // p.variants — mirror that shape so the row mapper doesn't hit undefined.
    variants: [],
    createdAt: new Date(),
    updatedAt: new Date(),
}

describe("AdminProductsPage — sales query", () => {
    beforeEach(() => {
        prismaMock.product.findMany.mockResolvedValue([baseProduct] as any)
        prismaMock.card.groupBy.mockResolvedValue([])
        prismaMock.order.groupBy.mockResolvedValue([])
        prismaMock.restockSubscription.groupBy.mockResolvedValue([])
        // MANUAL ⚠缺 SKU badge feature (Fix D) added a productVariant.groupBy
        // call in this page's Promise.all. Default to empty so tests focused
        // on other concerns aren't affected.
        prismaMock.productVariant.groupBy.mockResolvedValue([])
    })

    it("queries completed orders with quantity sum", async () => {
        await AdminProductsPage({ searchParams: Promise.resolve({}) })

        expect(prismaMock.order.groupBy).toHaveBeenCalledWith(
            expect.objectContaining({
                by: ["productId"],
                where: { status: "COMPLETED" },
                _sum: { quantity: true },
            }),
        )
    })

    it("maps sales from completed order quantity sum", async () => {
        prismaMock.order.groupBy.mockResolvedValue([
            { productId: "p1", _sum: { quantity: 7 } },
        ] as any)

        const jsx = await AdminProductsPage({ searchParams: Promise.resolve({}) })
        // Extract data prop from ProductsTableWrapper element
        const wrapper = (jsx as any).props.children.find(
            (c: any) => c?.type?.name === "ProductsTableWrapper" || c?.props?.data,
        )
        const data = wrapper?.props?.data
        expect(data?.[0]?.sales).toBe(7)
    })

    it("defaults sales to 0 when product has no completed orders", async () => {
        prismaMock.order.groupBy.mockResolvedValue([])

        const jsx = await AdminProductsPage({ searchParams: Promise.resolve({}) })
        const wrapper = (jsx as any).props.children.find((c: any) => c?.props?.data)
        const data = wrapper?.props?.data
        expect(data?.[0]?.sales).toBe(0)
    })

    it("passes defaultFilters { hasAlert: true } when notice=inventory", async () => {
        const jsx = await AdminProductsPage({
            searchParams: Promise.resolve({ notice: "inventory" }),
        })
        const wrapper = (jsx as any).props.children.find((c: any) => c?.props?.data)
        expect(wrapper?.props?.defaultFilters).toEqual({ hasAlert: true })
    })

    it("does not pass defaultFilters when notice query is absent", async () => {
        const jsx = await AdminProductsPage({ searchParams: Promise.resolve({}) })
        const wrapper = (jsx as any).props.children.find((c: any) => c?.props?.data)
        expect(wrapper?.props?.defaultFilters).toBeUndefined()
    })
})
