jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../../__mocks__/prisma")
  return { __esModule: true, prisma: prismaMock }
})

import type { Prisma } from "@prisma/client"
import { checkAndIssueMilestoneBonuses } from "@/lib/domains/distributors/milestone-service"
import { prismaMock } from "../../../__mocks__/prisma"
import {
  InvitationMilestoneNotFoundError,
  InvitationMilestoneHasBonusesError,
} from "@/lib/domains/distributors/types"
import {
  listInvitationMilestones,
  createInvitationMilestone,
  updateInvitationMilestone,
  deleteInvitationMilestone,
  listDistributorMilestoneBonuses,
} from "@/lib/domains/distributors/milestone-service"

beforeEach(() => jest.clearAllMocks())

// ── Helper ────────────────────────────────────────────────────────────────────

function makeTx(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    invitationMilestone: { findMany: jest.fn() },
    invitationMilestoneBonus: { findMany: jest.fn(), create: jest.fn() },
    order: { groupBy: jest.fn() },
    ...overrides,
  } as unknown as Prisma.TransactionClient
}

const BASE_MILESTONE = {
  id: "m1",
  thresholdAmount: 500,
  thresholdCount: 3,
  bonusAmount: 20,
  sortOrder: 0,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
}

const THREE_INVITEES = [{ id: "inv1" }, { id: "inv2" }, { id: "inv3" }]
// groupBy results where all 3 invitees individually meet thresholdAmount (500)
const ABOVE_THRESHOLD_GROUP_BY = [
  { distributorId: "inv1", _sum: { amount: 600 } },
  { distributorId: "inv2", _sum: { amount: 550 } },
  { distributorId: "inv3", _sum: { amount: 520 } },
]
// groupBy results where only 2 of 3 invitees meet threshold (qualifiedCount=2 < thresholdCount=3)
const BELOW_THRESHOLD_GROUP_BY = [
  { distributorId: "inv1", _sum: { amount: 600 } },
  { distributorId: "inv2", _sum: { amount: 550 } },
]

function setupFullMocks(tx: ReturnType<typeof makeTx>, groupByResult = ABOVE_THRESHOLD_GROUP_BY) {
  ;(tx.user.findUnique as jest.Mock)
    .mockResolvedValueOnce({ inviterId: "inviter1" })
    .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: null })
  ;(tx.invitationMilestone.findMany as jest.Mock).mockResolvedValue([BASE_MILESTONE])
  ;(tx.invitationMilestoneBonus.findMany as jest.Mock).mockResolvedValue([])
  ;(tx.user.findMany as jest.Mock).mockResolvedValue(THREE_INVITEES)
  ;(tx.order.groupBy as jest.Mock).mockResolvedValue(groupByResult)
}

// ── checkAndIssueMilestoneBonuses ─────────────────────────────────────────────

