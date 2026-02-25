/**
 * Unit tests for rate-limit: getClientIp, checkOrderCreateRateLimit, checkOrderQueryRateLimit.
 */

import { NextRequest } from "next/server"
import {
    getClientIp,
    checkOrderCreateRateLimit,
    checkOrderQueryRateLimit,
} from "@/lib/rate-limit"

jest.mock("@/lib/config", () => ({
    config: {
        nodeEnv: "production",
        orderRateLimitPoints: 5,
        orderQueryRateLimitPoints: 10,
        maxPendingOrdersPerIp: 3,
    },
}))

function createRequest(headers: Record<string, string> = {}): NextRequest {
    return {
        headers: new Map(Object.entries(headers)),
    } as unknown as NextRequest
}

describe("getClientIp", () => {
    it("returns first IP from x-forwarded-for", () => {
        const req = createRequest({ "x-forwarded-for": " 1.2.3.4 , 5.6.7.8 " })
        expect(getClientIp(req)).toBe("1.2.3.4")
    })

    it("returns x-real-ip when x-forwarded-for is missing", () => {
        const req = createRequest({ "x-real-ip": "9.10.11.12" })
        expect(getClientIp(req)).toBe("9.10.11.12")
    })

    it("returns unknown when no IP headers", () => {
        const req = createRequest({})
        expect(getClientIp(req)).toBe("unknown")
    })
})

describe("checkOrderCreateRateLimit", () => {
    it("returns null in development (skipped)", async () => {
        const config = require("@/lib/config").config
        config.nodeEnv = "development"
        const req = createRequest({ "x-forwarded-for": "1.2.3.4" })
        const res = await checkOrderCreateRateLimit(req)
        expect(res).toBeNull()
        config.nodeEnv = "production"
    })

    it("returns null when IP is unknown (skipped)", async () => {
        const req = createRequest({})
        const res = await checkOrderCreateRateLimit(req)
        expect(res).toBeNull()
    })

    it("returns null when under limit", async () => {
        const req = createRequest({ "x-forwarded-for": "10.0.0.1" })
        const res = await checkOrderCreateRateLimit(req)
        expect(res).toBeNull()
    })

    it("returns 429 when over limit", async () => {
        const req = createRequest({ "x-forwarded-for": "10.0.0.99" })
        for (let i = 0; i < 5; i++) {
            await checkOrderCreateRateLimit(req)
        }
        const res = await checkOrderCreateRateLimit(req)
        expect(res).not.toBeNull()
        expect(res!.status).toBe(429)
        const data = await res!.json()
        expect(data.error).toMatch(/Too many|try again/)
    })
})

describe("checkOrderQueryRateLimit", () => {
    it("returns null in development (skipped)", async () => {
        const config = require("@/lib/config").config
        config.nodeEnv = "development"
        const req = createRequest({ "x-forwarded-for": "1.2.3.4" })
        const res = await checkOrderQueryRateLimit(req)
        expect(res).toBeNull()
        config.nodeEnv = "production"
    })

    it("returns null when IP is unknown (skipped)", async () => {
        const req = createRequest({})
        const res = await checkOrderQueryRateLimit(req)
        expect(res).toBeNull()
    })

    it("returns 429 when over limit", async () => {
        const req = createRequest({ "x-forwarded-for": "10.0.0.88" })
        for (let i = 0; i < 10; i++) {
            await checkOrderQueryRateLimit(req)
        }
        const res = await checkOrderQueryRateLimit(req)
        expect(res).not.toBeNull()
        expect(res!.status).toBe(429)
        const data = await res!.json()
        expect(data.error).toMatch(/Too many|try again/)
    })
})
