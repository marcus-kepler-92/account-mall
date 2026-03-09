import { type NextRequest } from "next/server"
import { POST } from "@/app/api/payment/alipay/create/route"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

const mockGetPaymentUrlForOrder = jest.fn()
jest.mock("@/lib/get-payment-url", () => ({
    __esModule: true,
    getPaymentUrlForOrder: (...args: unknown[]) => mockGetPaymentUrlForOrder(...args),
}))

function createJsonRequest(body: unknown): NextRequest {
    return { json: async () => body } as unknown as NextRequest
}

describe("POST /api/payment/alipay/create", () => {
    beforeEach(() => {
        mockGetPaymentUrlForOrder.mockReset()
        prismaMock.order.findFirst.mockReset()
    })

    it("returns 400 when body is not valid JSON", async () => {
        const req = {
            json: async () => {
                throw new Error("parse error")
            },
        } as unknown as NextRequest
        const res = await POST(req)
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toBeDefined()
        expect(prismaMock.order.findFirst).not.toHaveBeenCalled()
    })

    it("returns 400 when orderNo is missing", async () => {
        const req = createJsonRequest({})
        const res = await POST(req)
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toMatch(/orderNo|required/i)
        expect(prismaMock.order.findFirst).not.toHaveBeenCalled()
    })

    it("returns 400 when orderNo is empty string", async () => {
        const req = createJsonRequest({ orderNo: "   " })
        const res = await POST(req)
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toMatch(/orderNo|required/i)
        expect(prismaMock.order.findFirst).not.toHaveBeenCalled()
    })

    it("returns 404 when order not found", async () => {
        prismaMock.order.findFirst.mockResolvedValue(null)
        const req = createJsonRequest({ orderNo: "FAK202403090001" })
        const res = await POST(req)
        expect(res.status).toBe(404)
        const data = await res.json()
        expect(data.error).toMatch(/not found|Order/i)
        expect(mockGetPaymentUrlForOrder).not.toHaveBeenCalled()
    })

    it("returns 400 when order is not PENDING", async () => {
        prismaMock.order.findFirst.mockResolvedValue({
            id: "ord_1",
            orderNo: "FAK202403090001",
            status: "COMPLETED",
            amount: 99,
            product: { name: "Test" },
        } as any)
        const req = createJsonRequest({ orderNo: "FAK202403090001" })
        const res = await POST(req)
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toMatch(/not pending|pending payment/i)
        expect(mockGetPaymentUrlForOrder).not.toHaveBeenCalled()
    })

    it("returns 503 when payment URL cannot be generated", async () => {
        prismaMock.order.findFirst.mockResolvedValue({
            id: "ord_1",
            orderNo: "FAK202403090001",
            status: "PENDING",
            amount: 99,
            productNameSnapshot: null,
            product: { name: "Test" },
        } as any)
        mockGetPaymentUrlForOrder.mockReturnValue(null)
        const req = createJsonRequest({ orderNo: "FAK202403090001" })
        const res = await POST(req)
        expect(res.status).toBe(503)
        const data = await res.json()
        expect(data.error).toMatch(/not configured|failed|generate/i)
    })

    it("returns 200 with paymentUrl when order is PENDING and URL is generated", async () => {
        prismaMock.order.findFirst.mockResolvedValue({
            id: "ord_1",
            orderNo: "FAK202403090001",
            status: "PENDING",
            amount: 99.5,
            productNameSnapshot: "Product A",
            product: { name: "Product A" },
        } as any)
        mockGetPaymentUrlForOrder.mockReturnValue("https://openapi.alipay.com/gateway?xxx")
        const req = createJsonRequest({ orderNo: "FAK202403090001" })
        const res = await POST(req)
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data.paymentUrl).toBe("https://openapi.alipay.com/gateway?xxx")
        expect(mockGetPaymentUrlForOrder).toHaveBeenCalledWith(
            expect.objectContaining({
                orderNo: "FAK202403090001",
                totalAmount: "99.50",
                subject: "Product A",
                clientType: "pc",
            })
        )
    })

    it("passes clientType wap when provided", async () => {
        prismaMock.order.findFirst.mockResolvedValue({
            id: "ord_1",
            orderNo: "FAK202403090001",
            status: "PENDING",
            amount: 10,
            product: { name: "Test" },
        } as any)
        mockGetPaymentUrlForOrder.mockReturnValue("https://pay.example.com/wap")
        const req = createJsonRequest({ orderNo: "FAK202403090001", clientType: "wap" })
        const res = await POST(req)
        expect(res.status).toBe(200)
        expect(mockGetPaymentUrlForOrder).toHaveBeenCalledWith(
            expect.objectContaining({ clientType: "wap" })
        )
    })

    it("does not leak internal errors for invalid orderNo format", async () => {
        prismaMock.order.findFirst.mockResolvedValue(null)
        const req = createJsonRequest({ orderNo: "'; DROP TABLE orders;--" })
        const res = await POST(req)
        expect(res.status).toBe(404)
        const data = await res.json()
        expect(data.error).not.toMatch(/prisma|sql|syntax|error code/i)
    })
})
