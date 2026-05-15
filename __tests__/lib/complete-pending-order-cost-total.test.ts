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

type CardInput = { unitCost: string | number | null; status?: string }

function makeOrder(
  cards: CardInput[],
  productOverrides?: Record<string, unknown> | null,
) {
  return {
    id: "ord_ct",
    orderNo: "ct-order-1",
    status: "PENDING",
    amount: new Prisma.Decimal("50"),
    quantity: cards.length,
    distributorId: null,
    exitDiscountMeta: null,
    product:
      productOverrides === null
        ? null
        : {
            name: "Test Product",
            productType: "NORMAL",
            validityHours: null,
            ...productOverrides,
          },
    cards: cards.map((c, i) => ({
      id: `c_${i}`,
      status: c.status ?? "RESERVED",
      unitCost:
        c.unitCost === null
          ? null
          : typeof c.unitCost === "string"
            ? new Prisma.Decimal(c.unitCost)
            : new Prisma.Decimal(c.unitCost),
    })),
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

function getCostTotalArg(): Prisma.Decimal {
  return prismaMock.order.updateMany.mock.calls[0][0].data.costTotalSnapshot as Prisma.Decimal
}

describe("completePendingOrder — costTotalSnapshot aggregation", () => {
  it("sums unitCost across all RESERVED cards", async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      makeOrder([{ unitCost: "5.50" }, { unitCost: "5.50" }, { unitCost: "2.00" }]),
    )
    setupTransaction()

    await completePendingOrder("ct-order-1")

    // 5.50 + 5.50 + 2.00 = 13.00
    expect(getCostTotalArg().toString()).toBe("13")
  })

  it("treats null unitCost as 0 (legacy cards)", async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      makeOrder([{ unitCost: null }, { unitCost: "3.00" }]),
    )
    setupTransaction()

    await completePendingOrder("ct-order-1")

    expect(getCostTotalArg().toString()).toBe("3")
  })

  it("writes 0 when all unitCost values are null (legacy/AUTO_FETCH fallthrough)", async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      makeOrder([{ unitCost: null }, { unitCost: null }]),
    )
    setupTransaction()

    await completePendingOrder("ct-order-1")

    expect(getCostTotalArg().toString()).toBe("0")
  })

  it("writes 0 for AUTO_FETCH orders where every card stores explicit 0", async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      makeOrder([{ unitCost: "0" }], { productType: "AUTO_FETCH" }),
    )
    setupTransaction()

    await completePendingOrder("ct-order-1")

    expect(getCostTotalArg().toString()).toBe("0")
  })

  it("ignores cards that are not RESERVED (e.g. unrelated SOLD/UNSOLD)", async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      makeOrder([
        { unitCost: "10.00", status: "RESERVED" },
        { unitCost: "999.00", status: "UNSOLD" }, // should not be summed
        { unitCost: "888.00", status: "SOLD" }, // should not be summed
      ]),
    )
    setupTransaction()

    await completePendingOrder("ct-order-1")

    expect(getCostTotalArg().toString()).toBe("10")
  })

  it("does not write the legacy costSnapshot field", async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      makeOrder([{ unitCost: "1.00" }]),
    )
    setupTransaction()

    await completePendingOrder("ct-order-1")

    const data = prismaMock.order.updateMany.mock.calls[0][0].data
    expect(data.costSnapshot).toBeUndefined()
  })

  it("aggregates without floating-point drift across many small values", async () => {
    // 100 cards × 0.07 ≠ 7 in naive float math (0.07 * 100 = 7.000000000000001)
    const cards = Array.from({ length: 100 }, () => ({ unitCost: "0.07" }))
    prismaMock.order.findFirst.mockResolvedValue(makeOrder(cards))
    setupTransaction()

    await completePendingOrder("ct-order-1")

    expect(getCostTotalArg().toString()).toBe("7")
  })
})
