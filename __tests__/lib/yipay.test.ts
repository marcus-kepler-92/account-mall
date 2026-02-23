import { createHash } from "crypto"
import {
    getVerifyParams,
    buildSubmitUrl,
    verifyYipayNotifySign,
    isYipayConfigured,
    getYipayPagePayUrl,
} from "@/lib/yipay"

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
