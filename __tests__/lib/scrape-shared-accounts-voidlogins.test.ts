/**
 * Unit tests for scrapeMultipleUrls — voidlogins strategy path.
 * Covers API routing, field normalisation, filtering, deduplication, and error handling.
 */

import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { scrapeMultipleUrls } from "@/lib/scrape-shared-accounts"
import { buildVoidloginsSourceUrl } from "@/lib/utils"

jest.mock("@/lib/config", () => ({
    config: {
        appleHostingUrl: "https://test-hosting.example.com",
        autoFetchScrapeTimeoutMs: 15000,
        autoFetchScrapeCacheTtlMs: 0,
    },
}))

jest.mock("@/lib/fetch-with-timeout", () => ({
    fetchWithTimeout: jest.fn(),
}))

const mockFetch = fetchWithTimeout as jest.MockedFunction<typeof fetchWithTimeout>

const BASE = "https://test-hosting.example.com"

function fakeResponse(body: unknown, ok = true, status = 200): Response {
    return {
        ok,
        status,
        json: () => Promise.resolve(body),
        text: () => Promise.resolve(JSON.stringify(body)),
    } as unknown as Response
}

describe("scrapeMultipleUrls — voidlogins strategy", () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    // ── Routing ───────────────────────────────────────────────────────────────

    it("routes voidlogins:// to the JSON API with Accept: application/json", async () => {
        mockFetch.mockResolvedValue(fakeResponse({ status: true, msg: "ok", accounts: [] }))
        await scrapeMultipleUrls("voidlogins://CODE123")
        expect(mockFetch).toHaveBeenCalledWith(
            `${BASE}/shareapi/CODE123`,
            expect.objectContaining({ headers: expect.objectContaining({ Accept: "application/json" }) }),
        )
    })

    it("includes password segment in API URL when present", async () => {
        mockFetch.mockResolvedValue(fakeResponse({ status: true, msg: "ok", accounts: [] }))
        await scrapeMultipleUrls("voidlogins://CODE/PASS")
        expect(mockFetch).toHaveBeenCalledWith(`${BASE}/shareapi/CODE/PASS`, expect.anything())
    })

    it("omits password segment when voidlogins URL has no password", async () => {
        mockFetch.mockResolvedValue(fakeResponse({ status: true, msg: "ok", accounts: [] }))
        await scrapeMultipleUrls("voidlogins://MYCODE")
        const [url] = mockFetch.mock.calls[0]
        expect(url).toBe(`${BASE}/shareapi/MYCODE`)
    })

    it("URL-encodes special characters in code and password", async () => {
        mockFetch.mockResolvedValue(fakeResponse({ status: true, msg: "ok", accounts: [] }))
        const sourceUrl = buildVoidloginsSourceUrl("my code", "my@pass")
        await scrapeMultipleUrls(sourceUrl)
        expect(mockFetch).toHaveBeenCalledWith(
            `${BASE}/shareapi/my%20code/my%40pass`,
            expect.anything(),
        )
    })

    // ── Field normalisation ───────────────────────────────────────────────────

    it("normalises full account fields from API response", async () => {
        mockFetch.mockResolvedValue(fakeResponse({
            code: 200,
            status: true,
            msg: "获取成功",
            accounts: [{
                id: 1,
                username: "test@icloud.com",
                password: "secret123",
                status: true,
                region_display: "美国",
                frontend_remark: "请勿绑定手机",
                last_check: "2026-03-01 12:00:00",
                last_check_success: 1,
                check_interval: 120,
            }],
        }))
        const result = await scrapeMultipleUrls("voidlogins://CODE")
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({
            account: "test@icloud.com",
            password: "secret123",
            region: "美国",
            status: "正常",
            lastCheckedAt: "2026-03-01 12:00:00",
            remark: "请勿绑定手机",
        })
    })

    it("falls back to '未知' when region_display is absent", async () => {
        mockFetch.mockResolvedValue(fakeResponse({
            status: true, msg: "ok",
            accounts: [{ username: "a@b.com", password: "pw", status: true }],
        }))
        const result = await scrapeMultipleUrls("voidlogins://CODE")
        expect(result[0].region).toBe("未知")
    })

    it("omits lastCheckedAt and installStatus when not present in API response", async () => {
        mockFetch.mockResolvedValue(fakeResponse({
            status: true, msg: "ok",
            accounts: [{ username: "x@y.com", password: "pw", status: true }],
        }))
        const result = await scrapeMultipleUrls("voidlogins://CODE")
        expect(result[0].lastCheckedAt).toBeUndefined()
        expect(result[0].remark).toBeUndefined()
    })

    // ── Filtering ─────────────────────────────────────────────────────────────

    it("filters out accounts where status is false", async () => {
        mockFetch.mockResolvedValue(fakeResponse({
            status: true, msg: "ok",
            accounts: [
                { username: "good@icloud.com", password: "pw1", status: true },
                { username: "bad@icloud.com", password: "pw2", status: false },
            ],
        }))
        const result = await scrapeMultipleUrls("voidlogins://CODE")
        expect(result).toHaveLength(1)
        expect(result[0].account).toBe("good@icloud.com")
    })

    it("skips accounts with missing username or password", async () => {
        mockFetch.mockResolvedValue(fakeResponse({
            status: true, msg: "ok",
            accounts: [
                { username: "", password: "pw", status: true },
                { username: "ok@icloud.com", password: "", status: true },
                { username: "valid@icloud.com", password: "pw", status: true },
            ],
        }))
        const result = await scrapeMultipleUrls("voidlogins://CODE")
        expect(result).toHaveLength(1)
        expect(result[0].account).toBe("valid@icloud.com")
    })

    // ── Deduplication ─────────────────────────────────────────────────────────

    it("deduplicates by username, keeping first occurrence", async () => {
        mockFetch.mockResolvedValue(fakeResponse({
            status: true, msg: "ok",
            accounts: [
                { username: "dup@icloud.com", password: "first", status: true },
                { username: "dup@icloud.com", password: "second", status: true },
            ],
        }))
        const result = await scrapeMultipleUrls("voidlogins://CODE")
        expect(result).toHaveLength(1)
        expect(result[0].password).toBe("first")
    })

    // ── Error handling ────────────────────────────────────────────────────────

    it("returns [] when API status is false", async () => {
        mockFetch.mockResolvedValue(fakeResponse({ status: false, msg: "invalid code", accounts: [] }))
        const result = await scrapeMultipleUrls("voidlogins://BADCODE")
        expect(result).toEqual([])
    })

    it("returns [] on HTTP error", async () => {
        mockFetch.mockResolvedValue(fakeResponse({ error: "Not Found" }, false, 404))
        const result = await scrapeMultipleUrls("voidlogins://CODE")
        expect(result).toEqual([])
    })

    it("returns [] on network error", async () => {
        mockFetch.mockRejectedValue(new Error("ECONNREFUSED"))
        const result = await scrapeMultipleUrls("voidlogins://CODE")
        expect(result).toEqual([])
    })

    it("returns [] for empty accounts array", async () => {
        mockFetch.mockResolvedValue(fakeResponse({ status: true, msg: "ok", accounts: [] }))
        const result = await scrapeMultipleUrls("voidlogins://CODE")
        expect(result).toEqual([])
    })

    it("returns [] for invalid / non-HTTP sourceUrl", async () => {
        const result = await scrapeMultipleUrls("not-a-valid-url")
        expect(result).toEqual([])
        expect(mockFetch).not.toHaveBeenCalled()
    })
})
