import { inventoryAlertsSource } from "@/lib/admin-notifications/sources/inventory-alerts"

const productFindMany = jest.fn()
const cardGroupBy = jest.fn()
const subGroupBy = jest.fn()

const prisma = {
  product: { findMany: productFindMany },
  card: { groupBy: cardGroupBy },
  restockSubscription: { groupBy: subGroupBy },
} as unknown as Parameters<typeof inventoryAlertsSource.fetch>[0]

beforeEach(() => {
  productFindMany.mockReset()
  cardGroupBy.mockReset()
  subGroupBy.mockReset()
})

describe("inventoryAlertsSource", () => {
  function setup(opts: {
    products: { id: string; name: string }[]
    unsoldByProduct: Record<string, number>
    subscribersByProduct: Record<string, number>
  }) {
    productFindMany.mockResolvedValue(opts.products)
    cardGroupBy.mockResolvedValue(
      Object.entries(opts.unsoldByProduct).map(([productId, n]) => ({ productId, _count: { id: n } })),
    )
    subGroupBy.mockResolvedValue(
      Object.entries(opts.subscribersByProduct).map(([productId, n]) => ({ productId, _count: { id: n } })),
    )
  }

  it("filters to productType=NORMAL via INVENTORY_PRODUCT_WHERE", async () => {
    setup({ products: [], unsoldByProduct: {}, subscribersByProduct: {} })
    await inventoryAlertsSource.fetch(prisma)
    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productType: "NORMAL", status: "ACTIVE" },
      }),
    )
    expect(cardGroupBy.mock.calls[0][0].where.product).toEqual({ productType: "NORMAL", status: "ACTIVE" })
    expect(subGroupBy.mock.calls[0][0].where.product).toEqual({ productType: "NORMAL", status: "ACTIVE" })
  })

  it("classifies subtype with priority RESTOCK_WAITING > OUT_OF_STOCK > LOW_STOCK", async () => {
    setup({
      products: [
        { id: "p1", name: "缺货+等候" },
        { id: "p2", name: "纯缺货" },
        { id: "p3", name: "低库存" },
        { id: "p4", name: "充足" },
      ],
      unsoldByProduct: { p3: 1, p4: 10 },
      subscribersByProduct: { p1: 3 },
    })

    const result = await inventoryAlertsSource.fetch(prisma)

    expect(result.count).toBe(3)
    const byId = Object.fromEntries(result.items.map((i) => [i.productId, i]))
    expect(byId.p1.subtype).toBe("RESTOCK_WAITING")
    expect(byId.p2.subtype).toBe("OUT_OF_STOCK")
    expect(byId.p3.subtype).toBe("LOW_STOCK")
    expect(byId.p4).toBeUndefined()
  })

  it("returns breakdown counts (overlapping by design)", async () => {
    setup({
      products: [
        { id: "a", name: "a" },
        { id: "b", name: "b" },
        { id: "c", name: "c" },
      ],
      unsoldByProduct: { c: 1 },
      subscribersByProduct: { a: 2 },
    })

    const result = await inventoryAlertsSource.fetch(prisma)

    expect(result.breakdown).toEqual({ outOfStock: 2, lowStock: 1, restockWaiting: 1 })
    expect(result.count).toBe(3)
  })

  it("sorts items: RESTOCK_WAITING first; within group by subscriberCount desc", async () => {
    setup({
      products: [
        { id: "low", name: "low" },
        { id: "out2", name: "out2" },
        { id: "out1", name: "out1" },
        { id: "wait", name: "wait" },
      ],
      unsoldByProduct: { low: 2 },
      subscribersByProduct: { wait: 5, out1: 1, out2: 3 },
    })

    const result = await inventoryAlertsSource.fetch(prisma)
    expect(result.items.map((i) => i.productId)).toEqual(["wait", "out2", "out1"])
  })

  it("returns zero state with empty items + zero breakdown", async () => {
    setup({ products: [], unsoldByProduct: {}, subscribersByProduct: {} })
    const result = await inventoryAlertsSource.fetch(prisma)
    expect(result).toEqual({ count: 0, breakdown: { outOfStock: 0, lowStock: 0, restockWaiting: 0 }, items: [] })
  })
})
