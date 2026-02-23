import { processYipayNotifyAndComplete } from "@/lib/yipay-notify-complete"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/yipay", () => ({
    verifyYipayNotifySign: jest.fn(),
}))

jest.mock("@/lib/order-completion-email", () => ({
    sendOrderCompletionEmail: jest.fn().mockResolvedValue(undefined),
}))

import { verifyYipayNotifySign } from "@/lib/yipay"
import { sendOrderCompletionEmail } from "@/lib/order-completion-email"
import { prismaMock } from "../../__mocks__/prisma"

const verifyMock = verifyYipayNotifySign as jest.Mock
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

describe("processYipayNotifyAndComplete", () => {
    beforeEach(() => {
        verifyMock.mockReset()
        emailMock.mockClear()
        prismaMock.order.findFirst.mockReset()
        prismaMock.$transaction.mockReset()
    })

    it("returns { ok: false } when sign verification fails", async () => {
        verifyMock.mockReturnValue(false)
        const result = await processYipayNotifyAndComplete({
            out_trade_no: "order-1",
            money: "99.00",
            trade_status: "TRADE_SUCCESS",
            sign: "bad",
        })
        expect(result).toEqual({ ok: false })
        expect(prismaMock.order.findFirst).not.toHaveBeenCalled()
    })

    it("returns { ok: false } when out_trade_no missing", async () => {
        verifyMock.mockReturnValue(true)
        const result = await processYipayNotifyAndComplete({
            money: "99.00",
            trade_status: "TRADE_SUCCESS",
        })
        expect(result).toEqual({ ok: false })
    })

    it("returns { ok: false } when money/total_fee missing", async () => {
        verifyMock.mockReturnValue(true)
        const result = await processYipayNotifyAndComplete({
            out_trade_no: "order-1",
            trade_status: "TRADE_SUCCESS",
        })
        expect(result).toEqual({ ok: false })
    })

    it("returns { ok: true } without DB query for non-success trade_status", async () => {
        verifyMock.mockReturnValue(true)
        const result = await processYipayNotifyAndComplete({
            out_trade_no: "order-1",
            money: "99.00",
            trade_status: "WAIT_BUYER_PAY",
        })
        expect(result).toEqual({ ok: true })
        expect(prismaMock.order.findFirst).not.toHaveBeenCalled()
    })

    it("returns { ok: true } without DB query when trade_status is empty", async () => {
        verifyMock.mockReturnValue(true)
        const result = await processYipayNotifyAndComplete({
            out_trade_no: "order-1",
            money: "99.00",
            trade_status: "",
        })
        expect(result).toEqual({ ok: true })
        expect(prismaMock.order.findFirst).not.toHaveBeenCalled()
    })

    it("returns { ok: false } when order not found", async () => {
        verifyMock.mockReturnValue(true)
        prismaMock.order.findFirst.mockResolvedValue(null)
        const result = await processYipayNotifyAndComplete({
            out_trade_no: "unknown",
            money: "99.00",
            trade_status: "TRADE_SUCCESS",
        })
        expect(result).toEqual({ ok: false })
    })

    it("returns { ok: false } when amount mismatch", async () => {
        verifyMock.mockReturnValue(true)
        prismaMock.order.findFirst.mockResolvedValue(makePendingOrder({ amount: 100 }))
        const result = await processYipayNotifyAndComplete({
            out_trade_no: "order-1",
            money: "99.00",
            trade_status: "TRADE_SUCCESS",
        })
        expect(result).toEqual({ ok: false })
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })

    it("completes PENDING order and marks cards as SOLD", async () => {
        verifyMock.mockReturnValue(true)
        prismaMock.order.findFirst.mockResolvedValue(makePendingOrder())
        prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
        prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock))

        const result = await processYipayNotifyAndComplete({
            out_trade_no: "order-1",
            money: "99.00",
            trade_status: "TRADE_SUCCESS",
        })
        expect(result).toEqual({ ok: true })
        expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
            where: { id: "ord_1", status: "PENDING" },
            data: { status: "COMPLETED", paidAt: expect.any(Date) },
        })
        expect(prismaMock.card.updateMany).toHaveBeenCalledWith({
            where: { orderId: "ord_1", status: "RESERVED" },
            data: { status: "SOLD" },
        })
    })

    it("sends order completion email after successful completion", async () => {
        verifyMock.mockReturnValue(true)
        prismaMock.order.findFirst.mockResolvedValue(makePendingOrder())
        prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
        prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock))

        await processYipayNotifyAndComplete({
            out_trade_no: "order-1",
            money: "99.00",
            trade_status: "TRADE_SUCCESS",
        })
        expect(emailMock).toHaveBeenCalledWith("ord_1")
    })

    it("does not send email when updateMany affects 0 rows (race condition)", async () => {
        verifyMock.mockReturnValue(true)
        prismaMock.order.findFirst.mockResolvedValue(makePendingOrder())
        prismaMock.order.updateMany.mockResolvedValue({ count: 0 })
        prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock))

        const result = await processYipayNotifyAndComplete({
            out_trade_no: "order-1",
            money: "99.00",
            trade_status: "TRADE_SUCCESS",
        })
        expect(result).toEqual({ ok: true })
        expect(emailMock).not.toHaveBeenCalled()
        expect(prismaMock.card.updateMany).not.toHaveBeenCalled()
    })

    it("returns { ok: true } idempotently when order already COMPLETED", async () => {
        verifyMock.mockReturnValue(true)
        prismaMock.order.findFirst.mockResolvedValue(makePendingOrder({ status: "COMPLETED" }))

        const result = await processYipayNotifyAndComplete({
            out_trade_no: "order-1",
            money: "99.00",
            trade_status: "TRADE_SUCCESS",
        })
        expect(result).toEqual({ ok: true })
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })

    it("returns { ok: true } when order is CLOSED (no update)", async () => {
        verifyMock.mockReturnValue(true)
        prismaMock.order.findFirst.mockResolvedValue(makePendingOrder({ status: "CLOSED", cards: [] }))

        const result = await processYipayNotifyAndComplete({
            out_trade_no: "order-1",
            money: "99.00",
            trade_status: "TRADE_SUCCESS",
        })
        expect(result).toEqual({ ok: true })
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })

    it("throws when transaction fails (caller decides HTTP status)", async () => {
        verifyMock.mockReturnValue(true)
        prismaMock.order.findFirst.mockResolvedValue(makePendingOrder())
        prismaMock.$transaction.mockRejectedValueOnce(new Error("DB_ERROR"))

        await expect(
            processYipayNotifyAndComplete({
                out_trade_no: "order-1",
                money: "99.00",
                trade_status: "TRADE_SUCCESS",
            }),
        ).rejects.toThrow("DB_ERROR")
    })

    it("accepts TRADE_FINISHED as success", async () => {
        verifyMock.mockReturnValue(true)
        prismaMock.order.findFirst.mockResolvedValue(makePendingOrder())
        prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
        prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock))

        const result = await processYipayNotifyAndComplete({
            out_trade_no: "order-1",
            money: "99.00",
            trade_status: "TRADE_FINISHED",
        })
        expect(result).toEqual({ ok: true })
        expect(prismaMock.order.updateMany).toHaveBeenCalled()
    })

    it("accepts status=success (alternative field name)", async () => {
        verifyMock.mockReturnValue(true)
        prismaMock.order.findFirst.mockResolvedValue(makePendingOrder())
        prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
        prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock))

        const result = await processYipayNotifyAndComplete({
            out_trade_no: "order-1",
            money: "99.00",
            status: "success",
        })
        expect(result).toEqual({ ok: true })
        expect(prismaMock.order.updateMany).toHaveBeenCalled()
    })

    it("accepts total_fee as amount field", async () => {
        verifyMock.mockReturnValue(true)
        prismaMock.order.findFirst.mockResolvedValue(makePendingOrder({ amount: 50.5 }))
        prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
        prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock))

        const result = await processYipayNotifyAndComplete({
            out_trade_no: "order-1",
            total_fee: "50.50",
            trade_status: "TRADE_SUCCESS",
        })
        expect(result).toEqual({ ok: true })
        expect(prismaMock.order.updateMany).toHaveBeenCalled()
    })

    it("normalizes single-decimal amounts (0.1 matches 0.10)", async () => {
        verifyMock.mockReturnValue(true)
        prismaMock.order.findFirst.mockResolvedValue(makePendingOrder({ amount: 0.1 }))
        prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
        prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock))

        const result = await processYipayNotifyAndComplete({
            out_trade_no: "order-1",
            money: "0.1",
            trade_status: "TRADE_SUCCESS",
        })
        expect(result).toEqual({ ok: true })
        expect(prismaMock.order.updateMany).toHaveBeenCalled()
    })
})
