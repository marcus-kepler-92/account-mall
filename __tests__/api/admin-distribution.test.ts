import { type NextRequest } from "next/server"
import { GET as TiersGet, POST as TiersPost } from "@/app/api/admin/commission-tiers/route"
import { PATCH as TierPatch, DELETE as TierDelete } from "@/app/api/admin/commission-tiers/[id]/route"
import { GET as DistributorsGet } from "@/app/api/admin/distributors/route"
import { PATCH as DistributorPatch } from "@/app/api/admin/distributors/[id]/route"
import { GET as WithdrawalsGet } from "@/app/api/admin/withdrawals/route"
import { PATCH as WithdrawalPatch } from "@/app/api/admin/withdrawals/[id]/route"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getAdminSession: jest.fn(),
}))

const getAdminSession = require("@/lib/auth-guard").getAdminSession as jest.Mock

function withSession() {
    getAdminSession.mockResolvedValue({ user: { id: "admin_1" } })
}

describe("GET /api/admin/commission-tiers", () => {
    beforeEach(() => getAdminSession.mockReset())

    it("returns 401 when no session", async () => {
        getAdminSession.mockResolvedValue(null)
        const res = await TiersGet()
        expect(res.status).toBe(401)
    })

    it("returns 200 with tiers array ordered by sortOrder", async () => {
        withSession()
        prismaMock.commissionTier.findMany.mockResolvedValue([
            {
                id: "t1",
                minAmount: 0,
                maxAmount: 1000,
                ratePercent: 5,
                sortOrder: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ])
        const res = await TiersGet()
        const data = await res.json()
        expect(res.status).toBe(200)
        expect(Array.isArray(data)).toBe(true)
        expect(data[0]).toMatchObject({
            id: "t1",
            minAmount: 0,
            maxAmount: 1000,
            ratePercent: 5,
            sortOrder: 0,
        })
        expect(prismaMock.commissionTier.findMany).toHaveBeenCalledWith({
            orderBy: { sortOrder: "asc" },
        })
    })
})

describe("POST /api/admin/commission-tiers", () => {
    beforeEach(() => getAdminSession.mockReset())

    it("returns 401 when no session", async () => {
        getAdminSession.mockResolvedValue(null)
        const req = { json: async () => ({ minAmount: 0, maxAmount: 1000, ratePercent: 5 }) } as unknown as NextRequest
        const res = await TiersPost(req)
        expect(res.status).toBe(401)
    })

    it("returns 400 when minAmount >= maxAmount", async () => {
        withSession()
        const req = { json: async () => ({ minAmount: 1000, maxAmount: 500, ratePercent: 5 }) } as unknown as NextRequest
        const res = await TiersPost(req)
        const data = await res.json()
        expect(res.status).toBe(400)
        expect(data.error).toMatch(/minAmount|maxAmount/)
    })

    it("returns 201 and creates tier with valid body", async () => {
        withSession()
        prismaMock.commissionTier.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } })
        prismaMock.commissionTier.create.mockResolvedValue({
            id: "t_new",
            minAmount: 0,
            maxAmount: 2000,
            ratePercent: 10,
            sortOrder: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
        })
        const req = { json: async () => ({ minAmount: 0, maxAmount: 2000, ratePercent: 10 }) } as unknown as NextRequest
        const res = await TiersPost(req)
        const data = await res.json()
        expect(res.status).toBe(201)
        expect(data).toMatchObject({
            id: "t_new",
            minAmount: 0,
            maxAmount: 2000,
            ratePercent: 10,
            sortOrder: 1,
        })
        expect(prismaMock.commissionTier.create).toHaveBeenCalled()
    })
})

describe("PATCH /api/admin/commission-tiers/[id]", () => {
    const context = { params: Promise.resolve({ id: "t1" }) }

    beforeEach(() => getAdminSession.mockReset())

    it("returns 401 when no session", async () => {
        getAdminSession.mockResolvedValue(null)
        const req = { json: async () => ({ ratePercent: 5 }) } as unknown as NextRequest
        const res = await TierPatch(req, context)
        expect(res.status).toBe(401)
    })

    it("returns 404 when tier does not exist", async () => {
        withSession()
        prismaMock.commissionTier.findUnique.mockResolvedValue(null)
        const req = { json: async () => ({ ratePercent: 5 }) } as unknown as NextRequest
        const res = await TierPatch(req, context)
        expect(res.status).toBe(404)
    })

    it("returns 400 when minAmount >= maxAmount in body", async () => {
        withSession()
        prismaMock.commissionTier.findUnique.mockResolvedValue({
            id: "t1",
            minAmount: 0,
            maxAmount: 1000,
            ratePercent: 3,
            sortOrder: 0,
        })
        const req = {
            json: async () => ({ minAmount: 500, maxAmount: 400 }),
        } as unknown as NextRequest
        const res = await TierPatch(req, context)
        const data = await res.json()
        expect(res.status).toBe(400)
        expect(data.error).toMatch(/minAmount|maxAmount/)
    })

    it("returns 200 and updates tier", async () => {
        withSession()
        prismaMock.commissionTier.findUnique.mockResolvedValue({
            id: "t1",
            minAmount: 0,
            maxAmount: 1000,
            ratePercent: 3,
            sortOrder: 0,
        })
        prismaMock.commissionTier.update.mockResolvedValue({
            id: "t1",
            minAmount: 0,
            maxAmount: 1000,
            ratePercent: 5,
            sortOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        })
        const req = { json: async () => ({ ratePercent: 5 }) } as unknown as NextRequest
        const res = await TierPatch(req, context)
        expect(res.status).toBe(200)
        expect(prismaMock.commissionTier.update).toHaveBeenCalledWith({
            where: { id: "t1" },
            data: expect.objectContaining({ ratePercent: 5 }),
        })
    })
})

