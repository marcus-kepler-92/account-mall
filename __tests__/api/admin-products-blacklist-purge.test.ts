/**
 * POST /api/admin/products/[productId]/blacklist
 * Restores auto-blacklisted accounts that are currently available on source.
 */
import { NextRequest } from "next/server"
import { POST } from "@/app/api/admin/products/[productId]/blacklist/route"
import { prismaMock } from "../__mocks__/prisma"

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getAdminSession: jest.fn(),
}))

jest.mock("@/lib/config", () => ({
    __esModule: true,
    config: {
        autoFetchSourceUrls: ["http://example.com"],
    },
}))

jest.mock("@/lib/scrape-shared-accounts", () => ({
    __esModule: true,
    scrapeMultipleUrls: jest.fn(),
}))

import { getAdminSession } from "@/lib/auth-guard"
import { scrapeMultipleUrls } from "@/lib/scrape-shared-accounts"

const getAdminSessionMock = getAdminSession as jest.Mock
const scrapeMultipleUrlsMock = scrapeMultipleUrls as jest.Mock

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(): NextRequest {
    return new NextRequest("http://localhost/api/admin/products/prod_1/blacklist", {
        method: "POST",
    })
}

function makeContext(productId = "prod_1") {
    return { params: Promise.resolve({ productId }) }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/admin/products/[productId]/blacklist", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        getAdminSessionMock.mockResolvedValue({ user: { id: "admin_1" } })
        prismaMock.product.findUnique.mockResolvedValue({
            id: "prod_1",
            sourceUrl: "http://example.com",
        } as never)
        prismaMock.accountBlacklist.deleteMany.mockResolvedValue({ count: 0 })
        scrapeMultipleUrlsMock.mockResolvedValue([])
    })

    // ─── Auth ────────────────────────────────────────────────────────────────

    it("returns 401 when not authenticated", async () => {
        getAdminSessionMock.mockResolvedValue(null)
        const res = await POST(makeRequest(), makeContext())
        expect(res.status).toBe(401)
    })

    // ─── Product lookup ───────────────────────────────────────────────────────

    it("returns 404 when product does not exist", async () => {
        prismaMock.product.findUnique.mockResolvedValue(null)
        const res = await POST(makeRequest(), makeContext())
        expect(res.status).toBe(404)
    })

    // ─── No source URL ────────────────────────────────────────────────────────

    it("returns { removed: 0 } when product has no sourceUrl and no global fallback", async () => {
        jest.mock("@/lib/config", () => ({
            __esModule: true,
            config: { autoFetchSourceUrls: [] },
        }))
        prismaMock.product.findUnique.mockResolvedValue({ id: "prod_1", sourceUrl: null } as never)

        const res = await POST(makeRequest(), makeContext())
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ removed: 0 })
        expect(prismaMock.accountBlacklist.deleteMany).not.toHaveBeenCalled()
    })

    // ─── Scrape failure ───────────────────────────────────────────────────────

    it("returns { removed: 0 } and does not touch DB when scrape throws", async () => {
        scrapeMultipleUrlsMock.mockRejectedValue(new Error("network error"))

        const res = await POST(makeRequest(), makeContext())
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ removed: 0 })
        expect(prismaMock.accountBlacklist.deleteMany).not.toHaveBeenCalled()
    })

    // ─── Empty scrape result ──────────────────────────────────────────────────

    it("returns { removed: 0 } and does not touch DB when source has no accounts", async () => {
        scrapeMultipleUrlsMock.mockResolvedValue([])

        const res = await POST(makeRequest(), makeContext())
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ removed: 0 })
        expect(prismaMock.accountBlacklist.deleteMany).not.toHaveBeenCalled()
    })

    // ─── Restore available accounts ───────────────────────────────────────────

    it("deletes blacklist entries for accounts currently in source", async () => {
        scrapeMultipleUrlsMock.mockResolvedValue([
            { account: "back@source.com", password: "p1" },
            { account: "also@source.com", password: "p2" },
        ])
        prismaMock.accountBlacklist.deleteMany.mockResolvedValue({ count: 2 })

        const res = await POST(makeRequest(), makeContext())
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ removed: 2 })

        expect(prismaMock.accountBlacklist.deleteMany).toHaveBeenCalledWith({
            where: {
                productId: "prod_1",
                account: { in: ["back@source.com", "also@source.com"] },
                OR: [{ reason: null }, { reason: { not: "管理员手动拉黑" } }],
            },
        })
    })

    // ─── Uses global fallback sourceUrl ──────────────────────────────────────

    it("uses global autoFetchSourceUrls[0] when product has no sourceUrl", async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: "prod_1", sourceUrl: null } as never)
        scrapeMultipleUrlsMock.mockResolvedValue([{ account: "a@b.com", password: "pw" }])
        prismaMock.accountBlacklist.deleteMany.mockResolvedValue({ count: 1 })

        await POST(makeRequest(), makeContext())

        expect(scrapeMultipleUrlsMock).toHaveBeenCalledWith("http://example.com")
    })

    // ─── Manual entries are never restored ───────────────────────────────────

    it("never restores manually blacklisted entries", async () => {
        scrapeMultipleUrlsMock.mockResolvedValue([{ account: "manual@test.com", password: "pw" }])
        prismaMock.accountBlacklist.deleteMany.mockResolvedValue({ count: 0 })

        await POST(makeRequest(), makeContext())

        const call = prismaMock.accountBlacklist.deleteMany.mock.calls[0][0]!
        expect(call.where).toMatchObject({
            OR: [{ reason: null }, { reason: { not: "管理员手动拉黑" } }],
        })
    })
})
