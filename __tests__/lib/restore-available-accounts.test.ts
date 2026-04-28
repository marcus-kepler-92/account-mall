import { restoreAvailableAccounts } from "@/lib/restore-available-accounts"
import { prismaMock } from "../__mocks__/prisma"

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/config", () => ({
    __esModule: true,
    config: {
        autoFetchSourceUrls: ["http://global-source.com"],
    },
}))

jest.mock("@/lib/scrape-shared-accounts", () => ({
    __esModule: true,
    scrapeMultipleUrls: jest.fn(),
}))

import { scrapeMultipleUrls } from "@/lib/scrape-shared-accounts"

const scrapeMultipleUrlsMock = scrapeMultipleUrls as jest.Mock

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeProduct(id: string, sourceUrl: string | null = null) {
    return { id, sourceUrl } as never
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("restoreAvailableAccounts", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        prismaMock.accountBlacklist.deleteMany.mockResolvedValue({ count: 0 })
    })

    // ─── No products ─────────────────────────────────────────────────────────

    it("returns zeros when there are no AUTO_FETCH products", async () => {
        prismaMock.product.findMany.mockResolvedValue([])

        const result = await restoreAvailableAccounts()
        expect(result).toEqual({ restored: 0, productsProcessed: 0 })
        expect(scrapeMultipleUrlsMock).not.toHaveBeenCalled()
    })

    // ─── Uses global fallback ─────────────────────────────────────────────────

    it("uses global autoFetchSourceUrls[0] for products with no sourceUrl", async () => {
        prismaMock.product.findMany.mockResolvedValue([makeProduct("prod_1", null)])
        scrapeMultipleUrlsMock.mockResolvedValue([{ account: "a@b.com", password: "pw" }])
        prismaMock.accountBlacklist.deleteMany.mockResolvedValue({ count: 1 })

        await restoreAvailableAccounts()

        expect(scrapeMultipleUrlsMock).toHaveBeenCalledWith("http://global-source.com")
    })

    // ─── Scrape returns empty ─────────────────────────────────────────────────

    it("skips deleteMany when scrape returns no accounts", async () => {
        prismaMock.product.findMany.mockResolvedValue([makeProduct("prod_1", "http://src.com")])
        scrapeMultipleUrlsMock.mockResolvedValue([])

        const result = await restoreAvailableAccounts()
        expect(result).toEqual({ restored: 0, productsProcessed: 0 })
        expect(prismaMock.accountBlacklist.deleteMany).not.toHaveBeenCalled()
    })

    // ─── Scrape failure ───────────────────────────────────────────────────────

    it("skips product and continues when scrape throws", async () => {
        prismaMock.product.findMany.mockResolvedValue([
            makeProduct("prod_1", "http://bad-source.com"),
            makeProduct("prod_2", "http://good-source.com"),
        ])
        scrapeMultipleUrlsMock
            .mockRejectedValueOnce(new Error("network error"))
            .mockResolvedValueOnce([{ account: "ok@source.com", password: "pw" }])
        prismaMock.accountBlacklist.deleteMany.mockResolvedValue({ count: 1 })

        const result = await restoreAvailableAccounts()
        expect(result.restored).toBe(1)
        expect(result.productsProcessed).toBe(1)
        expect(prismaMock.accountBlacklist.deleteMany).toHaveBeenCalledTimes(1)
    })

    // ─── Restore logic ────────────────────────────────────────────────────────

    it("deletes non-manual blacklist entries for accounts found in source", async () => {
        prismaMock.product.findMany.mockResolvedValue([makeProduct("prod_1", "http://src.com")])
        scrapeMultipleUrlsMock.mockResolvedValue([
            { account: "back@src.com", password: "pw1" },
            { account: "also@src.com", password: "pw2" },
        ])
        prismaMock.accountBlacklist.deleteMany.mockResolvedValue({ count: 2 })

        const result = await restoreAvailableAccounts()
        expect(result).toEqual({ restored: 2, productsProcessed: 1 })

        expect(prismaMock.accountBlacklist.deleteMany).toHaveBeenCalledWith({
            where: {
                productId: "prod_1",
                account: { in: ["back@src.com", "also@src.com"] },
                OR: [{ reason: null }, { reason: { not: "管理员手动拉黑" } }],
            },
        })
    })

    // ─── Multiple products ────────────────────────────────────────────────────

    it("accumulates restored count across multiple products", async () => {
        prismaMock.product.findMany.mockResolvedValue([
            makeProduct("prod_1", "http://src1.com"),
            makeProduct("prod_2", "http://src2.com"),
        ])
        scrapeMultipleUrlsMock.mockResolvedValue([{ account: "a@b.com", password: "pw" }])
        prismaMock.accountBlacklist.deleteMany
            .mockResolvedValueOnce({ count: 3 })
            .mockResolvedValueOnce({ count: 1 })

        const result = await restoreAvailableAccounts()
        expect(result).toEqual({ restored: 4, productsProcessed: 2 })
    })
})
