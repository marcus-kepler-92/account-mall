import { POST } from "@/app/api/admin/payouts/route"
import { PATCH, DELETE } from "@/app/api/admin/payouts/[id]/route"
import { getAdminSession } from "@/lib/auth-guard"
import { getFinanceSummary } from "@/lib/domains/finance"
import { prisma } from "@/lib/prisma"

jest.mock("@/lib/auth-guard", () => ({ getAdminSession: jest.fn() }))
jest.mock("@/lib/domains/finance", () => ({ getFinanceSummary: jest.fn() }))
jest.mock("@/lib/prisma", () => ({
    prisma: {
        payout: {
            create: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
    },
}))

const sess = getAdminSession as jest.Mock
const summary = getFinanceSummary as jest.Mock
const create = prisma.payout.create as jest.Mock
const findUnique = prisma.payout.findUnique as jest.Mock
const update = prisma.payout.update as jest.Mock
const del = prisma.payout.delete as jest.Mock

function req(body: unknown) {
    return new Request("http://t/api/admin/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    }) as unknown as import("next/server").NextRequest
}

function patchReq(body: unknown) {
    return new Request("http://t/api/admin/payouts/p1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    }) as unknown as import("next/server").NextRequest
}

function deleteReq() {
    return new Request("http://t/api/admin/payouts/p1", {
        method: "DELETE",
    }) as unknown as import("next/server").NextRequest
}

const ctx = () => ({ params: Promise.resolve({ id: "p1" }) })

describe("POST /api/admin/payouts", () => {
    beforeEach(() => jest.clearAllMocks())

    it("401 when not admin", async () => {
        sess.mockResolvedValue(null)
        const res = await POST(req({ amount: 10 }))
        expect(res.status).toBe(401)
    })

    it("400 when amount exceeds balance", async () => {
        sess.mockResolvedValue({ user: { id: "a" } })
        summary.mockResolvedValue({ balanceCents: 500 })
        const res = await POST(req({ amount: 10 }))
        expect(res.status).toBe(400)
    })

    it("201 on success", async () => {
        sess.mockResolvedValue({ user: { id: "a" } })
        summary.mockResolvedValue({ balanceCents: 5000 })
        create.mockResolvedValue({ id: "p1", amount: 10, note: null })
        const res = await POST(req({ amount: 10, note: "招行" }))
        expect(res.status).toBe(201)
        expect(create).toHaveBeenCalledWith({ data: { amount: 10, note: "招行" } })
    })
})

describe("PATCH /api/admin/payouts/[id]", () => {
    beforeEach(() => jest.clearAllMocks())

    it("401 when not admin", async () => {
        sess.mockResolvedValue(null)
        const res = await PATCH(patchReq({ amount: 10 }), ctx())
        expect(res.status).toBe(401)
    })

    it("404 when payout not found", async () => {
        sess.mockResolvedValue({ user: { id: "a" } })
        findUnique.mockResolvedValue(null)
        const res = await PATCH(patchReq({ amount: 10 }), ctx())
        expect(res.status).toBe(404)
    })

    it("400 when new amount makes balance negative", async () => {
        sess.mockResolvedValue({ user: { id: "a" } })
        findUnique.mockResolvedValue({ id: "p1", amount: 10, note: null })
        summary.mockResolvedValue({ balanceCents: 500 })
        const res = await PATCH(patchReq({ amount: 20 }), ctx())
        expect(res.status).toBe(400)
    })

    it("200 on success", async () => {
        sess.mockResolvedValue({ user: { id: "a" } })
        findUnique.mockResolvedValue({ id: "p1", amount: 10, note: null })
        summary.mockResolvedValue({ balanceCents: 500 })
        update.mockResolvedValue({ id: "p1", amount: 13, note: null })
        const res = await PATCH(patchReq({ amount: 13 }), ctx())
        expect(res.status).toBe(200)
        expect(update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { amount: 13 } })
    })
})

describe("DELETE /api/admin/payouts/[id]", () => {
    beforeEach(() => jest.clearAllMocks())

    it("401 when not admin", async () => {
        sess.mockResolvedValue(null)
        const res = await DELETE(deleteReq(), ctx())
        expect(res.status).toBe(401)
    })

    it("404 when payout not found", async () => {
        sess.mockResolvedValue({ user: { id: "a" } })
        findUnique.mockResolvedValue(null)
        const res = await DELETE(deleteReq(), ctx())
        expect(res.status).toBe(404)
    })

    it("200 on success", async () => {
        sess.mockResolvedValue({ user: { id: "a" } })
        findUnique.mockResolvedValue({ id: "p1", amount: 10, note: null })
        del.mockResolvedValue({ id: "p1" })
        const res = await DELETE(deleteReq(), ctx())
        expect(res.status).toBe(200)
        expect(del).toHaveBeenCalledWith({ where: { id: "p1" } })
    })
})
