/**
 * Verifies that completePendingOrder calls checkAndIssueMilestoneBonuses at the
 * right times. Commission creation is mocked out so these tests focus solely on
 * the milestone integration point.
 */

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/order-completion-email", () => ({
    sendOrderCompletionEmail: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@/lib/domains/distributors", () => ({
    checkAndIssueMilestoneBonuses: jest.fn().mockResolvedValue(undefined),
    createOrderCommissions: jest.fn().mockResolvedValue(undefined),
}))

import { Prisma } from "@prisma/client"
import { completePendingOrder } from "@/lib/complete-pending-order"
import { prismaMock } from "../../__mocks__/prisma"
import { checkAndIssueMilestoneBonuses, createOrderCommissions } from "@/lib/domains/distributors"

const checkMock = checkAndIssueMilestoneBonuses as jest.Mock
const createMock = createOrderCommissions as jest.Mock

function makePendingOrder(overrides: Record<string, unknown> = {}) {
    return {
        id: "ord_1",
        orderNo: "order-1",
        status: "PENDING",
        amount: new Prisma.Decimal("100"),
        distributorId: null as string | null,
        email: "buyer@example.com",
        discountPercentApplied: 0,
        exitDiscountMeta: null,
        expiresAt: null,
        product: { name: "Test", productType: "NORMAL", validityHours: null },
        cards: [{ id: "c1", status: "RESERVED" }],
        ...overrides,
    } as never
}

beforeEach(() => {
    jest.clearAllMocks()
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<void>) => {
        await fn(prismaMock)
    })
    prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
})

describe("completePendingOrder — milestone integration", () => {
    it("calls checkAndIssueMilestoneBonuses with the order's distributorId", async () => {
        prismaMock.order.findFirst.mockResolvedValue(makePendingOrder({ distributorId: "dist_A" }))

        await completePendingOrder("order-1")

        expect(checkMock).toHaveBeenCalledTimes(1)
        expect(checkMock).toHaveBeenCalledWith(prismaMock, "dist_A")
    })

    it("does NOT call checkAndIssueMilestoneBonuses when order has no distributorId", async () => {
        prismaMock.order.findFirst.mockResolvedValue(makePendingOrder({ distributorId: null }))

        await completePendingOrder("order-1")

        expect(checkMock).not.toHaveBeenCalled()
    })

    it("does NOT call checkAndIssueMilestoneBonuses when order is already COMPLETED", async () => {
        prismaMock.order.findFirst.mockResolvedValue(
            makePendingOrder({ status: "COMPLETED", distributorId: "dist_A" })
        )

        await completePendingOrder("order-1")

        expect(checkMock).not.toHaveBeenCalled()
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })

    it("does NOT call checkAndIssueMilestoneBonuses when concurrent completion wins (count=0)", async () => {
        prismaMock.order.findFirst.mockResolvedValue(makePendingOrder({ distributorId: "dist_A" }))
        prismaMock.order.updateMany.mockResolvedValue({ count: 0 })

        await completePendingOrder("order-1")

        expect(checkMock).not.toHaveBeenCalled()
    })

    it("calls checkAndIssueMilestoneBonuses inside the same transaction", async () => {
        let capturedTx: unknown
        prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<void>) => {
            capturedTx = prismaMock
            await fn(prismaMock)
        })
        prismaMock.order.findFirst.mockResolvedValue(makePendingOrder({ distributorId: "dist_B" }))

        await completePendingOrder("order-1")

        // The tx argument passed to the mock must be the same object used in the transaction
        expect(checkMock.mock.calls[0][0]).toBe(capturedTx)
    })

    it("forwards product commissionMode/commissionValue + order quantity to createOrderCommissions (FIXED end-to-end)", async () => {
        prismaMock.order.findFirst.mockResolvedValue(makePendingOrder({
            distributorId: "dist_A",
            quantity: 2,
            product: {
                name: "T",
                productType: "NORMAL",
                validityHours: null,
                commissionMode: "FIXED_PERCENT",
                commissionValue: new Prisma.Decimal("20"),
            },
        }))

        await completePendingOrder("order-1")

        // The completion path must read product.commissionMode/Value + order.quantity
        // and pass them through — otherwise FIXED settlement silently falls back to GLOBAL.
        expect(createMock).toHaveBeenCalledWith(
            prismaMock,
            expect.objectContaining({
                distributorId: "dist_A",
                commissionMode: "FIXED_PERCENT",
                quantity: 2,
            }),
        )
        expect(Number(createMock.mock.calls[0][1].commissionValue)).toBe(20)
    })

    it("falls back to GLOBAL when product has no commissionMode (defensive)", async () => {
        prismaMock.order.findFirst.mockResolvedValue(makePendingOrder({
            distributorId: "dist_A",
            quantity: 1,
            // product without commissionMode (legacy/edge) → caller defaults GLOBAL
        }))

        await completePendingOrder("order-1")

        expect(createMock).toHaveBeenCalledWith(
            prismaMock,
            expect.objectContaining({ commissionMode: "GLOBAL" }),
        )
    })
})
