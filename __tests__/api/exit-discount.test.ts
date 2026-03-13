import { type NextRequest } from "next/server"
import { POST } from "@/app/api/exit-discount/route"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/rate-limit", () => ({
    __esModule: true,
    getClientIp: jest.fn().mockReturnValue("127.0.0.1"),
    checkOrderCreateRateLimit: jest.fn().mockResolvedValue(null),
}))

// 全局配置 mock，允许测试中动态切换 exitDiscountSecret
jest.mock("@/lib/config", () => {
    const mock = {
        exitDiscountSecret: "test-exit-secret",
        exitDiscountPercent: 5,
        exitDiscountTtlMs: 900_000,
        databaseUrl: "postgresql://localhost:5432/test",
        betterAuthSecret: "x".repeat(32),
        siteUrl: "http://localhost:3000",
        nodeEnv: "test" as const,
    }
    ;(global as { __exitDiscountConfigMock?: typeof mock }).__exitDiscountConfigMock = mock
    return { config: mock, getConfig: () => mock }
})

function getConfigMock() {
    return (global as { __exitDiscountConfigMock?: { exitDiscountSecret?: string; exitDiscountPercent: number; exitDiscountTtlMs: number } }).__exitDiscountConfigMock!
}

function createJsonRequest(
    body: unknown,
    cookies?: { get: (name: string) => { value: string } | undefined }
): NextRequest {
    return {
        json: async () => body,
        cookies: cookies ?? { get: () => undefined },
    } as unknown as NextRequest
}

function createInvalidJsonRequest(): NextRequest {
    return {
        json: async () => { throw new Error("Invalid JSON") },
        cookies: { get: () => undefined },
    } as unknown as NextRequest
}

