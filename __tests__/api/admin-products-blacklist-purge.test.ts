/**
 * POST /api/admin/products/[productId]/blacklist
 * Tests for the purge endpoint: expired cleanup, available-account cleanup, manual entry preservation.
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
        blacklistExpiryHours: 24,
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

describe("POST /api/admin/products/[productId]/blacklist (purge)", () => {
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

    // ─── Product not found ───────────────────────────────────────────────────

    it("returns 404 when product does not exist", async () => {
        prismaMock.product.findUnique.mockResolvedValue(null)
        const res = await POST(makeRequest(), makeContext())
        expect(res.status).toBe(404)
    })

    // ─── Expiry-only cleanup (scrape failure fallback) ───────────────────────

    it("purges only by expiry when scrape fails", async () => {
        scrapeMultipleUrlsMock.mockRejectedValue(new Error("network error"))
        prismaMock.accountBlacklist.deleteMany.mockResolvedValue({ count: 2 })

        const res = await POST(makeRequest(), makeContext())
        expect(res.status).toBe(200)

        const data = await res.json()
        expect(data.removed).toBe(2)

        // Should still call deleteMany, OR condition should only have createdAt (no account in)
        const call = prismaMock.accountBlacklist.deleteMany.mock.calls[0][0]!
        const andClause = (call.where as Record<string, unknown>).AND as Array<Record<string, unknown>>
        const orClause = andClause[1].OR as Array<Record<string, unknown>>
        // Only expiry condition, no account-in condition
        expect(orClause).toHaveLength(1)
        expect(orClause[0]).toHaveProperty("createdAt")
    })

    // ─── Normal path: purge expired records ──────────────────────────────────

    it("purges expired records on normal path", async () => {
        scrapeMultipleUrlsMock.mockResolvedValue([
            { account: "still@available.com", password: "p1" },
        ])
        prismaMock.accountBlacklist.deleteMany.mockResolvedValue({ count: 3 })

        const res = await POST(makeRequest(), makeContext())
        expect(res.status).toBe(200)

        const data = await res.json()
        expect(data.removed).toBe(3)

        // Should have called deleteMany with productId filter
        expect(prismaMock.accountBlacklist.deleteMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ productId: "prod_1" }),
            })
        )
    })

    // ─── Available account cleanup ───────────────────────────────────────────

    it("includes available accounts from scrape in purge criteria", async () => {
        scrapeMultipleUrlsMock.mockResolvedValue([
            { account: "available@test.com", password: "pw" },
            { account: "also@available.com", password: "pw2" },
        ])
        prismaMock.accountBlacklist.deleteMany.mockResolvedValue({ count: 1 })

        const res = await POST(makeRequest(), makeContext())
        expect(res.status).toBe(200)

        const call = prismaMock.accountBlacklist.deleteMany.mock.calls[0][0]!
        const andClause = (call.where as Record<string, unknown>).AND as Array<Record<string, unknown>>
        const orClause = andClause[1].OR as Array<Record<string, unknown>>
        // Should have both expiry and account-in conditions
        expect(orClause).toHaveLength(2)
        expect(orClause[0]).toHaveProperty("createdAt")
        expect(orClause[1]).toEqual({ account: { in: ["available@test.com", "also@available.com"] } })
    })

    // ─── Manual blacklist entries are never purged ───────────────────────────

    it("never purges manual blacklist entries", async () => {
        scrapeMultipleUrlsMock.mockResolvedValue([])
        prismaMock.accountBlacklist.deleteMany.mockResolvedValue({ count: 0 })

        await POST(makeRequest(), makeContext())

        const call = prismaMock.accountBlacklist.deleteMany.mock.calls[0][0]!
        const andClause = (call.where as Record<string, unknown>).AND as Array<Record<string, unknown>>
        // First AND condition should exclude manual entries
        const manualFilter = andClause[0].OR as Array<Record<string, unknown>>
        expect(manualFilter).toEqual([
            { reason: null },
            { reason: { not: "管理员手动拉黑" } },
        ])
    })

    // ─── Manual + expired: still preserved ───────────────────────────────────

    it("does not purge manual entries even if expired", async () => {
        // The filter structure inherently excludes manual entries regardless of expiry.
        // Verify the AND clause structure:
        // AND[0]: exclude manual entries
        // AND[1]: expired OR available
        scrapeMultipleUrlsMock.mockResolvedValue([
            { account: "manual@test.com", password: "pw" },
        ])
        prismaMock.accountBlacklist.deleteMany.mockResolvedValue({ count: 0 })

        await POST(makeRequest(), makeContext())

        const call = prismaMock.accountBlacklist.deleteMany.mock.calls[0][0]!
        const andClause = (call.where as Record<string, unknown>).AND as Array<Record<string, unknown>>
        // Verify structure: manual exclusion is in AND[0], separate from expiry/available in AND[1]
        expect(andClause).toHaveLength(2)
        // Manual exclusion
        expect(andClause[0]).toHaveProperty("OR")
        // Expiry/available
        expect(andClause[1]).toHaveProperty("OR")
    })
})
