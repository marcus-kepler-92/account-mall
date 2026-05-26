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
  config: { siteUrl: "https://example.com" },
}))

jest.mock("@/lib/calculate-order-commission", () => ({
  createOrderCommissions: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@/lib/domains/distributors", () => ({
  checkAndIssueMilestoneBonuses: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@/lib/domains/variants", () => ({
  decrementVariantStock: jest.fn(),
}))

jest.mock("@/lib/wecom-notify", () => ({
  sendWecomNotification: jest.fn().mockResolvedValue(undefined),
}))

import { prismaMock } from "../../__mocks__/prisma"
import { sendOrderCompletionEmail } from "@/lib/order-completion-email"
import { createOrderCommissions } from "@/lib/calculate-order-commission"
import { decrementVariantStock } from "@/lib/domains/variants"
import { sendWecomNotification } from "@/lib/wecom-notify"

const emailMock = sendOrderCompletionEmail as jest.Mock
const commissionMock = createOrderCommissions as jest.Mock
const decStockMock = decrementVariantStock as jest.Mock
const wecomMock = sendWecomNotification as jest.Mock

function makeManualPendingOrder(overrides?: Record<string, unknown>) {
  return {
    id: "ord_m1",
    orderNo: "manual-order-1",
    status: "PENDING",
    amount: new Prisma.Decimal("29.9"),
    quantity: 1,
    distributorId: null as string | null,
    variantId: "var_1",
    email: "buyer@example.com",
    productNameSnapshot: "Netflix",
    variantNameSnapshot: "3 个月",
    expiresAt: null,
    exitDiscountMeta: null,
    product: {
      name: "Netflix",
      productType: "MANUAL",
      validityHours: null,
      // Default fixture exercises the tracked-inventory branch (decrement,
      // sold-out guard). A dedicated untracked test below verifies the opposite.
      inventoryTracked: true,
    },
    cards: [],
    ...overrides,
  } as any
}

function setupHappyTransaction() {
  // Mock variant lookup inside the transaction
  prismaMock.productVariant.findUnique.mockResolvedValue({
    id: "var_1",
    unitCost: new Prisma.Decimal("12.5"),
  } as any)
  // Stock decrement succeeds
  decStockMock.mockResolvedValue({ count: 1 })
  // Order status update succeeds (still PENDING)
  prismaMock.order.updateMany.mockResolvedValue({ count: 1 })

  prismaMock.$transaction.mockImplementation((async (fn: (tx: any) => Promise<void>) => {
    await fn(prismaMock)
  }) as any)
}

