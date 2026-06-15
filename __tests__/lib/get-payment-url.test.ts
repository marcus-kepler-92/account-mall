/**
 * Unit tests for get-payment-url: zpay vs alipay, pc vs wap.
 */

import { getPaymentUrlForOrder } from "@/lib/get-payment-url"

const COMPLIANCE_SUBJECT = "信息技术服务费"

jest.mock("@/lib/config", () => ({
    config: { paymentSubjectLabel: "信息技术服务费" },
}))

jest.mock("@/lib/zpay", () => ({
    isZpayConfigured: jest.fn(),
    getZpayPagePayUrl: jest.fn().mockReturnValue("https://zpay.example/pay"),
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

    it("returns zpay URL when zpay is configured", () => {
        const zpay = require("@/lib/zpay")
        zpay.isZpayConfigured.mockReturnValue(true)
        zpay.getZpayPagePayUrl.mockReturnValue("https://zpay.example/pay")
        const url = getPaymentUrlForOrder(baseParams)
        expect(url).toBe("https://zpay.example/pay")
        expect(zpay.getZpayPagePayUrl).toHaveBeenCalledWith({
            orderNo: baseParams.orderNo,
            totalAmount: baseParams.totalAmount,
            subject: COMPLIANCE_SUBJECT,
            type: "alipay",
        })
    })

    it("returns alipay page URL for clientType pc when zpay not configured", () => {
        const zpay = require("@/lib/zpay")
        const alipay = require("@/lib/alipay")
        zpay.isZpayConfigured.mockReturnValue(false)
        alipay.getAlipayPagePayUrl.mockReturnValue("https://alipay.example/page")
        const url = getPaymentUrlForOrder({ ...baseParams, clientType: "pc" })
        expect(url).toBe("https://alipay.example/page")
        expect(alipay.getAlipayPagePayUrl).toHaveBeenCalledWith({
            orderNo: baseParams.orderNo,
            totalAmount: baseParams.totalAmount,
            subject: COMPLIANCE_SUBJECT,
        })
    })

    it("returns alipay wap URL for clientType wap when zpay not configured", () => {
        const zpay = require("@/lib/zpay")
        const alipay = require("@/lib/alipay")
        zpay.isZpayConfigured.mockReturnValue(false)
        alipay.getAlipayWapPayUrl.mockReturnValue("https://alipay.example/wap")
        const url = getPaymentUrlForOrder({ ...baseParams, clientType: "wap" })
        expect(url).toBe("https://alipay.example/wap")
        expect(alipay.getAlipayWapPayUrl).toHaveBeenCalledWith({
            orderNo: baseParams.orderNo,
            totalAmount: baseParams.totalAmount,
            subject: COMPLIANCE_SUBJECT,
        })
    })

    it("defaults to pc when clientType omitted", () => {
        const zpay = require("@/lib/zpay")
        const alipay = require("@/lib/alipay")
        zpay.isZpayConfigured.mockReturnValue(false)
        getPaymentUrlForOrder(baseParams)
        expect(alipay.getAlipayPagePayUrl).toHaveBeenCalled()
        expect(alipay.getAlipayWapPayUrl).not.toHaveBeenCalled()
    })

    it("returns null when zpay configured but getZpayPagePayUrl returns null", () => {
        const zpay = require("@/lib/zpay")
        zpay.isZpayConfigured.mockReturnValue(true)
        zpay.getZpayPagePayUrl.mockReturnValue(null)
        const url = getPaymentUrlForOrder(baseParams)
        expect(url).toBeNull()
    })

    it("returns null when alipay getAlipayPagePayUrl returns null", () => {
        const zpay = require("@/lib/zpay")
        const alipay = require("@/lib/alipay")
        zpay.isZpayConfigured.mockReturnValue(false)
        alipay.getAlipayPagePayUrl.mockReturnValue(null)
        const url = getPaymentUrlForOrder(baseParams)
        expect(url).toBeNull()
    })

    it("passes paymentMethod as type to zpay when specified", () => {
        const zpay = require("@/lib/zpay")
        zpay.isZpayConfigured.mockReturnValue(true)
        zpay.getZpayPagePayUrl.mockReturnValue("https://zpay.example/pay")
        getPaymentUrlForOrder({ ...baseParams, paymentMethod: "wxpay" })
        expect(zpay.getZpayPagePayUrl).toHaveBeenCalledWith({
            orderNo: baseParams.orderNo,
            totalAmount: baseParams.totalAmount,
            subject: COMPLIANCE_SUBJECT,
            type: "wxpay",
        })
    })

    it("defaults paymentMethod to alipay when omitted", () => {
        const zpay = require("@/lib/zpay")
        zpay.isZpayConfigured.mockReturnValue(true)
        zpay.getZpayPagePayUrl.mockReturnValue("https://zpay.example/pay")
        getPaymentUrlForOrder(baseParams)
        expect(zpay.getZpayPagePayUrl).toHaveBeenCalledWith(
            expect.objectContaining({ type: "alipay" }),
        )
    })

    it("ignores paymentMethod when using alipay SDK (zpay not configured)", () => {
        const zpay = require("@/lib/zpay")
        const alipay = require("@/lib/alipay")
        zpay.isZpayConfigured.mockReturnValue(false)
        alipay.getAlipayPagePayUrl.mockReturnValue("https://alipay.example/page")
        const url = getPaymentUrlForOrder({ ...baseParams, paymentMethod: "wxpay" })
        expect(url).toBe("https://alipay.example/page")
        expect(zpay.getZpayPagePayUrl).not.toHaveBeenCalled()
    })
})
