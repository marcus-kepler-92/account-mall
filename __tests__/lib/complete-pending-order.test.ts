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
        product: { name: "Test" },
        cards: [{ id: "c1", status: "RESERVED" }],
        ...overrides,
    } as any
}

describe("completePendingOrder", () => {
    beforeEach(() => {
        emailMock.mockClear()
        prismaMock.order.findFirst.mockReset()
        prismaMock.$transaction.mockReset()
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
})