describe("DELETE /api/admin/commission-tiers/[id]", () => {
    const context = { params: Promise.resolve({ id: "t1" }) }

    beforeEach(() => getAdminSession.mockReset())

    it("returns 401 when no session", async () => {
        getAdminSession.mockResolvedValue(null)
        const res = await TierDelete({} as NextRequest, context)
        expect(res.status).toBe(401)
    })

    it("returns 404 when tier does not exist", async () => {
        withSession()
        prismaMock.commissionTier.findUnique.mockResolvedValue(null)
        const res = await TierDelete({} as NextRequest, context)
        expect(res.status).toBe(404)
    })

    it("returns 204 and deletes tier", async () => {
        withSession()
        prismaMock.commissionTier.findUnique.mockResolvedValue({ id: "t1" })
        prismaMock.commissionTier.delete.mockResolvedValue({} as never)
        const res = await TierDelete({} as NextRequest, context)
        expect(res.status).toBe(204)
        expect(prismaMock.commissionTier.delete).toHaveBeenCalledWith({ where: { id: "t1" } })
    })
})

describe("GET /api/admin/distributors", () => {
    beforeEach(() => getAdminSession.mockReset())

    it("returns 401 when no session", async () => {
        getAdminSession.mockResolvedValue(null)
        const res = await DistributorsGet()
        expect(res.status).toBe(401)
    })

    it("returns 200 with distributors and stats", async () => {
        withSession()
        prismaMock.user.findMany.mockResolvedValue([
            {
                id: "dist_1",
                email: "d@x.com",
                name: "D",
                distributorCode: "PROMO1",
                disabledAt: null,
                createdAt: new Date(),
                _count: { ordersAsDistributor: 5 },
            },
        ])
        prismaMock.order.count.mockResolvedValue(3)
        prismaMock.commission.aggregate
            .mockResolvedValueOnce({ _sum: { amount: 100 } })
            .mockResolvedValueOnce({ _sum: { amount: 80 } })
        prismaMock.withdrawal.aggregate.mockResolvedValue({ _sum: { amount: 20 } })

        const res = await DistributorsGet()
        const data = await res.json()
        expect(res.status).toBe(200)
        expect(Array.isArray(data)).toBe(true)
        expect(data[0]).toMatchObject({
            id: "dist_1",
            email: "d@x.com",
            distributorCode: "PROMO1",
            orderCount: 5,
            completedOrderCount: 3,
            totalCommission: 100,
            withdrawableBalance: 60,
        })
        expect(prismaMock.user.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { role: "DISTRIBUTOR" },
            })
        )
    })
})

describe("PATCH /api/admin/distributors/[id]", () => {
    const context = { params: Promise.resolve({ id: "dist_1" }) }

    beforeEach(() => getAdminSession.mockReset())

    it("returns 401 when no session", async () => {
        getAdminSession.mockResolvedValue(null)
        const req = { json: async () => ({ disabled: true }) } as unknown as NextRequest
        const res = await DistributorPatch(req, context)
        expect(res.status).toBe(401)
    })

    it("returns 404 when user is not distributor or does not exist", async () => {
        withSession()
        prismaMock.user.findFirst.mockResolvedValue(null)
        const req = { json: async () => ({ disabled: true }) } as unknown as NextRequest
        const res = await DistributorPatch(req, context)
        expect(res.status).toBe(404)
    })

    it("returns 200 and sets disabledAt when disabled: true", async () => {
        withSession()
        prismaMock.user.findFirst.mockResolvedValue({ id: "dist_1", role: "DISTRIBUTOR" })
        prismaMock.user.update.mockResolvedValue({
            id: "dist_1",
            email: "d@x.com",
            name: "D",
            distributorCode: "PROMO1",
            disabledAt: new Date(),
        })
        const req = { json: async () => ({ disabled: true }) } as unknown as NextRequest
        const res = await DistributorPatch(req, context)
        const data = await res.json()
        expect(res.status).toBe(200)
        expect(data.disabledAt).toBeDefined()
        expect(prismaMock.user.update).toHaveBeenCalledWith({
            where: { id: "dist_1" },
            data: expect.objectContaining({ disabledAt: expect.any(Date) }),
            select: expect.any(Object),
        })
    })

    it("returns 200 and clears disabledAt when disabled: false", async () => {
        withSession()
        prismaMock.user.findFirst.mockResolvedValue({ id: "dist_1", role: "DISTRIBUTOR" })
        prismaMock.user.update.mockResolvedValue({
            id: "dist_1",
            email: "d@x.com",
            distributorCode: "PROMO1",
            disabledAt: null,
        })
        const req = { json: async () => ({ disabled: false }) } as unknown as NextRequest
        const res = await DistributorPatch(req, context)
        expect(res.status).toBe(200)
        expect(prismaMock.user.update).toHaveBeenCalledWith({
            where: { id: "dist_1" },
            data: expect.objectContaining({ disabledAt: null }),
            select: expect.any(Object),
        })
    })
})

