import { type NextRequest } from "next/server"
import { GET, POST } from "@/app/api/announcements/route"
import { prismaMock } from "../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getAdminSession: jest.fn(),
}))

const getAdminSession = require("@/lib/auth-guard").getAdminSession as jest.Mock

const adminSession = { user: { id: "admin_1" } }

function createRequest(url: string, body?: unknown): NextRequest {
    const req = { url } as unknown as NextRequest
    if (body !== undefined) {
        (req as any).json = async () => body
    }
    return req
}

function makeAnnouncement(overrides?: Record<string, unknown>) {
    return {
        id: "ann_1",
        title: "Test Announcement",
        content: null,
        status: "PUBLISHED",
        audience: "CUSTOMER",
        isMandatory: false,
        sortOrder: 0,
        publishedAt: new Date("2026-01-01"),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    } as any
}

describe("GET /api/announcements (public)", () => {
    beforeEach(() => {
        getAdminSession.mockReset()
    })

    it("filters to audience CUSTOMER and ALL for public access", async () => {
        prismaMock.announcement.findMany.mockResolvedValue([])
        await GET(createRequest("http://localhost/api/announcements"))
        expect(prismaMock.announcement.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    status: "PUBLISHED",
                    audience: { in: ["CUSTOMER", "ALL"] },
                }),
            })
        )
    })

    it("does NOT include DISTRIBUTOR announcements in public response", async () => {
        prismaMock.announcement.findMany.mockResolvedValue([
            makeAnnouncement({ audience: "CUSTOMER" }),
        ])
        const res = await GET(createRequest("http://localhost/api/announcements"))
        expect(res.status).toBe(200)

        const where = (prismaMock.announcement.findMany.mock.calls[0][0] as any).where
        expect(where.audience.in).not.toContain("DISTRIBUTOR")
    })

    it("returns data in { data: [...] } envelope", async () => {
        prismaMock.announcement.findMany.mockResolvedValue([
            makeAnnouncement({ id: "ann_1", title: "Hello" }),
        ])
        const res = await GET(createRequest("http://localhost/api/announcements"))
        const json = await res.json()
        expect(Array.isArray(json.data)).toBe(true)
        expect(json.data[0].id).toBe("ann_1")
    })
})

describe("GET /api/announcements (admin)", () => {
    beforeEach(() => {
        getAdminSession.mockReset()
    })

    it("returns 401 when ?admin=true but not authenticated", async () => {
        getAdminSession.mockResolvedValue(null)
        const res = await GET(createRequest("http://localhost/api/announcements?admin=true"))
        expect(res.status).toBe(401)
    })

    it("returns all announcements regardless of audience when admin", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        prismaMock.announcement.findMany.mockResolvedValue([
            makeAnnouncement({ audience: "CUSTOMER" }),
            makeAnnouncement({ id: "ann_2", audience: "DISTRIBUTOR" }),
        ])

        const res = await GET(createRequest("http://localhost/api/announcements?admin=true"))
        expect(res.status).toBe(200)

        // Admin path passes no audience filter
        const where = (prismaMock.announcement.findMany.mock.calls[0][0] as any).where
        expect(where).toBeUndefined()
    })
})

describe("POST /api/announcements", () => {
    beforeEach(() => {
        getAdminSession.mockReset()
    })

    it("returns 401 when not authenticated", async () => {
        getAdminSession.mockResolvedValue(null)
        const res = await POST(createRequest("http://localhost/api/announcements", { title: "Test" }))
        expect(res.status).toBe(401)
    })

    it("returns 400 when title is missing", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        const res = await POST(createRequest("http://localhost/api/announcements", {}))
        expect(res.status).toBe(400)
    })

    it("creates announcement with CUSTOMER audience by default", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        prismaMock.announcement.create.mockResolvedValue(makeAnnouncement())

        await POST(createRequest("http://localhost/api/announcements", { title: "Hello" }))

        expect(prismaMock.announcement.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    audience: "CUSTOMER",
                    isMandatory: false,
                }),
            })
        )
    })

    it("creates announcement with DISTRIBUTOR audience and isMandatory when specified", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        prismaMock.announcement.create.mockResolvedValue(
            makeAnnouncement({ audience: "DISTRIBUTOR", isMandatory: true })
        )

        await POST(
            createRequest("http://localhost/api/announcements", {
                title: "Mandatory Notice",
                audience: "DISTRIBUTOR",
                isMandatory: true,
            })
        )

        expect(prismaMock.announcement.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    audience: "DISTRIBUTOR",
                    isMandatory: true,
                }),
            })
        )
    })

    it("returns 201 with created announcement", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        prismaMock.announcement.create.mockResolvedValue(makeAnnouncement({ id: "ann_new" }))

        const res = await POST(createRequest("http://localhost/api/announcements", { title: "New" }))
        expect(res.status).toBe(201)
        const json = await res.json()
        expect(json.id).toBe("ann_new")
    })
})
