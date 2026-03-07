import { POST } from "@/app/api/dev/complete-order/route"

jest.mock("@/lib/config", () => ({
    config: { nodeEnv: "development", siteUrl: "https://example.com" },
    getConfig: () => ({ nodeEnv: "development", siteUrl: "https://example.com" }),
}))

jest.mock("@/lib/complete-pending-order", () => ({
    completePendingOrder: jest.fn(),
}))

jest.mock("@/lib/order-success-token", () => ({
    createOrderSuccessToken: jest.fn().mockReturnValue("mock-token"),
}))

import { completePendingOrder } from "@/lib/complete-pending-order"
import { createOrderSuccessToken } from "@/lib/order-success-token"

const completeMock = completePendingOrder as jest.Mock
const tokenMock = createOrderSuccessToken as jest.Mock

function createRequest(body: object): Request {
    return new Request("http://localhost/api/dev/complete-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    }) as unknown as Request
}

describe("POST /api/dev/complete-order", () => {
    beforeEach(() => {
        completeMock.mockReset()
        tokenMock.mockReturnValue("mock-token")
        const { config } = require("@/lib/config")
        config.nodeEnv = "development"
        config.siteUrl = "https://example.com"
    })

    it("returns 404 when not in development", async () => {
        const { config } = require("@/lib/config")
        config.nodeEnv = "production"
        const res = await POST(createRequest({ orderNo: "ord-1" }) as any)
        expect(res.status).toBe(404)
        const data = await res.json()
        expect(data.error).toBe("Not available")
        expect(completeMock).not.toHaveBeenCalled()
    })

    it("returns 400 when body is invalid JSON", async () => {
        const req = new Request("http://localhost/api/dev/complete-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "not json",
        }) as unknown as Request
        const res = await POST(req as any)
        expect(res.status).toBe(400)
        expect(completeMock).not.toHaveBeenCalled()
    })

    it("returns 400 when orderNo is missing", async () => {
        const res = await POST(createRequest({}) as any)
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toMatch(/orderNo|required/)
        expect(completeMock).not.toHaveBeenCalled()
    })

    it("returns 400 when orderNo is empty string", async () => {
        const res = await POST(createRequest({ orderNo: "   " }) as any)
        expect(res.status).toBe(400)
        expect(completeMock).not.toHaveBeenCalled()
    })

    it("returns 404 when order not found", async () => {
        completeMock.mockResolvedValue({ done: false, error: "Order not found" })
        const res = await POST(createRequest({ orderNo: "unknown" }) as any)
        expect(res.status).toBe(404)
        const data = await res.json()
        expect(data.error).toBe("Order not found")
    })

    it("returns 400 when order is not PENDING", async () => {
        completeMock.mockResolvedValue({ done: false, error: "Order is not pending" })
        const res = await POST(createRequest({ orderNo: "ord-closed" }) as any)
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toBe("Order is not pending")
    })

    it("returns 200 with redirectUrl when order already COMPLETED", async () => {
        completeMock.mockResolvedValue({ done: true, orderNo: "ord-1" })
        const res = await POST(createRequest({ orderNo: "ord-1" }) as any)
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data.redirectUrl).toBeDefined()
        expect(data.redirectUrl).toContain("/orders/ord-1/success")
        expect(data.redirectUrl).toContain("token=mock-token")
        expect(tokenMock).toHaveBeenCalledWith("ord-1")
    })

    it("returns 200 with redirectUrl when PENDING order is completed", async () => {
        completeMock.mockResolvedValue({ done: true, orderNo: "ord-pending" })
        const res = await POST(createRequest({ orderNo: "ord-pending" }) as any)
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data.redirectUrl).toContain("/orders/ord-pending/success")
        expect(data.redirectUrl).toContain("token=mock-token")
        expect(completeMock).toHaveBeenCalledWith("ord-pending")
        expect(tokenMock).toHaveBeenCalledWith("ord-pending")
    })

    it("returns redirectUrl to lookup when createOrderSuccessToken returns null", async () => {
        tokenMock.mockReturnValue(null)
        completeMock.mockResolvedValue({ done: true, orderNo: "ord-1" })
        const res = await POST(createRequest({ orderNo: "ord-1" }) as any)
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data.redirectUrl).toContain("/orders/lookup")
        expect(data.redirectUrl).toContain("orderNo=ord-1")
        expect(data.redirectUrl).toContain("fromPay=1")
    })
})
