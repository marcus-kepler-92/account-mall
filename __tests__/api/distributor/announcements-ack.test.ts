import { type NextRequest } from "next/server"
import { POST } from "@/app/api/distributor/announcements/[id]/ack/route"
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

function createContext(id: string) {
    return { params: Promise.resolve({ id }) }
}

const request = {} as NextRequest

describe("POST /api/distributor/announcements/[id]/ack", () => {
    beforeEach(() => {
        getDistributorSession.mockReset()
    })

    it("returns 401 when not authenticated", async () => {
        getDistributorSession.mockResolvedValue(null)
        const res = await POST(request, createContext("ann_1"))
        expect(res.status).toBe(401)
    })

    it("returns 404 when announcement does not exist", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        prismaMock.announcement.findUnique.mockResolvedValue(null)

        const res = await POST(request, createContext("nonexistent"))
        expect(res.status).toBe(404)
        expect(prismaMock.announcementRead.upsert).not.toHaveBeenCalled()
    })

    it("returns 404 when announcement is DRAFT", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        prismaMock.announcement.findUnique.mockResolvedValue({
            id: "ann_1",
            status: "DRAFT",
            audience: "DISTRIBUTOR",
        } as any)

        const res = await POST(request, createContext("ann_1"))
        expect(res.status).toBe(404)
        expect(prismaMock.announcementRead.upsert).not.toHaveBeenCalled()
    })

    it("returns 404 when announcement audience is CUSTOMER", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        prismaMock.announcement.findUnique.mockResolvedValue({
            id: "ann_1",
            status: "PUBLISHED",
            audience: "CUSTOMER",
        } as any)

        const res = await POST(request, createContext("ann_1"))
        expect(res.status).toBe(404)
        expect(prismaMock.announcementRead.upsert).not.toHaveBeenCalled()
    })

    it("upserts read record and returns 200 for DISTRIBUTOR audience", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        prismaMock.announcement.findUnique.mockResolvedValue({
            id: "ann_1",
            status: "PUBLISHED",
            audience: "DISTRIBUTOR",
        } as any)
        const readAt = new Date("2026-01-01T12:00:00Z")
        prismaMock.announcementRead.upsert.mockResolvedValue({ readAt } as any)

        const res = await POST(request, createContext("ann_1"))
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.success).toBe(true)
        expect(json.readAt).toBeDefined()

        expect(prismaMock.announcementRead.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { userId_announcementId: { userId: "user_1", announcementId: "ann_1" } },
                create: { userId: "user_1", announcementId: "ann_1" },
                update: {},
            })
        )
    })

    it("upserts read record for ALL audience", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        prismaMock.announcement.findUnique.mockResolvedValue({
            id: "ann_2",
            status: "PUBLISHED",
            audience: "ALL",
        } as any)
        prismaMock.announcementRead.upsert.mockResolvedValue({ readAt: new Date() } as any)

        const res = await POST(request, createContext("ann_2"))
        expect(res.status).toBe(200)
        expect(prismaMock.announcementRead.upsert).toHaveBeenCalled()
    })

    it("is idempotent — upsert uses update:{} to avoid overwriting readAt", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        prismaMock.announcement.findUnique.mockResolvedValue({
            id: "ann_1",
            status: "PUBLISHED",
            audience: "DISTRIBUTOR",
        } as any)
        prismaMock.announcementRead.upsert.mockResolvedValue({ readAt: new Date() } as any)

        await POST(request, createContext("ann_1"))

        expect(prismaMock.announcementRead.upsert).toHaveBeenCalledWith(
            expect.objectContaining({ update: {} })
        )
    })
})