describe("POST /api/exit-discount", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        getConfigMock().exitDiscountSecret = "test-exit-secret"
        prismaMock.exitDiscountUsage.findFirst.mockResolvedValue(null)
    })

    it("returns {eligible: false} when exitDiscountSecret is not configured", async () => {
        getConfigMock().exitDiscountSecret = undefined
        const res = await POST(createJsonRequest({ productId: "prod_1", fingerprintHash: "fp_1" }))
        const data = await res.json()
        expect(data).toEqual({ eligible: false })
    })

    it("returns 400 when request body is invalid JSON", async () => {
        const res = await POST(createInvalidJsonRequest())
        const data = await res.json()
        expect(res.status).toBe(400)
        expect(data.error).toBe("Invalid JSON body")
    })

    it("returns 400 when productId is missing", async () => {
        const res = await POST(createJsonRequest({ fingerprintHash: "fp_1" }))
        const data = await res.json()
        expect(res.status).toBe(400)
        expect(data.error).toBeDefined()
    })

    it("returns 400 when fingerprintHash is missing", async () => {
        const res = await POST(createJsonRequest({ productId: "prod_1" }))
        const data = await res.json()
        expect(res.status).toBe(400)
        expect(data.error).toBeDefined()
    })

    it("returns {eligible: false} when visitorId (cookie signal) is already in ExitDiscountUsage", async () => {
        const cookies = { get: (name: string) => name === "__ed_vid" ? { value: "existing-visitor" } : undefined }

        // Signal 1 (visitorId) hits
        prismaMock.exitDiscountUsage.findFirst
            .mockResolvedValueOnce({ id: "usage_1" } as any) // byVisitorId
            .mockResolvedValueOnce(null)                      // byFingerprint
            .mockResolvedValueOnce(null)                      // byIpWithOtherSignal

        const res = await POST(createJsonRequest({ productId: "prod_1", fingerprintHash: "fp_1" }, cookies))
        const data = await res.json()
        expect(data).toEqual({ eligible: false })
    })

    it("returns {eligible: false} when fingerprintHash is already in ExitDiscountUsage", async () => {
        // Signal 2 (fingerprintHash) hits
        prismaMock.exitDiscountUsage.findFirst
            .mockResolvedValueOnce(null)                      // byVisitorId
            .mockResolvedValueOnce({ id: "usage_2" } as any) // byFingerprint
            .mockResolvedValueOnce(null)                      // byIpWithOtherSignal

        const res = await POST(createJsonRequest({ productId: "prod_1", fingerprintHash: "fp_existing" }))
        const data = await res.json()
        expect(data).toEqual({ eligible: false })
    })

    it("returns {eligible: false} when IP + another signal hits (auxiliary block)", async () => {
        const cookies = { get: (name: string) => name === "__ed_vid" ? { value: "visitor-abc" } : undefined }

        // Signal 3 (IP + other signal) hits
        prismaMock.exitDiscountUsage.findFirst
            .mockResolvedValueOnce(null)                      // byVisitorId
            .mockResolvedValueOnce(null)                      // byFingerprint
            .mockResolvedValueOnce({ id: "usage_3" } as any) // byIpWithOtherSignal

        const res = await POST(createJsonRequest({ productId: "prod_1", fingerprintHash: "fp_1" }, cookies))
        const data = await res.json()
        expect(data).toEqual({ eligible: false })
    })

    it("returns eligible:true when only IP hits (no other signals) -- IP-only does not block", async () => {
        // All signals return null → eligible
        prismaMock.exitDiscountUsage.findFirst
            .mockResolvedValue(null)

        const res = await POST(createJsonRequest({ productId: "prod_1", fingerprintHash: "fp_new" }))
        const data = await res.json()
        expect(data.eligible).toBe(true)
        expect(data.token).toBeDefined()
        expect(data.expiresAt).toBeDefined()
        expect(data.discountPercent).toBe(5)
    })

    it("returns eligible:true with token/expiresAt/discountPercent when all signals pass", async () => {
        prismaMock.exitDiscountUsage.findFirst.mockResolvedValue(null)

        const res = await POST(createJsonRequest({ productId: "prod_1", fingerprintHash: "fp_new" }))
        const data = await res.json()

        expect(data.eligible).toBe(true)
        expect(typeof data.token).toBe("string")
        expect(data.token.length).toBeGreaterThan(0)
        expect(typeof data.expiresAt).toBe("number")
        expect(data.discountPercent).toBe(5)
    })

    it("sets __ed_vid cookie on response when no existing visitor cookie", async () => {
        prismaMock.exitDiscountUsage.findFirst.mockResolvedValue(null)

        const res = await POST(createJsonRequest({ productId: "prod_1", fingerprintHash: "fp_new" }))

        // NextResponse cookies are available via getSetCookie or headers
        const setCookieHeader = res.headers.get("set-cookie") ?? ""
        expect(setCookieHeader).toContain("__ed_vid=")
        expect(setCookieHeader).toContain("HttpOnly")
    })

    it("does not set __ed_vid cookie when visitor cookie already exists", async () => {
        prismaMock.exitDiscountUsage.findFirst.mockResolvedValue(null)

        const cookies = { get: (name: string) => name === "__ed_vid" ? { value: "  existing-visitor  " } : undefined }
        const res = await POST(createJsonRequest({ productId: "prod_1", fingerprintHash: "fp_1" }, cookies))

        const setCookieHeader = res.headers.get("set-cookie") ?? ""
        expect(setCookieHeader).not.toContain("__ed_vid=")
    })

    it("skips IP query (byIpWithOtherSignal) when IP is 'unknown'", async () => {
        const { getClientIp } = require("@/lib/rate-limit")
        ;(getClientIp as jest.Mock).mockReturnValueOnce("unknown")

        prismaMock.exitDiscountUsage.findFirst.mockResolvedValue(null)

        await POST(createJsonRequest({ productId: "prod_1", fingerprintHash: "fp_1" }))

        // findFirst should only be called twice (visitorId + fingerprint), not for IP
        expect(prismaMock.exitDiscountUsage.findFirst).toHaveBeenCalledTimes(2)
    })
})
