import { manualPendingOrdersSource } from "@/lib/admin-notifications/sources/manual-pending-orders"

const findMany = jest.fn()
const count = jest.fn()

const prisma = {
  order: { findMany, count },
} as unknown as Parameters<typeof manualPendingOrdersSource.fetch>[0]

beforeEach(() => {
  findMany.mockReset()
  count.mockReset()
})

describe("manualPendingOrdersSource", () => {
  it("points the sidebar and view-all link at the dedicated 人工发货 center", () => {
    expect(manualPendingOrdersSource.menuHref).toBe("/admin/fulfillment")
    expect(manualPendingOrdersSource.viewAllHref).toBe("/admin/fulfillment")
  })

  it("counts MANUAL orders in AWAITING/PROCESSING and surfaces items with dun-aware fingerprint", async () => {
    count.mockResolvedValue(4)
    findMany.mockResolvedValue([
      {
        id: "o1",
        orderNo: "ORD-1",
        amount: 9.9,
        status: "AWAITING_FULFILLMENT",
        dunCount: 2,
        createdAt: new Date("2026-05-21T10:00:00Z"),
        variantNameSnapshot: "标准版",
        productNameSnapshot: "测试商品 A",
        product: { name: "fallback A" },
      },
      {
        id: "o2",
        orderNo: "ORD-2",
        amount: 19.9,
        status: "PROCESSING",
        dunCount: 0,
        createdAt: new Date("2026-05-21T09:00:00Z"),
        variantNameSnapshot: null,
        productNameSnapshot: null,
        product: { name: "fallback B" },
      },
    ])

    const result = await manualPendingOrdersSource.fetch(prisma)

    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["AWAITING_FULFILLMENT", "PROCESSING"] },
          product: { is: { productType: "MANUAL" } },
        }),
      }),
    )
    expect(result.count).toBe(4)
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: "o1",
        fingerprint: "v1:2",
        productName: "测试商品 A",
        variantName: "标准版",
        dunCount: 2,
        status: "AWAITING_FULFILLMENT",
      }),
    )
    // Falls back to product.name when snapshot missing.
    expect(result.items[1].productName).toBe("fallback B")
    expect(result.items[1].variantName).toBeNull()
  })
})