describe("completePendingOrder — MANUAL branch", () => {
  beforeEach(() => {
    emailMock.mockClear()
    commissionMock.mockClear()
    decStockMock.mockReset()
    wecomMock.mockClear()
    prismaMock.order.findFirst.mockReset()
    prismaMock.order.updateMany.mockReset()
    prismaMock.card.updateMany.mockReset()
    prismaMock.productVariant.findUnique.mockReset()
    prismaMock.$transaction.mockReset()
  })

  it("transitions PENDING → AWAITING_FULFILLMENT for MANUAL product", async () => {
    prismaMock.order.findFirst.mockResolvedValue(makeManualPendingOrder())
    setupHappyTransaction()

    const result = await completePendingOrder("manual-order-1")

    expect(result).toEqual({ done: true, orderNo: "manual-order-1" })
    expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
      where: { id: "ord_m1", status: "PENDING" },
      data: expect.objectContaining({
        status: "AWAITING_FULFILLMENT",
        paidAt: expect.any(Date),
      }),
    })
  })

  it("calls decrementVariantStock with the order's variantId inside the transaction", async () => {
    prismaMock.order.findFirst.mockResolvedValue(makeManualPendingOrder())
    setupHappyTransaction()

    await completePendingOrder("manual-order-1")

    expect(decStockMock).toHaveBeenCalledTimes(1)
    expect(decStockMock.mock.calls[0][0]).toBe("var_1")
    // Second arg is the transaction client. Just assert it was passed (not null/undefined? — at minimum it must exist or be the same prismaMock proxy).
    expect(decStockMock.mock.calls[0].length).toBeGreaterThanOrEqual(2)
  })

  it("writes costTotalSnapshot equal to the variant's unitCost", async () => {
    prismaMock.order.findFirst.mockResolvedValue(makeManualPendingOrder())
    setupHappyTransaction()

    await completePendingOrder("manual-order-1")

    const updateCall = prismaMock.order.updateMany.mock.calls[0][0] as any
    expect(updateCall.data.costTotalSnapshot).toBeDefined()
    // Either a Decimal or coercible to string "12.5"
    expect(updateCall.data.costTotalSnapshot.toString()).toBe("12.5")
  })

  it("does NOT mark cards SOLD (no card.updateMany call)", async () => {
    prismaMock.order.findFirst.mockResolvedValue(makeManualPendingOrder())
    setupHappyTransaction()

    await completePendingOrder("manual-order-1")

    expect(prismaMock.card.updateMany).not.toHaveBeenCalled()
  })

  it("does NOT call createOrderCommissions (deferred to COMPLETED)", async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      makeManualPendingOrder({ distributorId: "dist_1" }),
    )
    setupHappyTransaction()

    await completePendingOrder("manual-order-1")

    expect(commissionMock).not.toHaveBeenCalled()
    expect(emailMock).not.toHaveBeenCalled()
  })

  it("triggers sendWecomNotification('order.awaiting_fulfillment', ...) on success", async () => {
    prismaMock.order.findFirst.mockResolvedValue(makeManualPendingOrder())
    setupHappyTransaction()

    await completePendingOrder("manual-order-1")

    // Fire-and-forget — give the microtask queue a tick to flush
    await Promise.resolve()

    expect(wecomMock).toHaveBeenCalledTimes(1)
    expect(wecomMock).toHaveBeenCalledWith(
      "order.awaiting_fulfillment",
      expect.objectContaining({
        id: "ord_m1",
        orderNo: "manual-order-1",
        status: "AWAITING_FULFILLMENT",
        email: "buyer@example.com",
        productNameSnapshot: "Netflix",
        variantNameSnapshot: "3 个月",
      }),
    )
  })

  it("on stock-lock failure (count=0): order stays PENDING and no wecom notification fires", async () => {
    prismaMock.order.findFirst.mockResolvedValue(makeManualPendingOrder())
    prismaMock.productVariant.findUnique.mockResolvedValue({
      id: "var_1",
      unitCost: new Prisma.Decimal("12.5"),
    } as any)
    decStockMock.mockResolvedValue({ count: 0 })

    // Run the transaction body and propagate the sentinel throw to trigger rollback
    prismaMock.$transaction.mockImplementation((async (fn: (tx: any) => Promise<void>) => {
      await fn(prismaMock)
    }) as any)

    const result = await completePendingOrder("manual-order-1")

    expect(result).toEqual({
      done: false,
      error: expect.stringMatching(/out of stock|already completed/i),
    })
    // No order status mutation
    expect(prismaMock.order.updateMany).not.toHaveBeenCalled()
    // No notification
    expect(wecomMock).not.toHaveBeenCalled()
  })

  it("returns error and does not notify when MANUAL order is missing variantId", async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      makeManualPendingOrder({ variantId: null }),
    )

    const result = await completePendingOrder("manual-order-1")

    expect(result.done).toBe(false)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(wecomMock).not.toHaveBeenCalled()
  })

  describe("when product.inventoryTracked === false", () => {
    function makeUntrackedOrder(overrides?: Record<string, unknown>) {
      return makeManualPendingOrder({
        product: {
          name: "Custom Service",
          productType: "MANUAL",
          validityHours: null,
          inventoryTracked: false,
        },
        ...overrides,
      })
    }

    it("does NOT call decrementVariantStock", async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeUntrackedOrder())
      prismaMock.productVariant.findUnique.mockResolvedValue({
        id: "var_1",
        unitCost: new Prisma.Decimal("0"),
      } as any)
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
      prismaMock.$transaction.mockImplementation((async (fn: (tx: any) => Promise<void>) => {
        await fn(prismaMock)
      }) as any)

      const result = await completePendingOrder("manual-order-1")

      expect(result).toEqual({ done: true, orderNo: "manual-order-1" })
      expect(decStockMock).not.toHaveBeenCalled()
    })

    it("still advances PENDING → AWAITING_FULFILLMENT and fires WeCom notification", async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeUntrackedOrder())
      prismaMock.productVariant.findUnique.mockResolvedValue({
        id: "var_1",
        unitCost: new Prisma.Decimal("5"),
      } as any)
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
      prismaMock.$transaction.mockImplementation((async (fn: (tx: any) => Promise<void>) => {
        await fn(prismaMock)
      }) as any)

      await completePendingOrder("manual-order-1")
      await Promise.resolve()

      expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
        where: { id: "ord_m1", status: "PENDING" },
        data: expect.objectContaining({ status: "AWAITING_FULFILLMENT" }),
      })
      expect(wecomMock).toHaveBeenCalledTimes(1)
    })

    it("still applies the concurrent-completion guard (already AWAITING returns error)", async () => {
      prismaMock.order.findFirst.mockResolvedValue(makeUntrackedOrder())
      prismaMock.productVariant.findUnique.mockResolvedValue({
        id: "var_1",
        unitCost: new Prisma.Decimal("0"),
      } as any)
      // Concurrent payment: another caller already advanced the order, so
      // updateMany matches nothing.
      prismaMock.order.updateMany.mockResolvedValue({ count: 0 })
      prismaMock.$transaction.mockImplementation((async (fn: (tx: any) => Promise<void>) => {
        await fn(prismaMock)
      }) as any)

      const result = await completePendingOrder("manual-order-1")

      expect(result).toEqual({
        done: false,
        error: expect.stringMatching(/out of stock|already completed/i),
      })
      expect(wecomMock).not.toHaveBeenCalled()
    })
  })
})
