import { Prisma } from "@prisma/client"
import { completePendingOrder } from "@/lib/complete-pending-order"

jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../__mocks__/prisma")
  return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/order-completion-email", () => ({
  sendOrderCompletionEmail: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@/lib/config", () => ({
  getConfig: jest.fn(() => ({ level2CommissionRatePercent: 20 })),
}))

import { prismaMock } from "../../__mocks__/prisma"

function makeCostOrder(productOverrides?: Record<string, unknown> | null) {
  return {
    id: "ord_cs",
    orderNo: "cs-order-1",
    status: "PENDING",
    amount: new Prisma.Decimal("50"),
    quantity: 1,
    distributorId: null,
    exitDiscountMeta: null,
    product:
      productOverrides === null
        ? null
        : {
            name: "Test Product",
            productType: "NORMAL",
            validityHours: null,
            costPerUnit: null,
            ...productOverrides,
          },
    cards: [{ id: "c_cs", status: "RESERVED" }],
  } as any
}

function setupTransaction() {
  prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
  prismaMock.$transaction.mockImplementation(
    (async (fn: (tx: any) => Promise<void>) => {
      await fn(prismaMock)
    }) as any,
  )
}

describe("completePendingOrder — costSnapshot", () => {
  it("writes product.costPerUnit to costSnapshot when set", async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      makeCostOrder({ costPerUnit: new Prisma.Decimal("5.50") }),
    )
    setupTransaction()

    await completePendingOrder("cs-order-1")

    const updateData = prismaMock.order.updateMany.mock.calls[0][0].data
    expect(updateData.costSnapshot).toEqual(new Prisma.Decimal("5.50"))
  })

  it("writes null to costSnapshot when product.costPerUnit is null", async () => {
    prismaMock.order.findFirst.mockResolvedValue(makeCostOrder())
    setupTransaction()

    await completePendingOrder("cs-order-1")

    const updateData = prismaMock.order.updateMany.mock.calls[0][0].data
    expect(updateData.costSnapshot).toBeNull()
  })

  it("writes null to costSnapshot when order has no product", async () => {
    prismaMock.order.findFirst.mockResolvedValue(makeCostOrder(null))
    setupTransaction()

    await completePendingOrder("cs-order-1")

    const updateData = prismaMock.order.updateMany.mock.calls[0][0].data
    expect(updateData.costSnapshot).toBeNull()
  })
})
