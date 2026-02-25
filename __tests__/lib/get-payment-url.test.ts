/**
 * Unit tests for get-payment-url: yipay vs alipay, pc vs wap.
 */

import { getPaymentUrlForOrder } from "@/lib/get-payment-url"

jest.mock("@/lib/yipay", () => ({
    isYipayConfigured: jest.fn(),
    getYipayPagePayUrl: jest.fn().mockReturnValue("https://yipay.example/pay"),
}))

jest.mock("@/lib/alipay", () => ({
    getAlipayPagePayUrl: jest.fn().mockReturnValue("https://alipay.example/page"),
    getAlipayWapPayUrl: jest.fn().mockReturnValue("https://alipay.example/wap"),
}))

const baseParams = {
    orderNo: "ORD-001",
    totalAmount: "99.00",
    subject: "Test order",
}

describe("getPaymentUrlForOrder", () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it("returns yipay URL when yipay is configured", () => {
        const yipay = require("@/lib/yipay")
        yipay.isYipayConfigured.mockReturnValue(true)
        yipay.getYipayPagePayUrl.mockReturnValue("https://yipay.example/pay")
        const url = getPaymentUrlForOrder(baseParams)
        expect(url).toBe("https://yipay.example/pay")
        expect(yipay.getYipayPagePayUrl).toHaveBeenCalledWith({
            orderNo: baseParams.orderNo,
            totalAmount: baseParams.totalAmount,
            subject: baseParams.subject,
        })
    })

    it("returns alipay page URL for clientType pc when yipay not configured", () => {
        const yipay = require("@/lib/yipay")
        const alipay = require("@/lib/alipay")
        yipay.isYipayConfigured.mockReturnValue(false)
        alipay.getAlipayPagePayUrl.mockReturnValue("https://alipay.example/page")
        const url = getPaymentUrlForOrder({ ...baseParams, clientType: "pc" })
        expect(url).toBe("https://alipay.example/page")
        expect(alipay.getAlipayPagePayUrl).toHaveBeenCalledWith({
            orderNo: baseParams.orderNo,
            totalAmount: baseParams.totalAmount,
            subject: baseParams.subject,
        })
    })

    it("returns alipay wap URL for clientType wap when yipay not configured", () => {
        const yipay = require("@/lib/yipay")
        const alipay = require("@/lib/alipay")
        yipay.isYipayConfigured.mockReturnValue(false)
        alipay.getAlipayWapPayUrl.mockReturnValue("https://alipay.example/wap")
        const url = getPaymentUrlForOrder({ ...baseParams, clientType: "wap" })
        expect(url).toBe("https://alipay.example/wap")
        expect(alipay.getAlipayWapPayUrl).toHaveBeenCalledWith({
            orderNo: baseParams.orderNo,
            totalAmount: baseParams.totalAmount,
            subject: baseParams.subject,
        })
    })

    it("defaults to pc when clientType omitted", () => {
        const yipay = require("@/lib/yipay")
        const alipay = require("@/lib/alipay")
        yipay.isYipayConfigured.mockReturnValue(false)
        getPaymentUrlForOrder(baseParams)
        expect(alipay.getAlipayPagePayUrl).toHaveBeenCalled()
        expect(alipay.getAlipayWapPayUrl).not.toHaveBeenCalled()
    })

    it("returns null when yipay configured but getYipayPagePayUrl returns null", () => {
        const yipay = require("@/lib/yipay")
        yipay.isYipayConfigured.mockReturnValue(true)
        yipay.getYipayPagePayUrl.mockReturnValue(null)
        const url = getPaymentUrlForOrder(baseParams)
        expect(url).toBeNull()
    })

    it("returns null when alipay getAlipayPagePayUrl returns null", () => {
        const yipay = require("@/lib/yipay")
        const alipay = require("@/lib/alipay")
        yipay.isYipayConfigured.mockReturnValue(false)
        alipay.getAlipayPagePayUrl.mockReturnValue(null)
        const url = getPaymentUrlForOrder(baseParams)
        expect(url).toBeNull()
    })
})
