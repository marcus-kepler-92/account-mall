import { type NextRequest } from "next/server"
import { GET } from "@/app/api/distributor/announcements/route"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getDistributorSession: jest.fn(),
}))

const getDistributorSession = require("@/lib/auth-guard").getDistributorSession as jest.Mock

const distributorSession = { user: { id: "user_1" } }

function createRequest(query?: Record<string, string>): NextRequest {
    const params = query ? "?" + new URLSearchParams(query).toString() : ""
    return { url: `http://localhost/api/distributor/announcements${params}` } as unknown as NextRequest
}

function makeAnnouncement(overrides?: Record<string, unknown>) {
    return {
        id: "ann_1",
        title: "Test",
        content: null,
        publishedAt: new Date("2026-01-01"),
        isMandatory: false,
        reads: [],
        ...overrides,
    } as any
}

describe("GET /api/distributor/announcements", () => {
    beforeEach(() => {
        getDistributorSession.mockReset()
    })

    it("returns 401 when not authenticated", async () => {
        getDistributorSession.mockResolvedValue(null)
        const res = await GET(createRequest())
        expect(res.status).toBe(401)
        expect(prismaMock.announcement.findMany).not.toHaveBeenCalled()
    })

    it("queries PUBLISHED DISTRIBUTOR/ALL announcements", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        prismaMock.announcement.findMany.mockResolvedValue([
            makeAnnouncement({ id: "ann_1", title: "For distributors" }),
        ])

        const res = await GET(createRequest())
        expect(res.status).toBe(200)

        expect(prismaMock.announcement.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    status: "PUBLISHED",
                    audience: { in: ["DISTRIBUTOR", "ALL"] },
                }),
            })
        )
    })

    it("returns hasRead=false when reads is empty", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        prismaMock.announcement.findMany.mockResolvedValue([
            makeAnnouncement({ reads: [] }),
        ])

        const res = await GET(createRequest())
        const json = await res.json()
        expect(json.data[0].hasRead).toBe(false)
    })

    it("returns hasRead=true when user has a read record", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        prismaMock.announcement.findMany.mockResolvedValue([
            makeAnnouncement({ reads: [{ readAt: new Date() }] }),
        ])

        const res = await GET(createRequest())
        const json = await res.json()
        expect(json.data[0].hasRead).toBe(true)
    })

    it("filters to isMandatory=true when ?mandatory=true", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        prismaMock.announcement.findMany.mockResolvedValue([])

        await GET(createRequest({ mandatory: "true" }))

        expect(prismaMock.announcement.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ isMandatory: true }),
            })
        )
    })

    it("filters to unread when ?unread=true", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        prismaMock.announcement.findMany.mockResolvedValue([])

        await GET(createRequest({ unread: "true" }))

        expect(prismaMock.announcement.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    reads: { none: { userId: "user_1" } },
                }),
            })
        )
    })

    it("returns empty data array when no announcements", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        prismaMock.announcement.findMany.mockResolvedValue([])

        const res = await GET(createRequest())
        const json = await res.json()
        expect(json.data).toEqual([])
    })
})