describe("checkAndIssueMilestoneBonuses", () => {
  it("skips when invitee has no inviter", async () => {
    const tx = makeTx()
    ;(tx.user.findUnique as jest.Mock).mockResolvedValue({ inviterId: null })
    await checkAndIssueMilestoneBonuses(tx, "invitee1")
    expect(tx.invitationMilestone.findMany).not.toHaveBeenCalled()
  })

  it("skips when inviter is not DISTRIBUTOR", async () => {
    const tx = makeTx()
    ;(tx.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ inviterId: "inviter1" })
      .mockResolvedValueOnce({ role: "ADMIN", disabledAt: null })
    await checkAndIssueMilestoneBonuses(tx, "invitee1")
    expect(tx.invitationMilestone.findMany).not.toHaveBeenCalled()
  })

  it("skips when inviter is disabled", async () => {
    const tx = makeTx()
    ;(tx.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ inviterId: "inviter1" })
      .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: new Date() })
    await checkAndIssueMilestoneBonuses(tx, "invitee1")
    expect(tx.invitationMilestone.findMany).not.toHaveBeenCalled()
  })

  it("skips when no milestones configured", async () => {
    const tx = makeTx()
    ;(tx.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ inviterId: "inviter1" })
      .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: null })
    ;(tx.invitationMilestone.findMany as jest.Mock).mockResolvedValue([])
    ;(tx.invitationMilestoneBonus.findMany as jest.Mock).mockResolvedValue([])
    await checkAndIssueMilestoneBonuses(tx, "invitee1")
    expect(tx.user.findMany).not.toHaveBeenCalled()
  })

  it("skips when all milestones already triggered for inviter", async () => {
    const tx = makeTx()
    ;(tx.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ inviterId: "inviter1" })
      .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: null })
    ;(tx.invitationMilestone.findMany as jest.Mock).mockResolvedValue([BASE_MILESTONE])
    ;(tx.invitationMilestoneBonus.findMany as jest.Mock).mockResolvedValue([
      { milestoneId: "m1" },
    ])
    await checkAndIssueMilestoneBonuses(tx, "invitee1")
    expect(tx.user.findMany).not.toHaveBeenCalled()
  })

  it("skips when inviter has no invitees", async () => {
    const tx = makeTx()
    ;(tx.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ inviterId: "inviter1" })
      .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: null })
    ;(tx.invitationMilestone.findMany as jest.Mock).mockResolvedValue([BASE_MILESTONE])
    ;(tx.invitationMilestoneBonus.findMany as jest.Mock).mockResolvedValue([])
    ;(tx.user.findMany as jest.Mock).mockResolvedValue([])
    await checkAndIssueMilestoneBonuses(tx, "invitee1")
    expect(tx.order.groupBy).not.toHaveBeenCalled()
  })

  it("does not trigger when qualifiedCount < thresholdCount", async () => {
    const tx = makeTx()
    setupFullMocks(tx, BELOW_THRESHOLD_GROUP_BY)
    await checkAndIssueMilestoneBonuses(tx, "invitee1")
    expect(tx.invitationMilestoneBonus.create).not.toHaveBeenCalled()
  })

  it("triggers bonus when qualifiedCount >= thresholdCount", async () => {
    const tx = makeTx()
    setupFullMocks(tx)
    ;(tx.invitationMilestoneBonus.create as jest.Mock).mockResolvedValue({})

    await checkAndIssueMilestoneBonuses(tx, "invitee1")

    expect(tx.invitationMilestoneBonus.create).toHaveBeenCalledWith({
      data: {
        inviterId: "inviter1",
        milestoneId: "m1",
        thresholdSnapshot: 500,
        countSnapshot: 3,
        amount: 20,
      },
    })
  })

  it("calls order.groupBy with correct where clause including paidAt >= milestone.createdAt", async () => {
    const tx = makeTx()
    ;(tx.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ inviterId: "inviter1" })
      .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: null })
    ;(tx.invitationMilestone.findMany as jest.Mock).mockResolvedValue([BASE_MILESTONE])
    ;(tx.invitationMilestoneBonus.findMany as jest.Mock).mockResolvedValue([])
    ;(tx.user.findMany as jest.Mock).mockResolvedValue([{ id: "inv1" }])
    ;(tx.order.groupBy as jest.Mock).mockResolvedValue([])

    await checkAndIssueMilestoneBonuses(tx, "invitee1")

    expect(tx.order.groupBy).toHaveBeenCalledWith({
      by: ["distributorId"],
      where: {
        distributorId: { in: ["inv1"] },
        status: "COMPLETED",
        paidAt: { gte: BASE_MILESTONE.createdAt },
      },
      _sum: { amount: true },
    })
  })

  it("ignores P2002 error (concurrent safety)", async () => {
    const tx = makeTx()
    setupFullMocks(tx, ABOVE_THRESHOLD_GROUP_BY)
    ;(tx.invitationMilestoneBonus.create as jest.Mock).mockRejectedValue({ code: "P2002" })

    await expect(checkAndIssueMilestoneBonuses(tx, "invitee1")).resolves.toBeUndefined()
  })

  it("rethrows non-P2002 errors", async () => {
    const tx = makeTx()
    setupFullMocks(tx, ABOVE_THRESHOLD_GROUP_BY)
    ;(tx.invitationMilestoneBonus.create as jest.Mock).mockRejectedValue(new Error("DB error"))

    await expect(checkAndIssueMilestoneBonuses(tx, "invitee1")).rejects.toThrow("DB error")
  })
})

// ── Milestone CRUD ────────────────────────────────────────────────────────────

