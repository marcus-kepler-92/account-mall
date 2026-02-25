/**
 * Unit tests for lib/alipay with mocked AlipaySdk and config.
 */

const mockPageExecute = jest.fn().mockReturnValue("https://alipay.example/pay")
const mockCheckNotifySignV2 = jest.fn().mockReturnValue(true)

jest.mock("alipay-sdk", () => ({
    AlipaySdk: jest.fn().mockImplementation(() => ({
        pageExecute: mockPageExecute,
        checkNotifySignV2: mockCheckNotifySignV2,
    })),
}))

const mockConfig = {
    alipayAppId: "app-id",
    alipayPrivateKey: "private-key",
    alipayPublicKey: "public-key",
    siteUrl: "https://example.com",
}
jest.mock("@/lib/config", () => ({ config: mockConfig }))

describe("lib/alipay", () => {
    beforeEach(() => {
        jest.resetModules()
        mockConfig.alipayAppId = "app-id"
        mockConfig.alipayPrivateKey = "private-key"
        mockConfig.alipayPublicKey = "public-key"
        mockConfig.siteUrl = "https://example.com"
        mockPageExecute.mockReturnValue("https://alipay.example/pay")
        mockCheckNotifySignV2.mockReturnValue(true)
    })

    it("getAlipaySdk returns null when appId is empty", () => {
        mockConfig.alipayAppId = ""
        const { getAlipaySdk } = require("@/lib/alipay")
        expect(getAlipaySdk()).toBeNull()
    })

    it("getAlipaySdk returns SDK when all config present", () => {
        const { getAlipaySdk } = require("@/lib/alipay")
        const sdk = getAlipaySdk()
        expect(sdk).not.toBeNull()
    })

    it("getAlipayPagePayUrl returns URL when SDK is configured", () => {
        const { getAlipayPagePayUrl } = require("@/lib/alipay")
        const url = getAlipayPagePayUrl({
            orderNo: "ORD-1",
            totalAmount: "10.00",
            subject: "Test",
        })
        expect(url).toBe("https://alipay.example/pay")
        expect(mockPageExecute).toHaveBeenCalledWith(
            "alipay.trade.page.pay",
            "GET",
            expect.objectContaining({
                bizContent: expect.objectContaining({
                    out_trade_no: "ORD-1",
                    total_amount: "10.00",
                    subject: "Test",
                }),
            })
        )
    })

    it("getAlipayPagePayUrl uses body when provided", () => {
        const { getAlipayPagePayUrl } = require("@/lib/alipay")
        getAlipayPagePayUrl({
            orderNo: "ORD-2",
            totalAmount: "20.00",
            subject: "Sub",
            body: "custom body",
        })
        expect(mockPageExecute).toHaveBeenCalledWith(
            "alipay.trade.page.pay",
            "GET",
            expect.objectContaining({
                bizContent: expect.objectContaining({
                    body: "custom body",
                }),
            })
        )
    })

    it("getAlipayPagePayUrl returns null when pageExecute throws", () => {
        mockPageExecute.mockImplementationOnce(() => {
            throw new Error("SDK error")
        })
        const { getAlipayPagePayUrl } = require("@/lib/alipay")
        const url = getAlipayPagePayUrl({
            orderNo: "ORD-X",
            totalAmount: "1.00",
            subject: "S",
        })
        expect(url).toBeNull()
    })

    it("getAlipayWapPayUrl returns URL when SDK is configured", () => {
        const { getAlipayWapPayUrl } = require("@/lib/alipay")
        const url = getAlipayWapPayUrl({
            orderNo: "ORD-3",
            totalAmount: "30.00",
            subject: "Wap",
        })
        expect(url).toBe("https://alipay.example/pay")
        expect(mockPageExecute).toHaveBeenCalledWith(
            "alipay.trade.wap.pay",
            "GET",
            expect.any(Object)
        )
    })

    it("verifyAlipayNotifySign returns true when checkNotifySignV2 passes", () => {
        const { verifyAlipayNotifySign } = require("@/lib/alipay")
        expect(verifyAlipayNotifySign({ sign: "x", out_trade_no: "ORD-1" })).toBe(true)
    })

    it("verifyAlipayNotifySign returns false when SDK returns false", () => {
        mockCheckNotifySignV2.mockReturnValueOnce(false)
        jest.resetModules()
        const { verifyAlipayNotifySign } = require("@/lib/alipay")
        expect(verifyAlipayNotifySign({})).toBe(false)
    })

    it("verifyAlipayNotifySign returns false when checkNotifySignV2 throws", () => {
        mockCheckNotifySignV2.mockImplementationOnce(() => {
            throw new Error("Verify error")
        })
        jest.resetModules()
        const { verifyAlipayNotifySign } = require("@/lib/alipay")
        expect(verifyAlipayNotifySign({})).toBe(false)
    })

    it("getAlipayPagePayUrl returns null when pageExecute returns non-string", () => {
        mockPageExecute.mockReturnValueOnce({ url: "object" } as any)
        jest.resetModules()
        const { getAlipayPagePayUrl } = require("@/lib/alipay")
        const url = getAlipayPagePayUrl({
            orderNo: "O1",
            totalAmount: "1.00",
            subject: "S",
        })
        expect(url).toBeNull()
    })
})
