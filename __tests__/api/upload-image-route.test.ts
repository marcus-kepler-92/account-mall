import { type NextRequest } from "next/server"
import { POST } from "@/app/api/upload/image/route"

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getAdminSession: jest.fn(),
}))

jest.mock("@/lib/upload", () => ({
    uploadBinary: jest.fn().mockResolvedValue("https://blob.example.com/uploads/test.jpg"),
    DEFAULT_MAX_BYTES: 4 * 1024 * 1024,
}))

const getAdminSession = require("@/lib/auth-guard").getAdminSession as jest.Mock
const uploadBinary = require("@/lib/upload").uploadBinary as jest.Mock

const adminSession = { user: { id: "admin_1" } }

const PRODUCT_IMAGE_MAX_BYTES = 2 * 1024 * 1024 // 2MB

function createUploadRequest(options: {
    file?: File
    pathPrefixForm?: string
    pathPrefixQuery?: string
    contentType?: string
}): NextRequest {
    const formData = new FormData()
    if (options.file) formData.set("file", options.file)
    if (options.pathPrefixForm !== undefined) formData.set("pathPrefix", options.pathPrefixForm)

    const url = new URL("http://localhost/api/upload/image")
    if (options.pathPrefixQuery !== undefined) url.searchParams.set("pathPrefix", options.pathPrefixQuery)

    return {
        headers: { get: (name: string) => (name === "content-type" ? options.contentType ?? "multipart/form-data; boundary=----FormBoundary" : null) },
        formData: () => Promise.resolve(formData),
        nextUrl: url,
    } as unknown as NextRequest
}

function createImageFile(type: string, size: number, name = "image.jpg"): File {
    return new File([new Uint8Array(size)], name, { type })
}

describe("POST /api/upload/image", () => {
    beforeEach(() => {
        getAdminSession.mockReset()
        uploadBinary.mockReset().mockResolvedValue("https://blob.example.com/uploads/test.jpg")
    })

    it("returns 401 when not authenticated", async () => {
        getAdminSession.mockResolvedValue(null)
        const req = createUploadRequest({
            file: createImageFile("image/jpeg", 100),
        })
        const res = await POST(req)
        expect(res.status).toBe(401)
        expect(uploadBinary).not.toHaveBeenCalled()
    })

    it("returns 400 when content-type is not multipart/form-data", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        const req = createUploadRequest({
            file: createImageFile("image/jpeg", 100),
            contentType: "application/json",
        })
        const res = await POST(req)
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toMatch(/multipart\/form-data/)
        expect(uploadBinary).not.toHaveBeenCalled()
    })

    it("returns 400 when file is missing", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        const req = createUploadRequest({})
        const res = await POST(req)
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toMatch(/选择图片/)
        expect(uploadBinary).not.toHaveBeenCalled()
    })

    it("returns 400 when file size is zero", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        const req = createUploadRequest({
            file: createImageFile("image/jpeg", 0),
        })
        const res = await POST(req)
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toMatch(/选择图片/)
        expect(uploadBinary).not.toHaveBeenCalled()
    })

    it("returns 400 when file type is not allowed", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        const req = createUploadRequest({
            file: new File(["x"], "image.svg", { type: "image/svg+xml" }),
        })
        const res = await POST(req)
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toMatch(/JPG|PNG|WebP|GIF|2MB/)
        expect(uploadBinary).not.toHaveBeenCalled()
    })

    it("returns 400 when file size exceeds 2MB", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        const req = createUploadRequest({
            file: createImageFile("image/jpeg", PRODUCT_IMAGE_MAX_BYTES + 1),
        })
        const res = await POST(req)
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toMatch(/2MB/)
        expect(uploadBinary).not.toHaveBeenCalled()
    })

    it("returns 200 and uploads with pathPrefix products when valid and no pathPrefix given", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        const file = createImageFile("image/png", 500)
        const req = createUploadRequest({ file })
        const res = await POST(req)
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data.url).toBe("https://blob.example.com/uploads/test.jpg")
        expect(uploadBinary).toHaveBeenCalledTimes(1)
        expect(uploadBinary).toHaveBeenCalledWith(
            expect.any(Buffer),
            expect.objectContaining({
                mimeType: "image/png",
                pathPrefix: "products",
                cacheControlMaxAge: 365 * 24 * 60 * 60,
            })
        )
    })

    it("uses pathPrefix from formData when pathPrefix=guides", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        const file = createImageFile("image/webp", 100)
        const req = createUploadRequest({ file, pathPrefixForm: "guides" })
        const res = await POST(req)
        expect(res.status).toBe(200)
        expect(uploadBinary).toHaveBeenCalledWith(
            expect.any(Buffer),
            expect.objectContaining({ pathPrefix: "guides" })
        )
    })

    it("uses pathPrefix from query when pathPrefix=guides", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        const file = createImageFile("image/gif", 100)
        const req = createUploadRequest({ file, pathPrefixQuery: "guides" })
        const res = await POST(req)
        expect(res.status).toBe(200)
        expect(uploadBinary).toHaveBeenCalledWith(
            expect.any(Buffer),
            expect.objectContaining({ pathPrefix: "guides" })
        )
    })

    it("uses pathPrefix from formData over query when both present", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        const file = createImageFile("image/jpeg", 100)
        const req = createUploadRequest({
            file,
            pathPrefixForm: "announcements",
            pathPrefixQuery: "guides",
        })
        const res = await POST(req)
        expect(res.status).toBe(200)
        expect(uploadBinary).toHaveBeenCalledWith(
            expect.any(Buffer),
            expect.objectContaining({ pathPrefix: "announcements" })
        )
    })

    it("falls back to products when pathPrefix is not in whitelist", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        const file = createImageFile("image/jpeg", 100)
        const req = createUploadRequest({ file, pathPrefixForm: "malicious" })
        const res = await POST(req)
        expect(res.status).toBe(200)
        expect(uploadBinary).toHaveBeenCalledWith(
            expect.any(Buffer),
            expect.objectContaining({ pathPrefix: "products" })
        )
    })

    it("accepts image/jpeg, image/png, image/webp, image/gif", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        for (const mime of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
            uploadBinary.mockClear()
            const file = createImageFile(mime, 100, "img")
            const req = createUploadRequest({ file })
            const res = await POST(req)
            expect(res.status).toBe(200)
            expect(uploadBinary).toHaveBeenCalledWith(
                expect.any(Buffer),
                expect.objectContaining({ mimeType: mime })
            )
        }
    })
})
