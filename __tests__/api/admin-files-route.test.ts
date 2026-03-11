import { type NextRequest } from "next/server"
import { GET, DELETE } from "@/app/api/admin/files/route"

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getAdminSession: jest.fn(),
}))

jest.mock("@vercel/blob", () => ({
    list: jest.fn(),
    del: jest.fn().mockResolvedValue(undefined),
}))

const getAdminSession = require("@/lib/auth-guard").getAdminSession as jest.Mock
const list = require("@vercel/blob").list as jest.Mock
const del = require("@vercel/blob").del as jest.Mock

const adminSession = { user: { id: "admin_1" } }

const BLOB_TOKEN = "test-token"

function createGetRequest(prefix: string, cursor?: string, limit?: number): NextRequest {
    const url = new URL("http://localhost/api/admin/files")
    url.searchParams.set("prefix", prefix)
    if (cursor) url.searchParams.set("cursor", cursor)
    if (limit !== undefined) url.searchParams.set("limit", String(limit))
    return { nextUrl: url } as unknown as NextRequest
}

function createDeleteRequest(urls: string[]): NextRequest {
    return {
        json: () => Promise.resolve({ urls }),
    } as unknown as NextRequest
}

describe("GET /api/admin/files", () => {
    const originalEnv = process.env

    beforeEach(() => {
        getAdminSession.mockReset()
        list.mockReset()
        process.env = { ...originalEnv, BLOB_READ_WRITE_TOKEN: BLOB_TOKEN }
    })

    afterAll(() => {
        process.env = originalEnv
    })

    it("returns 401 when not authenticated", async () => {
        getAdminSession.mockResolvedValue(null)
        const req = createGetRequest("products")
        const res = await GET(req)
        expect(res.status).toBe(401)
        expect(list).not.toHaveBeenCalled()
    })

    it("returns 503 when BLOB_READ_WRITE_TOKEN is not set", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        delete process.env.BLOB_READ_WRITE_TOKEN
        const req = createGetRequest("products")
        const res = await GET(req)
        process.env.BLOB_READ_WRITE_TOKEN = BLOB_TOKEN
        expect(res.status).toBe(503)
        const data = await res.json()
        expect(data.error).toMatch(/BLOB_READ_WRITE_TOKEN|文件存储未配置/)
        expect(list).not.toHaveBeenCalled()
    })

    it("returns 400 when prefix is missing", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        const url = new URL("http://localhost/api/admin/files")
        const req = { nextUrl: url } as unknown as NextRequest
        const res = await GET(req)
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toMatch(/prefix|可选/)
        expect(list).not.toHaveBeenCalled()
    })

    it("returns 400 when prefix is not in whitelist", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        const req = createGetRequest("invalid-prefix")
        const res = await GET(req)
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toMatch(/prefix|可选/)
        expect(list).not.toHaveBeenCalled()
    })

    it("returns 200 with blobs and nextCursor when list succeeds", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        const blobItem = {
            url: "https://store.public.blob.vercel-storage.com/products/abc.jpg",
            pathname: "products/abc.jpg",
            size: 1024,
            uploadedAt: new Date("2025-01-15T10:00:00.000Z"),
        }
        list.mockResolvedValue({
            blobs: [blobItem],
            cursor: "next-page-cursor",
            hasMore: true,
        })
        const req = createGetRequest("products")
        const res = await GET(req)
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data.blobs).toHaveLength(1)
        expect(data.blobs[0]).toEqual({
            url: blobItem.url,
            pathname: blobItem.pathname,
            size: blobItem.size,
            uploadedAt: "2025-01-15T10:00:00.000Z",
        })
        expect(data.nextCursor).toBe("next-page-cursor")
        expect(list).toHaveBeenCalledWith({
            prefix: "products/",
            cursor: undefined,
            limit: 20,
        })
    })

    it("passes cursor and limit to list when provided", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        list.mockResolvedValue({ blobs: [], hasMore: false })
        const req = createGetRequest("guides", "cursor-123", 50)
        const res = await GET(req)
        expect(res.status).toBe(200)
        expect(list).toHaveBeenCalledWith({
            prefix: "guides/",
            cursor: "cursor-123",
            limit: 50,
        })
    })

    it("caps limit at 100 when over 100", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        list.mockResolvedValue({ blobs: [], hasMore: false })
        const req = createGetRequest("announcements", undefined, 200)
        const res = await GET(req)
        expect(res.status).toBe(200)
        expect(list).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 100 })
        )
    })

    it("does not return nextCursor when hasMore is false", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        list.mockResolvedValue({ blobs: [], hasMore: false })
        const req = createGetRequest("receipts")
        const res = await GET(req)
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data.nextCursor).toBeUndefined()
    })

    it("accepts all whitelisted prefixes: products, guides, announcements, receipts", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        list.mockResolvedValue({ blobs: [], hasMore: false })
        for (const prefix of ["products", "guides", "announcements", "receipts"]) {
            list.mockClear()
            const req = createGetRequest(prefix)
            const res = await GET(req)
            expect(res.status).toBe(200)
            expect(list).toHaveBeenCalledWith(
                expect.objectContaining({ prefix: `${prefix}/` })
            )
        }
    })

    it("returns 500 when list throws", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        list.mockRejectedValue(new Error("Blob list failed"))
        const req = createGetRequest("products")
        const res = await GET(req)
        expect(res.status).toBe(500)
        const data = await res.json()
        expect(data.error).toMatch(/列举|失败|重试/)
    })
})

