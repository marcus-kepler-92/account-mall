import { POST } from "@/app/api/payment/yipay/notify/route"

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
import { prismaMock } from "../../__mocks__/prisma"

const verifyMock = verifyYipayNotifySign as jest.Mock

function createNotifyRequest(params: Record<string, string>): Request {
    const formData = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
        formData.append(k, v)
    }
    return new Request("http://localhost/api/payment/yipay/notify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
    }) as unknown as Request
}

describe("POST /api/payment/yipay/notify", () => {
    beforeEach(() => {
        verifyMock.mockReset()
        prismaMock.order.findFirst.mockReset()
        prismaMock.$transaction.mockReset()
    })

    it("returns failure when body is not form", async () => {
        const req = new Request("http://localhost/api/payment/yipay/notify", {
            method: "POST",
            body: "not form",
        }) as unknown as Request
        const res = await POST(req as any)
        expect(res.status).toBe(400)
        expect(await res.text()).toBe("failure")
    })

    it("parses application/x-www-form-urlencoded body and completes order", async () => {
        verifyMock.mockReturnValue(true)
        prismaMock.order.findFirst.mockResolvedValue({
            id: "ord_1",
            orderNo: "order-1",
            status: "PENDING",
            amount: 1,
            product: { name: "Test" },
            cards: [{ id: "c1", status: "RESERVED" }],
        } as any)
        prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
        prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<number>) => {
            return await fn(prismaMock)
        })
        const body = new URLSearchParams({
            out_trade_no: "order-1",
            money: "1.00",
            trade_status: "TRADE_SUCCESS",
        }).toString()
        const req = new Request("http://localhost/api/payment/yipay/notify", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
        }) as unknown as Request
        const res = await POST(req as any)
        expect(res.status).toBe(200)
        expect(await res.text()).toBe("success")
        expect(prismaMock.order.updateMany).toHaveBeenCalled()
    })

    it("returns failure when sign verification fails", async () => {
        verifyMock.mockReturnValue(false)
        const req = createNotifyRequest({
            out_trade_no: "order-1",
            money: "99.00",
            trade_status: "TRADE_SUCCESS",
        })
        const res = await POST(req as any)
        expect(res.status).toBe(400)
        expect(await res.text()).toBe("failure")
        expect(prismaMock.order.findFirst).not.toHaveBeenCalled()
    })

    it("returns failure when out_trade_no or amount missing", async () => {
        verifyMock.mockReturnValue(true)
        const req = createNotifyRequest({
            trade_status: "TRADE_SUCCESS",
        })
        const res = await POST(req as any)
        expect(res.status).toBe(400)
        expect(await res.text()).toBe("failure")
        expect(prismaMock.order.findFirst).not.toHaveBeenCalled()
    })

    it("returns failure when order not found", async () => {
        verifyMock.mockReturnValue(true)
        prismaMock.order.findFirst.mockResolvedValue(null)
        const req = createNotifyRequest({
            out_trade_no: "unknown-order",
            money: "99.00",
            trade_status: "TRADE_SUCCESS",
        })
        const res = await POST(req as any)
        expect(res.status).toBe(400)
        expect(await res.text()).toBe("failure")
    })

    it("returns failure when amount mismatch", async () => {
        verifyMock.mockReturnValue(true)
        prismaMock.order.findFirst.mockResolvedValue({
            id: "ord_1",
            orderNo: "order-1",
            status: "PENDING",
            amount: 100,
            product: { name: "Test" },
            cards: [{ id: "c1", status: "RESERVED" }],
        } as any)
        const req = createNotifyRequest({
            out_trade_no: "order-1",
            money: "99.00",
            trade_status: "TRADE_SUCCESS",
        })
        const res = await POST(req as any)
        expect(res.status).toBe(400)
        expect(await res.text()).toBe("failure")
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })

    it("returns success and completes order when valid notify (money field)", async () => {
        verifyMock.mockReturnValue(true)
        prismaMock.order.findFirst.mockResolvedValue({
            id: "ord_1",
            orderNo: "order-1",
            status: "PENDING",
            amount: 99,
            product: { name: "Test" },
            cards: [{ id: "c1", status: "RESERVED" }],
        } as any)
        prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
        prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<number>) => {
            return await fn(prismaMock)
        })
        const req = createNotifyRequest({
            out_trade_no: "order-1",
            money: "99.00",
            trade_status: "TRADE_SUCCESS",
        })
        const res = await POST(req as any)
        expect(res.status).toBe(200)
        expect(await res.text()).toBe("success")
        expect(prismaMock.order.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "ord_1", status: "PENDING" },
                data: { status: "COMPLETED", paidAt: expect.any(Date) },
            }),
        )
        expect(prismaMock.card.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { orderId: "ord_1", status: "RESERVED" },
                data: { status: "SOLD" },
            }),
        )
    })

    it("accepts amount with single decimal (0.1 normalizes to 0.10)", async () => {
        verifyMock.mockReturnValue(true)
        prismaMock.order.findFirst.mockResolvedValue({
            id: "ord_1",
            orderNo: "order-1",
            status: "PENDING",
            amount: 0.1,
            product: { name: "Test" },
            cards: [{ id: "c1", status: "RESERVED" }],
        } as any)
        prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
        prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<number>) => {
            return await fn(prismaMock)
        })
        const req = createNotifyRequest({
            out_trade_no: "order-1",
            money: "0.1",
            trade_status: "TRADE_SUCCESS",
        })
        const res = await POST(req as any)
        expect(res.status).toBe(200)
        expect(await res.text()).toBe("success")
        expect(prismaMock.order.updateMany).toHaveBeenCalled()
    })

    it("accepts total_fee as amount field", async () => {
        verifyMock.mockReturnValue(true)
        prismaMock.order.findFirst.mockResolvedValue({
            id: "ord_1",
            orderNo: "order-1",
            status: "PENDING",
            amount: 50.5,
            product: { name: "Test" },
            cards: [{ id: "c1", status: "RESERVED" }],
        } as any)
        prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
        prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<number>) => {
            return await fn(prismaMock)
        })
        const req = createNotifyRequest({
            out_trade_no: "order-1",
            total_fee: "50.50",
            trade_status: "TRADE_SUCCESS",
        })
        const res = await POST(req as any)
        expect(res.status).toBe(200)
        expect(await res.text()).toBe("success")
    })

    it("returns success without updating when order already COMPLETED", async () => {
        verifyMock.mockReturnValue(true)
        prismaMock.order.findFirst.mockResolvedValue({
            id: "ord_1",
            orderNo: "order-1",
            status: "COMPLETED",
            amount: 99,
        } as any)
        const req = createNotifyRequest({
            out_trade_no: "order-1",
            money: "99.00",
            trade_status: "TRADE_SUCCESS",
        })
        const res = await POST(req as any)
        expect(res.status).toBe(200)
        expect(await res.text()).toBe("success")
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })

    it("returns success without updating when order is CLOSED (race with cron)", async () => {
        verifyMock.mockReturnValue(true)
        prismaMock.order.findFirst.mockResolvedValue({
            id: "ord_1",
            orderNo: "order-1",
            status: "CLOSED",
            amount: 99,
            product: { name: "Test" },
            cards: [],
        } as any)
        const req = createNotifyRequest({
            out_trade_no: "order-1",
            money: "99.00",
            trade_status: "TRADE_SUCCESS",
        })
        const res = await POST(req as any)
        expect(res.status).toBe(200)
        expect(await res.text()).toBe("success")
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })

    it("returns success for status=success (alternative success value)", async () => {
        verifyMock.mockReturnValue(true)
        prismaMock.order.findFirst.mockResolvedValue({
            id: "ord_1",
            orderNo: "order-1",
            status: "PENDING",
            amount: 99,
            product: { name: "Test" },
            cards: [{ id: "c1", status: "RESERVED" }],
        } as any)
        prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
        prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<number>) => {
            return await fn(prismaMock)
        })
        const req = createNotifyRequest({
            out_trade_no: "order-1",
            money: "99.00",
            status: "success",
        })
        const res = await POST(req as any)
        expect(res.status).toBe(200)
        expect(await res.text()).toBe("success")
    })

    it("returns success without completing order when trade_status is missing (only TRADE_SUCCESS is success)", async () => {
        verifyMock.mockReturnValue(true)
        const req = createNotifyRequest({
            out_trade_no: "order-1",
            money: "0.50",
        })
        const res = await POST(req as any)
        expect(res.status).toBe(200)
        expect(await res.text()).toBe("success")
        expect(prismaMock.order.findFirst).not.toHaveBeenCalled()
    })

    it("returns 500 when transaction throws", async () => {
        verifyMock.mockReturnValue(true)
        prismaMock.order.findFirst.mockResolvedValue({
            id: "ord_1",
            orderNo: "order-1",
            status: "PENDING",
            amount: 99,
            product: { name: "Test" },
            cards: [{ id: "c1", status: "RESERVED" }],
        } as any)
        prismaMock.$transaction.mockRejectedValueOnce(new Error("DB_ERROR"))
        const req = createNotifyRequest({
            out_trade_no: "order-1",
            money: "99.00",
            trade_status: "TRADE_SUCCESS",
        })
        const res = await POST(req as any)
        expect(res.status).toBe(500)
        expect(await res.text()).toBe("failure")
    })
})
