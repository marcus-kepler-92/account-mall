import { createHash } from "crypto"
import {
    getVerifyParams,
    buildSubmitUrl,
    verifyYipayNotifySign,
    isYipayConfigured,
    getYipayPagePayUrl,
    refundYipayOrder,
} from "@/lib/yipay"
import type { YipayChannelConfig } from "@/lib/yipay"

jest.mock("@/lib/config", () => ({
    config: {
        siteUrl: "https://example.com",
        yipayPid: "test_pid",
        yipayKey: "test_key",
        yipaySubmitUrl: "https://z-pay.cn/submit.php",
        yipaySiteName: "Test Site",
    },
}))

describe("getVerifyParams", () => {
    it("returns empty string for empty params", () => {
        expect(getVerifyParams({})).toBe("")
    })

    it("excludes sign and sign_type", () => {
        const params = { pid: "1", sign: "abc", sign_type: "MD5" }
        expect(getVerifyParams(params)).toBe("pid=1")
    })

    it("excludes empty or whitespace-only values", () => {
        const params = { a: "1", b: "", c: "  ", d: "2" }
        expect(getVerifyParams(params)).toBe("a=1&d=2")
    })

    it("sorts by key and joins with &", () => {
        const params = { z: "3", a: "1", m: "2" }
        expect(getVerifyParams(params)).toBe("a=1&m=2&z=3")
    })
})

describe("buildSubmitUrl", () => {
    it("produces URL with prestr, sign=MD5(prestr+key), sign_type=MD5", () => {
        const params = { pid: "1", money: "0.01", out_trade_no: "ord1" }
        const key = "mykey"
        const url = buildSubmitUrl(params, key)
        expect(url).toMatch(/^https:\/\/z-pay\.cn\/submit\.php\?/)
        const prestr = getVerifyParams(params)
        const expectedSign = createHash("md5").update(prestr + key).digest("hex").toLowerCase()
        expect(url).toContain(`sign=${expectedSign}`)
        expect(url).toContain("sign_type=MD5")
    })
})

describe("verifyYipayNotifySign", () => {
    it("returns true when sign matches MD5(prestr+key)", () => {
        const postData = { pid: "1", money: "99.00", out_trade_no: "ord-1" }
        const prestr = getVerifyParams(postData as Record<string, string>)
        const sign = createHash("md5").update(prestr + "test_key").digest("hex").toLowerCase()
        const result = verifyYipayNotifySign({ ...postData, sign })
        expect(result).toBe(true)
    })

    it("returns false when sign does not match", () => {
        const result = verifyYipayNotifySign({
            pid: "1",
            money: "99.00",
            out_trade_no: "ord-1",
            sign: "wrong_sign",
        })
        expect(result).toBe(false)
    })

    it("returns false when sign is missing", () => {
        const result = verifyYipayNotifySign({
            pid: "1",
            money: "99.00",
            out_trade_no: "ord-1",
        })
        expect(result).toBe(false)
    })
})

describe("isYipayConfigured", () => {
    it("returns true when all four env vars are set in mock", () => {
        expect(isYipayConfigured()).toBe(true)
    })

    it("returns false when one of four env vars is missing", () => {
        const { config } = require("@/lib/config")
        const orig = config.yipayPid
        try {
            config.yipayPid = ""
            expect(isYipayConfigured()).toBe(false)
        } finally {
            config.yipayPid = orig
        }
    })
})

describe("getYipayPagePayUrl", () => {
    it("returns URL with correct query params and sign", () => {
        const url = getYipayPagePayUrl({
            orderNo: "ord-123",
            totalAmount: "10.50",
            subject: "Test Product",
        })
        expect(url).not.toBeNull()
        expect(url!).toMatch(/^https:\/\/z-pay\.cn\/submit\.php\?/)
        expect(url!).toContain("out_trade_no=ord-123")
        expect(url!).toContain("money=10.50")
        expect(url!).toContain("sign_type=MD5")
        expect(url!).toContain("notify_url=https://example.com/api/payment/yipay/notify")
    })

    it("includes custom type parameter in URL when specified", () => {
        const url = getYipayPagePayUrl({
            orderNo: "ord-456",
            totalAmount: "20.00",
            subject: "WeChat Order",
            type: "wxpay",
        })
        expect(url).not.toBeNull()
        expect(url!).toContain("type=wxpay")
    })

    it("defaults type to alipay when omitted", () => {
        const url = getYipayPagePayUrl({
            orderNo: "ord-789",
            totalAmount: "30.00",
            subject: "Default Type",
        })
        expect(url).not.toBeNull()
        expect(url!).toContain("type=alipay")
    })

    it("returns null when Yipay is not configured", () => {
        const { config } = require("@/lib/config")
        const orig = config.yipayPid
        try {
            config.yipayPid = ""
            expect(
                getYipayPagePayUrl({
                    orderNo: "ord-1",
                    totalAmount: "1.00",
                    subject: "Test",
                }),
            ).toBeNull()
        } finally {
            config.yipayPid = orig
        }
    })
})

