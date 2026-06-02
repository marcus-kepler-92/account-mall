/**
 * End-to-end integration: refund route -> REAL revokeMilestoneBonusesForInviter.
 *
 * Unlike refund.test.ts (which mocks the reversal helpers to test wiring), this test keeps
 * `revokeMilestoneBonusesForInviter` REAL and only stubs `cancelOrderCommissions`. The prisma
 * mock is STATEFUL: `order.groupBy` returns the inviter's qualifying invitee sales *as if* the
 * refunded order is excluded only AFTER `order.updateMany` has flipped it to REFUNDED. This
 * proves the causal chain that code-reading alone asserts:
 *
 *   updateMany(status -> REFUNDED)  →  groupBy(status:COMPLETED) no longer counts the order
 *   →  qualifiedCount drops below threshold  →  the issued milestone bonus is deleted.
 *
 * If the route ever revoked BEFORE flipping the status (wrong order), groupBy would still count
 * the order, qualifiedCount would stay at threshold, and the bonus would NOT be deleted — so
 * this test would fail. That is the regression it guards.
 */
import { type NextRequest } from "next/server"
import { POST } from "@/app/api/admin/orders/[orderId]/refund/route"
import { prismaMock } from "../../../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getAdminSession: jest.fn(),
}))

jest.mock("@/lib/yipay", () => ({
    __esModule: true,
    isYipayConfigured: jest.fn().mockReturnValue(true),
    refundYipayOrder: jest.fn().mockResolvedValue({ ok: true }),
}))

// Keep revokeMilestoneBonusesForInviter REAL; only stub cancelOrderCommissions so it needs no
// separate prisma wiring.
jest.mock("@/lib/domains/distributors", () => {
    const actual = jest.requireActual("@/lib/domains/distributors")
    return {
        __esModule: true,
        ...actual,
        cancelOrderCommissions: jest.fn().mockResolvedValue({ count: 0 }),
    }
})

import { getAdminSession } from "@/lib/auth-guard"

const ORDER_ID = "crefundmsorder0000000001"
const ORDER_NO = "FAK-REFUND-MS-1"
const DISTRIBUTOR_ID = "d1" // the refunded order's distributor — an invitee of INVITER_ID
const INVITER_ID = "inv_1"
const MILESTONE_CREATED_AT = new Date("2026-01-01T00:00:00.000Z")

function makeRequest(): NextRequest {
    return {} as unknown as NextRequest
}
function makeCtx() {
    return { params: Promise.resolve({ orderId: ORDER_ID }) }
}

/**
 * Wire a stateful prisma mock for one refund. `groupByAfterRefund` is the qualifying-sales rows
 * groupBy returns once the order has been flipped to REFUNDED (i.e. excluded).
 */
function setupRefundScenario(opts: {
    milestone: { id: string; thresholdCount: number; thresholdAmount: number }
    issuedBonusId: string
    inviteeIds: string[]
    groupByBeforeRefund: { distributorId: string; _sum: { amount: number } }[]
    groupByAfterRefund: { distributorId: string; _sum: { amount: number } }[]
}) {
    ;(getAdminSession as jest.Mock).mockResolvedValue({ user: { id: "admin_1", email: "a@b.com" } })

    ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValueOnce({
        id: ORDER_ID,
        orderNo: ORDER_NO,
        status: "COMPLETED",
        product: { productType: "NORMAL" },
        paymentChannel: { pid: "p", key: "k", submitUrl: "https://x/submit.php" },
        distributorId: DISTRIBUTOR_ID,
        amount: { toFixed: () => "99.00" },
    } as never)

    // $transaction executes the callback with prismaMock as tx.
    ;(prismaMock.$transaction as unknown as jest.Mock).mockImplementation(
        async (cb: (tx: typeof prismaMock) => Promise<unknown>) => cb(prismaMock),
    )

    // Stateful core: the order is "refunded" only after updateMany flips it. groupBy reflects
    // the status:COMPLETED filter by switching its result on that flag.
    let orderRefunded = false
    ;(prismaMock.order.updateMany as jest.Mock).mockImplementation(async () => {
        orderRefunded = true
        return { count: 1 }
    })
    ;(prismaMock.order.groupBy as jest.Mock).mockImplementation(async () =>
        orderRefunded ? opts.groupByAfterRefund : opts.groupByBeforeRefund,
    )

    // Route resolves the distributor's inviter.
    ;(prismaMock.user.findUnique as jest.Mock).mockResolvedValueOnce({ inviterId: INVITER_ID })

    // Real revoke queries: issued bonuses, their milestones, the inviter's invitees.
    ;(prismaMock.invitationMilestoneBonus.findMany as jest.Mock).mockResolvedValueOnce([
        { id: opts.issuedBonusId, milestoneId: opts.milestone.id },
    ])
    ;(prismaMock.invitationMilestone.findMany as jest.Mock).mockResolvedValueOnce([
        {
            id: opts.milestone.id,
            thresholdCount: opts.milestone.thresholdCount,
            thresholdAmount: opts.milestone.thresholdAmount,
            createdAt: MILESTONE_CREATED_AT,
        },
    ])
    ;(prismaMock.user.findMany as jest.Mock).mockResolvedValueOnce(
        opts.inviteeIds.map((id) => ({ id })),
    )
}