describe("listInvitationMilestones", () => {
  it("returns serialized milestones including thresholdCount", async () => {
    prismaMock.invitationMilestone.findMany.mockResolvedValue([
      {
        id: "m1",
        thresholdAmount: "500.00",
        thresholdCount: 3,
        bonusAmount: "20.00",
        sortOrder: 0,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
    ] as never)
    const rows = await listInvitationMilestones()
    expect(rows).toHaveLength(1)
    expect(rows[0].thresholdAmount).toBe(500)
    expect(rows[0].thresholdCount).toBe(3)
    expect(rows[0].bonusAmount).toBe(20)
  })
})

describe("createInvitationMilestone", () => {
  it("creates a milestone with thresholdCount and returns serialized row", async () => {
    prismaMock.invitationMilestone.aggregate.mockResolvedValue({
      _max: { sortOrder: null },
    } as never)
    prismaMock.invitationMilestone.create.mockResolvedValue({
      id: "m1",
      thresholdAmount: "500.00",
      thresholdCount: 3,
      bonusAmount: "20.00",
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never)
    const row = await createInvitationMilestone({
      thresholdAmount: 500,
      thresholdCount: 3,
      bonusAmount: 20,
    })
    expect(row.thresholdAmount).toBe(500)
    expect(row.thresholdCount).toBe(3)
  })
})

describe("updateInvitationMilestone", () => {
  it("throws InvitationMilestoneNotFoundError when not found", async () => {
    prismaMock.invitationMilestone.findUnique.mockResolvedValue(null)
    await expect(
      updateInvitationMilestone("bad-id", { thresholdAmount: 100 }),
    ).rejects.toThrow(InvitationMilestoneNotFoundError)
  })

  it("updates milestone and returns serialized row", async () => {
    prismaMock.invitationMilestone.findUnique.mockResolvedValue({ id: "m1" } as never)
    prismaMock.invitationMilestone.update.mockResolvedValue({
      id: "m1",
      thresholdAmount: "1000.00",
      thresholdCount: 5,
      bonusAmount: "50.00",
      sortOrder: 0,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date(),
    } as never)
    const row = await updateInvitationMilestone("m1", { thresholdAmount: 1000 })
    expect(row.thresholdAmount).toBe(1000)
    expect(row.thresholdCount).toBe(5)
  })
})

describe("deleteInvitationMilestone", () => {
  it("throws InvitationMilestoneNotFoundError when not found", async () => {
    prismaMock.invitationMilestone.findUnique.mockResolvedValue(null)
    await expect(deleteInvitationMilestone("bad-id")).rejects.toThrow(
      InvitationMilestoneNotFoundError,
    )
  })

  it("throws InvitationMilestoneHasBonusesError when bonuses exist", async () => {
    prismaMock.invitationMilestone.findUnique.mockResolvedValue({ id: "m1" } as never)
    prismaMock.invitationMilestoneBonus.count.mockResolvedValue(1)
    await expect(deleteInvitationMilestone("m1")).rejects.toThrow(
      InvitationMilestoneHasBonusesError,
    )
  })

  it("deletes milestone when no bonuses exist", async () => {
    prismaMock.invitationMilestone.findUnique.mockResolvedValue({ id: "m1" } as never)
    prismaMock.invitationMilestoneBonus.count.mockResolvedValue(0)
    prismaMock.invitationMilestone.delete.mockResolvedValue({ id: "m1" } as never)
    await deleteInvitationMilestone("m1")
    expect(prismaMock.invitationMilestone.delete).toHaveBeenCalledWith({ where: { id: "m1" } })
  })
})

describe("listDistributorMilestoneBonuses", () => {
  it("returns paginated bonus records with countSnapshot (not inviteeName)", async () => {
    prismaMock.invitationMilestoneBonus.findMany.mockResolvedValue([
      {
        id: "b1",
        thresholdSnapshot: "500.00",
        countSnapshot: 3,
        amount: "20.00",
        createdAt: new Date("2026-02-01"),
      },
    ] as never)
    prismaMock.invitationMilestoneBonus.count.mockResolvedValue(1)

    const result = await listDistributorMilestoneBonuses("inviter1", 1, 20)

    expect(result.total).toBe(1)
    expect(result.data).toHaveLength(1)
    expect(result.data[0].countSnapshot).toBe(3)
    expect(result.data[0].thresholdSnapshot).toBe(500)
    expect(result.data[0].amount).toBe(20)
    // Old field should not exist
    expect((result.data[0] as Record<string, unknown>).inviteeName).toBeUndefined()
    expect((result.data[0] as Record<string, unknown>).inviteeId).toBeUndefined()
  })
})