describe("DELETE /api/admin/files", () => {
    const originalEnv = process.env

    beforeEach(() => {
        getAdminSession.mockReset()
        del.mockReset().mockResolvedValue(undefined)
        process.env = { ...originalEnv, BLOB_READ_WRITE_TOKEN: BLOB_TOKEN }
    })

    afterAll(() => {
        process.env = originalEnv
    })

    it("returns 401 when not authenticated", async () => {
        getAdminSession.mockResolvedValue(null)
        const req = createDeleteRequest(["https://store.public.blob.vercel-storage.com/x.jpg"])
        const res = await DELETE(req)
        expect(res.status).toBe(401)
        expect(del).not.toHaveBeenCalled()
    })

    it("returns 503 when BLOB_READ_WRITE_TOKEN is not set", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        delete process.env.BLOB_READ_WRITE_TOKEN
        const req = createDeleteRequest(["https://store.public.blob.vercel-storage.com/x.jpg"])
        const res = await DELETE(req)
        process.env.BLOB_READ_WRITE_TOKEN = BLOB_TOKEN
        expect(res.status).toBe(503)
        const data = await res.json()
        expect(data.error).toMatch(/BLOB_READ_WRITE_TOKEN|文件存储未配置/)
        expect(del).not.toHaveBeenCalled()
    })

    it("returns 400 when body is not valid JSON", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        const req = {
            json: () => Promise.reject(new Error("Invalid JSON")),
        } as unknown as NextRequest
        const res = await DELETE(req)
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toMatch(/JSON|urls/)
        expect(del).not.toHaveBeenCalled()
    })

    it("returns 400 when urls is missing", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        const req = createDeleteRequest([])
        const reqWithEmpty = { json: () => Promise.resolve({}) } as unknown as NextRequest
        const res = await DELETE(reqWithEmpty)
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toMatch(/urls|提供|数组/)
        expect(del).not.toHaveBeenCalled()
    })

    it("returns 400 when urls is not an array", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        const req = { json: () => Promise.resolve({ urls: "not-array" }) } as unknown as NextRequest
        const res = await DELETE(req)
        expect(res.status).toBe(400)
        expect(del).not.toHaveBeenCalled()
    })

    it("returns 400 when urls array is empty", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        const req = createDeleteRequest([])
        const res = await DELETE(req)
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toMatch(/urls|提供|数组/)
        expect(del).not.toHaveBeenCalled()
    })

    it("returns 400 when no valid http URL in urls", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        const req = createDeleteRequest(["not-a-url", "/relative/path.jpg"])
        const res = await DELETE(req)
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toMatch(/有效|blob URL/)
        expect(del).not.toHaveBeenCalled()
    })

    it("returns 200 and calls del with valid urls", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        const urls = [
            "https://store.public.blob.vercel-storage.com/products/a.jpg",
            "https://store.public.blob.vercel-storage.com/products/b.jpg",
        ]
        const req = createDeleteRequest(urls)
        const res = await DELETE(req)
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data.deleted).toEqual(urls)
        expect(del).toHaveBeenCalledTimes(1)
        expect(del).toHaveBeenCalledWith(urls)
    })

    it("filters to only http(s) URLs and calls del with them", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        const validUrl = "https://store.public.blob.vercel-storage.com/x.jpg"
        const req = createDeleteRequest(["invalid", validUrl, "ftp://other.com/y.jpg"])
        const res = await DELETE(req)
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data.deleted).toEqual([validUrl])
        expect(del).toHaveBeenCalledWith([validUrl])
    })

    it("returns 500 when del throws", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        del.mockRejectedValue(new Error("Blob delete failed"))
        const req = createDeleteRequest(["https://store.public.blob.vercel-storage.com/x.jpg"])
        const res = await DELETE(req)
        expect(res.status).toBe(500)
        const data = await res.json()
        expect(data.error).toMatch(/删除|失败|重试/)
    })
})
