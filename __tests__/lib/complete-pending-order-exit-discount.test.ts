import { completePendingOrder } from "@/lib/complete-pending-order"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/order-completion-email", () => ({
    sendOrderCompletionEmail: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@/lib/config", () => ({
    getConfig: jest.fn(() => ({ invitationRewardAmount: 5 })),
}))

function makePendingOrderWithMeta(exitDiscountMeta: string | null = null) {
    return {
        id: "ord_1",
        orderNo: "order-1",
        status: "PENDING",
        amount: 95,
        quantity: 1,
        email: "buyer@example.com",
        distributorId: null as string | null,
        discountPercentApplied: null,
        exitDiscountMeta,
        product: { name: "Test" },
        cards: [{ id: "c1", status: "RESERVED" }],
    } as any
}

const validMeta = JSON.stringify({
    productId: "prod_1",
    visitorId: "visitor-abc",
    fingerprintHash: "fp-xyz",
    ip: "127.0.0.1",
    discountPercent: 5,
})

describe("completePendingOrder -- ExitDiscountUsage write", () => {
    beforeEach(() => {
        prismaMock.order.findFirst.mockReset()
        prismaMock.$transaction.mockReset()
        prismaMock.exitDiscountUsage.create.mockReset()
        prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
        prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
            await fn(prismaMock)
        })
    })

    it("calls exitDiscountUsage.create with correct data when exitDiscountMeta is present on PENDING order", async () => {
        prismaMock.order.findFirst.mockResolvedValue(makePendingOrderWithMeta(validMeta))
        prismaMock.exitDiscountUsage.create.mockResolvedValue({} as any)

        await completePendingOrder("order-1")

        // Fire-and-forget: wait for the promise to settle
        await new Promise((r) => setTimeout(r, 10))

        expect(prismaMock.exitDiscountUsage.create).toHaveBeenCalledWith({
            data: {
                productId: "prod_1",
                orderId: "ord_1",
                visitorId: "visitor-abc",
                fingerprintHash: "fp-xyz",
                ip: "127.0.0.1",
            },
        })
    })

    it("does not call exitDiscountUsage.create when exitDiscountMeta is null", async () => {
        prismaMock.order.findFirst.mockResolvedValue(makePendingOrderWithMeta(null))

        await completePendingOrder("order-1")
        await new Promise((r) => setTimeout(r, 10))

        expect(prismaMock.exitDiscountUsage.create).not.toHaveBeenCalled()
    })

    it("does not block order completion when exitDiscountUsage.create throws", async () => {
        prismaMock.order.findFirst.mockResolvedValue(makePendingOrderWithMeta(validMeta))
        prismaMock.exitDiscountUsage.create.mockRejectedValue(new Error("DB write failed"))

        // completePendingOrder should still succeed
        const result = await completePendingOrder("order-1")
        await new Promise((r) => setTimeout(r, 10))

        expect(result).toEqual({ done: true, orderNo: "order-1" })
        // console.error should have been called (but it's suppressed globally in jest.setup.ts)
    })

    it("does not call exitDiscountUsage.create when order is already COMPLETED (idempotent path)", async () => {
        prismaMock.order.findFirst.mockResolvedValue({
            ...makePendingOrderWithMeta(validMeta),
            status: "COMPLETED",
        })

        await completePendingOrder("order-1")
        await new Promise((r) => setTimeout(r, 10))

        // COMPLETED path returns early, no transaction runs, no usage record
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
        expect(prismaMock.exitDiscountUsage.create).not.toHaveBeenCalled()
    })
})