describe("GET /api/admin/withdrawals", () => {
    beforeEach(() => getAdminSession.mockReset())

    it("returns 401 when no session", async () => {
        getAdminSession.mockResolvedValue(null)
        const req = createRequest("http://localhost/api/admin/withdrawals")
        const res = await WithdrawalsGet(req)
        expect(res.status).toBe(401)
    })

    it("returns 200 with withdrawals and optional status filter", async () => {
        withSession()
        prismaMock.withdrawal.findMany.mockResolvedValue([
            {
                id: "w1",
                distributorId: "dist_1",
                amount: 50,
                status: "PENDING",
                note: null,
                processedAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                distributor: { id: "dist_1", email: "d@x.com", name: "D" },
            },
        ])
        const req = createRequest("http://localhost/api/admin/withdrawals?status=PENDING")
        const res = await WithdrawalsGet(req)
        const data = await res.json()
        expect(res.status).toBe(200)
        expect(Array.isArray(data)).toBe(true)
        expect(data[0]).toMatchObject({
            id: "w1",
            distributorId: "dist_1",
            amount: 50,
            status: "PENDING",
        })
        expect(prismaMock.withdrawal.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { status: "PENDING" },
            })
        )
    })
})

describe("PATCH /api/admin/withdrawals/[id]", () => {
    const context = { params: Promise.resolve({ id: "w1" }) }

    beforeEach(() => getAdminSession.mockReset())

    it("returns 401 when no session", async () => {
        getAdminSession.mockResolvedValue(null)
        const req = { json: async () => ({ status: "PAID" }) } as unknown as NextRequest
        const res = await WithdrawalPatch(req, context)
        expect(res.status).toBe(401)
    })

    it("returns 404 when withdrawal does not exist", async () => {
        withSession()
        prismaMock.withdrawal.findUnique.mockResolvedValue(null)
        const req = { json: async () => ({ status: "PAID" }) } as unknown as NextRequest
        const res = await WithdrawalPatch(req, context)
        expect(res.status).toBe(404)
    })

    it("returns 400 when withdrawal is not PENDING", async () => {
        withSession()
        prismaMock.withdrawal.findUnique.mockResolvedValue({
            id: "w1",
            status: "PAID",
            distributorId: "dist_1",
            amount: 50,
            note: null,
            processedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
        })
        const req = { json: async () => ({ status: "PAID" }) } as unknown as NextRequest
        const res = await WithdrawalPatch(req, context)
        const data = await res.json()
        expect(res.status).toBe(400)
        expect(data.error).toMatch(/PENDING/)
    })

    it("returns 200 and updates to PAID with note and processedAt", async () => {
        withSession()
        prismaMock.withdrawal.findUnique.mockResolvedValue({
            id: "w1",
            status: "PENDING",
            distributorId: "dist_1",
            amount: 50,
            note: null,
            processedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        })
        prismaMock.withdrawal.update.mockResolvedValue({
            id: "w1",
            distributorId: "dist_1",
            amount: 50,
            status: "PAID",
            note: "Done",
            processedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            distributor: { id: "dist_1", email: "d@x.com", name: "D" },
        })
        const req = { json: async () => ({ status: "PAID", note: "Done" }) } as unknown as NextRequest
        const res = await WithdrawalPatch(req, context)
        const data = await res.json()
        expect(res.status).toBe(200)
        expect(data).toMatchObject({
            id: "w1",
            status: "PAID",
            note: "Done",
        })
        expect(data.processedAt).toBeDefined()
        expect(prismaMock.withdrawal.update).toHaveBeenCalledWith({
            where: { id: "w1" },
            data: expect.objectContaining({
                status: "PAID",
                note: "Done",
                processedAt: expect.any(Date),
            }),
            include: expect.any(Object),
        })
    })
})

function createRequest(url = "http://localhost/api/admin/withdrawals"): NextRequest {
    return { url } as NextRequest
}
