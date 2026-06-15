import { POST } from "@/app/api/admin/payouts/route"
import { getAdminSession } from "@/lib/auth-guard"
import { getFinanceSummary } from "@/lib/domains/finance"
import { prisma } from "@/lib/prisma"

jest.mock("@/lib/auth-guard", () => ({ getAdminSession: jest.fn() }))
jest.mock("@/lib/domains/finance", () => ({ getFinanceSummary: jest.fn() }))
jest.mock("@/lib/prisma", () => ({ prisma: { payout: { create: jest.fn() } } }))

const sess = getAdminSession as jest.Mock
const summary = getFinanceSummary as jest.Mock
const create = prisma.payout.create as jest.Mock

function req(body: unknown) {
    return new Request("http://t/api/admin/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    }) as unknown as import("next/server").NextRequest
}

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
