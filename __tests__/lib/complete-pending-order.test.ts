import { completePendingOrder } from "@/lib/complete-pending-order"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/order-completion-email", () => ({
    sendOrderCompletionEmail: jest.fn().mockResolvedValue(undefined),
}))

import { sendOrderCompletionEmail } from "@/lib/order-completion-email"
import { prismaMock } from "../../__mocks__/prisma"

const emailMock = sendOrderCompletionEmail as jest.Mock

function makePendingOrder(overrides?: Record<string, unknown>) {
    return {
        id: "ord_1",
        orderNo: "order-1",
        status: "PENDING",
        amount: 99,
        quantity: 1,
        distributorId: null as string | null,
        product: { name: "Test", commissionAmount: null as unknown },
        cards: [{ id: "c1", status: "RESERVED" }],
        ...overrides,
    } as any
}

describe("completePendingOrder", () => {
    beforeEach(() => {
        emailMock.mockClear()
        prismaMock.order.findFirst.mockReset()
        prismaMock.$transaction.mockReset()
        prismaMock.order.findMany.mockReset()
        prismaMock.commissionTier.findMany.mockReset()
        prismaMock.commission.create.mockReset()
    })

    it("returns { done: false, error: 'Order not found' } when order does not exist", async () => {
        prismaMock.order.findFirst.mockResolvedValue(null)
        const result = await completePendingOrder("unknown")
        expect(result).toEqual({ done: false, error: "Order not found" })
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
        expect(emailMock).not.toHaveBeenCalled()
    })

    it("returns { done: true, orderNo } when order is already COMPLETED", async () => {
        prismaMock.order.findFirst.mockResolvedValue(makePendingOrder({ status: "COMPLETED" }))
        const result = await completePendingOrder("order-1")
        expect(result).toEqual({ done: true, orderNo: "order-1" })
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
        expect(emailMock).not.toHaveBeenCalled()
    })

    it("returns { done: false, error: 'Order is not pending' } when order is CLOSED", async () => {
        prismaMock.order.findFirst.mockResolvedValue(makePendingOrder({ status: "CLOSED", cards: [] }))
        const result = await completePendingOrder("order-1")
        expect(result).toEqual({ done: false, error: "Order is not pending" })
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
        expect(emailMock).not.toHaveBeenCalled()
    })

    it("completes PENDING order: updates order and cards, sends email, returns { done: true, orderNo }", async () => {
        prismaMock.order.findFirst.mockResolvedValue(makePendingOrder())
        prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
        prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
            await fn(prismaMock)
        })

        const result = await completePendingOrder("order-1")

        expect(result).toEqual({ done: true, orderNo: "order-1" })
        expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
            where: { id: "ord_1", status: "PENDING" },
            data: { status: "COMPLETED", paidAt: expect.any(Date) },
        })
        expect(prismaMock.card.updateMany).toHaveBeenCalledWith({
            where: { orderId: "ord_1", status: "RESERVED" },
            data: { status: "SOLD" },
        })
        expect(emailMock).toHaveBeenCalledWith("ord_1")
    })

    it("throws when transaction fails", async () => {
        prismaMock.order.findFirst.mockResolvedValue(makePendingOrder())
        prismaMock.$transaction.mockRejectedValueOnce(new Error("DB_ERROR"))

        await expect(completePendingOrder("order-1")).rejects.toThrow("DB_ERROR")
        expect(emailMock).not.toHaveBeenCalled()
    })

    describe("commission (distributor)", () => {
        it("does not call commission.create when order has no distributorId", async () => {
            prismaMock.order.findFirst.mockResolvedValue(makePendingOrder({ distributorId: null }))
            prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
            prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
                await fn(prismaMock)
            })

            await completePendingOrder("order-1")

            expect(prismaMock.commission.create).not.toHaveBeenCalled()
        })

        it("does not call commission.create when distributorId set but no product commission and no tier", async () => {
            prismaMock.user.findUnique.mockResolvedValue({ email: "dist@example.com" })
            prismaMock.order.findFirst.mockResolvedValue(
                makePendingOrder({
                    distributorId: "dist_1",
                    quantity: 2,
                    product: { name: "Test", commissionAmount: null },
                })
            )
            prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
            prismaMock.order.findMany.mockResolvedValue([{ amount: 99 }])
            prismaMock.commissionTier.findMany.mockResolvedValue([])
            prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
                await fn(prismaMock)
            })

            await completePendingOrder("order-1")

            expect(prismaMock.commission.create).not.toHaveBeenCalled()
        })

        it("calls commission.create with base amount when product has commissionAmount and no tier matches", async () => {
            prismaMock.user.findUnique.mockResolvedValue({ email: "dist@example.com" })
            prismaMock.order.findFirst.mockResolvedValue(
                makePendingOrder({
                    distributorId: "dist_1",
                    quantity: 2,
                    product: { name: "Test", commissionAmount: 5 },
                })
            )
            prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
            prismaMock.order.findMany.mockResolvedValue([{ amount: 99 }])
            prismaMock.commissionTier.findMany.mockResolvedValue([
                { minAmount: 1000, maxAmount: 5000, ratePercent: 3, sortOrder: 0 },
            ])
            prismaMock.commission.create.mockResolvedValue({})
            prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
                await fn(prismaMock)
            })

            await completePendingOrder("order-1")

            expect(prismaMock.commission.create).toHaveBeenCalledWith({
                data: {
                    orderId: "ord_1",
                    distributorId: "dist_1",
                    amount: 10,
                    status: "SETTLED",
                },
            })
        })

        it("calls commission.create with base + tier bonus when week total falls in tier range", async () => {
            prismaMock.user.findUnique.mockResolvedValue({ email: "dist@example.com" })
            prismaMock.order.findFirst.mockResolvedValue(
                makePendingOrder({
                    distributorId: "dist_1",
                    quantity: 1,
                    amount: 100,
                    product: { name: "Test", commissionAmount: 2 },
                })
            )
            prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
            prismaMock.order.findMany.mockResolvedValue([{ amount: 500 }, { amount: 200 }])
            prismaMock.commissionTier.findMany.mockResolvedValue([
                { minAmount: 0, maxAmount: 1000, ratePercent: 5, sortOrder: 0 },
            ])
            prismaMock.commission.create.mockResolvedValue({})
            prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
                await fn(prismaMock)
            })

            await completePendingOrder("order-1")

            // base = 2*1 = 2, tier = 100 * 5% = 5, total = 7
            expect(prismaMock.commission.create).toHaveBeenCalledWith({
                data: {
                    orderId: "ord_1",
                    distributorId: "dist_1",
                    amount: 7,
                    status: "SETTLED",
                },
            })
        })

        it("rounds totalCommission to 2 decimal places", async () => {
            prismaMock.user.findUnique.mockResolvedValue({ email: "dist@example.com" })
            prismaMock.order.findFirst.mockResolvedValue(
                makePendingOrder({
                    distributorId: "dist_1",
                    quantity: 1,
                    product: { name: "Test", commissionAmount: 10.556 },
                })
            )
            prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
            prismaMock.order.findMany.mockResolvedValue([])
            prismaMock.commissionTier.findMany.mockResolvedValue([])
            prismaMock.commission.create.mockResolvedValue({})
            prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
                await fn(prismaMock)
            })

            await completePendingOrder("order-1")

            expect(prismaMock.commission.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    amount: 10.56,
                    status: "SETTLED",
                }),
            })
        })

        it("does not create commission when order email equals distributor email (self-referral)", async () => {
            prismaMock.user.findUnique.mockResolvedValue({ email: "buyer@example.com" })
            prismaMock.order.findFirst.mockResolvedValue(
                makePendingOrder({
                    distributorId: "dist_1",
                    email: "buyer@example.com",
                    quantity: 1,
                    product: { name: "Test", commissionAmount: 5 },
                })
            )
            prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
            prismaMock.order.findMany.mockResolvedValue([])
            prismaMock.commissionTier.findMany.mockResolvedValue([])
            prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
                await fn(prismaMock)
            })

            await completePendingOrder("order-1")

            expect(prismaMock.commission.create).not.toHaveBeenCalled()
        })

        it("uses commissionAmountSnapshot when set (lock commission at order creation, not product at completion)", async () => {
            prismaMock.user.findUnique.mockResolvedValue({ email: "dist@example.com" })
            prismaMock.order.findFirst.mockResolvedValue(
                makePendingOrder({
                    distributorId: "dist_1",
                    quantity: 2,
                    product: { name: "Test", commissionAmount: 0 },
                    commissionAmountSnapshot: 5,
                })
            )
            prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
            prismaMock.order.findMany.mockResolvedValue([])
            prismaMock.commissionTier.findMany.mockResolvedValue([])
            prismaMock.commission.create.mockResolvedValue({})
            prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
                await fn(prismaMock)
            })

            await completePendingOrder("order-1")

            expect(prismaMock.commission.create).toHaveBeenCalledWith({
                data: {
                    orderId: "ord_1",
                    distributorId: "dist_1",
                    amount: 10,
                    status: "SETTLED",
                },
            })
        })
    })
})
