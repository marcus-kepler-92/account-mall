import { getFinanceSummary } from "@/lib/domains/finance"
import { prisma } from "@/lib/prisma"

jest.mock("@/lib/prisma", () => ({
    prisma: {
        order: { aggregate: jest.fn() },
        payout: { aggregate: jest.fn() },
    },
}))

const orderAgg = prisma.order.aggregate as jest.Mock
const payoutAgg = prisma.payout.aggregate as jest.Mock

describe("getFinanceSummary", () => {
    it("balance = total completed income - total payouts (in cents)", async () => {
        orderAgg.mockResolvedValue({ _sum: { amount: 100.5 } })
        payoutAgg.mockResolvedValue({ _sum: { amount: 30.25 } })
        const s = await getFinanceSummary()
        expect(s.totalIncomeCents).toBe(10050)
        expect(s.totalWithdrawnCents).toBe(3025)
        expect(s.balanceCents).toBe(7025)
    })

    it("treats null sums as zero", async () => {
        orderAgg.mockResolvedValue({ _sum: { amount: null } })
        payoutAgg.mockResolvedValue({ _sum: { amount: null } })
        const s = await getFinanceSummary()
        expect(s).toEqual({ totalIncomeCents: 0, totalWithdrawnCents: 0, balanceCents: 0 })
    })
})