describe("getYipayPagePayUrl with channel override", () => {
    it("uses channel config instead of global config when provided", () => {
        const url = getYipayPagePayUrl({
            orderNo: "ord_1",
            totalAmount: "99.00",
            subject: "Test Product",
            type: "alipay",
            channel: {
                pid: "channel_pid",
                key: "channel_key",
                submitUrl: "https://other-pay.com/submit.php",
                siteName: "Other Site",
            } satisfies YipayChannelConfig,
        })
        expect(url).not.toBeNull()
        expect(url).toContain("https://other-pay.com/submit.php")
        expect(url).toContain("pid=channel_pid")
        expect(url).toContain("sitename=Other Site")
    })
})

describe("verifyYipayNotifySign with explicit key", () => {
    it("verifies with provided key instead of config key", () => {
        const params = { pid: "1", money: "10.00", out_trade_no: "ord_1" }
        const key = "channel_signing_key"
        const url = buildSubmitUrl(params, key, "https://pay.com/submit.php")
        const urlParams = new URLSearchParams(url.split("?")[1])
        const sign = urlParams.get("sign")!
        const postData = { ...params, sign, sign_type: "MD5" }
        expect(verifyYipayNotifySign(postData, key)).toBe(true)
        expect(verifyYipayNotifySign(postData, "wrong_key")).toBe(false)
    })
})

describe("refundYipayOrder", () => {
    const realFetch = global.fetch

    afterEach(() => {
        global.fetch = realFetch
    })

    function mockFetch(body: unknown, ok = true, status = 200) {
        global.fetch = jest.fn().mockResolvedValue({
            ok,
            status,
            json: async () => body,
        }) as unknown as typeof fetch
    }

    it("posts act=refund with out_trade_no + money and resolves ok on code=1", async () => {
        mockFetch({ code: 1, msg: "退款成功" })

        const result = await refundYipayOrder("ord_1", "1.50")

        expect(result).toEqual({ ok: true, message: "退款成功" })
        const fetchMock = global.fetch as jest.Mock
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe("https://z-pay.cn/api.php?act=refund")
        expect(init.method).toBe("POST")
        const sentBody = new URLSearchParams(init.body as string)
        expect(sentBody.get("out_trade_no")).toBe("ord_1")
        expect(sentBody.get("money")).toBe("1.50")
        expect(sentBody.get("pid")).toBe("test_pid")
    })

    it("resolves ok:false with the provider msg when code != 1", async () => {
        mockFetch({ code: 0, msg: "订单已退款" })

        const result = await refundYipayOrder("ord_1", "1.50")

        expect(result).toEqual({ ok: false, message: "订单已退款" })
    })

    it("returns null on non-OK HTTP response", async () => {
        mockFetch({}, false, 500)

        const result = await refundYipayOrder("ord_1", "1.50")

        expect(result).toBeNull()
    })

    it("uses per-channel credentials when provided", async () => {
        mockFetch({ code: 1, msg: "ok" })

        await refundYipayOrder("ord_1", "2.00", {
            pid: "chan_pid",
            key: "chan_key",
            submitUrl: "https://chan.example.com/submit.php",
        })

        const fetchMock = global.fetch as jest.Mock
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe("https://chan.example.com/api.php?act=refund")
        const sentBody = new URLSearchParams(init.body as string)
        expect(sentBody.get("pid")).toBe("chan_pid")
        expect(sentBody.get("key")).toBe("chan_key")
    })
})