describe("refund route → real milestone revocation (end-to-end)", () => {
    beforeEach(() => {
        ;(getAdminSession as jest.Mock).mockReset()
        ;(prismaMock.order.findUnique as jest.Mock).mockReset()
        ;(prismaMock.order.updateMany as jest.Mock).mockReset()
        ;(prismaMock.order.groupBy as jest.Mock).mockReset()
        ;(prismaMock.user.findUnique as jest.Mock).mockReset()
        ;(prismaMock.user.findMany as jest.Mock).mockReset()
        ;(prismaMock.invitationMilestoneBonus.findMany as jest.Mock).mockReset()
        ;(prismaMock.invitationMilestone.findMany as jest.Mock).mockReset()
        ;(prismaMock.invitationMilestoneBonus.delete as jest.Mock).mockReset()
        ;(prismaMock.$transaction as unknown as jest.Mock).mockReset()
    })

    it("revokes the inviter's bonus when the refund drops a qualifying invitee below threshold", async () => {
        // Milestone needs 3 invitees each ≥ 1000. Before refund: d1,d2,d3 all qualify (bonus issued).
        // After refund of d1's order, d1's qualifying total drops out → only d2,d3 → 2 < 3.
        setupRefundScenario({
            milestone: { id: "m_1", thresholdCount: 3, thresholdAmount: 1000 },
            issuedBonusId: "bonus_1",
            inviteeIds: ["d1", "d2", "d3"],
            groupByBeforeRefund: [
                { distributorId: "d1", _sum: { amount: 1200 } },
                { distributorId: "d2", _sum: { amount: 1500 } },
                { distributorId: "d3", _sum: { amount: 1100 } },
            ],
            groupByAfterRefund: [
                { distributorId: "d2", _sum: { amount: 1500 } },
                { distributorId: "d3", _sum: { amount: 1100 } },
            ],
        })

        const res = await POST(makeRequest(), makeCtx())

        expect(res.status).toBe(200)
        // The REAL revoke recomputed on the post-refund groupBy and deleted the now-unqualified bonus.
        expect(prismaMock.invitationMilestoneBonus.delete).toHaveBeenCalledWith({
            where: { id: "bonus_1" },
        })
        // Proof of ordering: groupBy must have run AFTER updateMany flipped the order, else it
        // would have returned 3 qualified and kept the bonus.
        expect(prismaMock.order.updateMany).toHaveBeenCalled()
        expect(prismaMock.order.groupBy).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ status: "COMPLETED", paidAt: { gte: MILESTONE_CREATED_AT } }),
            }),
        )
    })

    it("keeps the bonus when the refund still leaves enough qualifying invitees", async () => {
        // After refund, d1 still has other qualifying sales → 3 invitees still ≥ 1000 → keep.
        setupRefundScenario({
            milestone: { id: "m_1", thresholdCount: 3, thresholdAmount: 1000 },
            issuedBonusId: "bonus_1",
            inviteeIds: ["d1", "d2", "d3"],
            groupByBeforeRefund: [
                { distributorId: "d1", _sum: { amount: 2200 } },
                { distributorId: "d2", _sum: { amount: 1500 } },
                { distributorId: "d3", _sum: { amount: 1100 } },
            ],
            groupByAfterRefund: [
                { distributorId: "d1", _sum: { amount: 1100 } }, // still ≥ 1000 after losing this order
                { distributorId: "d2", _sum: { amount: 1500 } },
                { distributorId: "d3", _sum: { amount: 1100 } },
            ],
        })

        const res = await POST(makeRequest(), makeCtx())

        expect(res.status).toBe(200)
        expect(prismaMock.invitationMilestoneBonus.delete).not.toHaveBeenCalled()
    })
})
