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
    user: { findUnique: jest.fn() },
    invitationMilestone: { findMany: jest.fn() },
    invitationMilestoneBonus: { findMany: jest.fn(), create: jest.fn() },
    order: { aggregate: jest.fn() },
    ...overrides,
  } as unknown as Prisma.TransactionClient
}

const BASE_MILESTONE = {
  id: "m1",
  thresholdAmount: 500,
  bonusAmount: 20,
  sortOrder: 0,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
}

// ── checkAndIssueMilestoneBonuses ─────────────────────────────────────────────

describe("checkAndIssueMilestoneBonuses", () => {
  it("skips when invitee has no inviter", async () => {
    const tx = makeTx()
    ;(tx.user.findUnique as jest.Mock).mockResolvedValue({ inviterId: null })
    await checkAndIssueMilestoneBonuses(tx, "invitee1")
    expect(tx.invitationMilestone.findMany).not.toHaveBeenCalled()
  })

  it("skips when inviter is ADMIN", async () => {
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
    await checkAndIssueMilestoneBonuses(tx, "invitee1")
    expect(tx.invitationMilestoneBonus.findMany).not.toHaveBeenCalled()
  })

  it("inserts bonus when cumulative sales cross threshold", async () => {
    const tx = makeTx()
    ;(tx.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ inviterId: "inviter1" })
      .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: null })
    ;(tx.invitationMilestone.findMany as jest.Mock).mockResolvedValue([BASE_MILESTONE])
    ;(tx.invitationMilestoneBonus.findMany as jest.Mock).mockResolvedValue([])
    ;(tx.order.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 600 } })
    ;(tx.invitationMilestoneBonus.create as jest.Mock).mockResolvedValue({})

    await checkAndIssueMilestoneBonuses(tx, "invitee1")

    expect(tx.invitationMilestoneBonus.create).toHaveBeenCalledWith({
      data: {
        inviterId: "inviter1",
        inviteeId: "invitee1",
        milestoneId: "m1",
        thresholdSnapshot: 500,
        amount: 20,
      },
    })
  })

  it("does not insert when cumulative sales below threshold", async () => {
    const tx = makeTx()
    ;(tx.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ inviterId: "inviter1" })
      .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: null })
    ;(tx.invitationMilestone.findMany as jest.Mock).mockResolvedValue([BASE_MILESTONE])
    ;(tx.invitationMilestoneBonus.findMany as jest.Mock).mockResolvedValue([])
    ;(tx.order.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 400 } })

    await checkAndIssueMilestoneBonuses(tx, "invitee1")

    expect(tx.invitationMilestoneBonus.create).not.toHaveBeenCalled()
  })

  it("inserts multiple bonuses when multiple milestones crossed", async () => {
    const m2 = { ...BASE_MILESTONE, id: "m2", thresholdAmount: 1000, bonusAmount: 50 }
    const tx = makeTx()
    ;(tx.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ inviterId: "inviter1" })
      .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: null })
    ;(tx.invitationMilestone.findMany as jest.Mock).mockResolvedValue([BASE_MILESTONE, m2])
    ;(tx.invitationMilestoneBonus.findMany as jest.Mock).mockResolvedValue([])
    ;(tx.order.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 1500 } })
    ;(tx.invitationMilestoneBonus.create as jest.Mock).mockResolvedValue({})

    await checkAndIssueMilestoneBonuses(tx, "invitee1")

    expect(tx.invitationMilestoneBonus.create).toHaveBeenCalledTimes(2)
  })

  it("skips already-triggered milestones (idempotent)", async () => {
    const tx = makeTx()
    ;(tx.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ inviterId: "inviter1" })
      .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: null })
    ;(tx.invitationMilestone.findMany as jest.Mock).mockResolvedValue([BASE_MILESTONE])
    ;(tx.invitationMilestoneBonus.findMany as jest.Mock).mockResolvedValue([
      { milestoneId: "m1" },
    ])

    await checkAndIssueMilestoneBonuses(tx, "invitee1")

    expect(tx.order.aggregate).not.toHaveBeenCalled()
    expect(tx.invitationMilestoneBonus.create).not.toHaveBeenCalled()
  })

  it("does not count orders before milestone.createdAt", async () => {
    const tx = makeTx()
    ;(tx.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ inviterId: "inviter1" })
      .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: null })
    ;(tx.invitationMilestone.findMany as jest.Mock).mockResolvedValue([BASE_MILESTONE])
    ;(tx.invitationMilestoneBonus.findMany as jest.Mock).mockResolvedValue([])
    ;(tx.order.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 0 } })

    await checkAndIssueMilestoneBonuses(tx, "invitee1")

    // Verify the aggregate was called with the paidAt >= createdAt filter
    expect(tx.order.aggregate).toHaveBeenCalledWith({
      where: {
        distributorId: "invitee1",
        status: "COMPLETED",
        paidAt: { gte: BASE_MILESTONE.createdAt },
      },
      _sum: { amount: true },
    })
    expect(tx.invitationMilestoneBonus.create).not.toHaveBeenCalled()
  })

  it("ignores P2002 unique constraint error (concurrent trigger safety)", async () => {
    const tx = makeTx()
    ;(tx.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ inviterId: "inviter1" })
      .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: null })
    ;(tx.invitationMilestone.findMany as jest.Mock).mockResolvedValue([BASE_MILESTONE])
    ;(tx.invitationMilestoneBonus.findMany as jest.Mock).mockResolvedValue([])
    ;(tx.order.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 600 } })
    ;(tx.invitationMilestoneBonus.create as jest.Mock).mockRejectedValue({ code: "P2002" })

    await expect(checkAndIssueMilestoneBonuses(tx, "invitee1")).resolves.toBeUndefined()
  })

  it("rethrows non-P2002 errors", async () => {
    const tx = makeTx()
    ;(tx.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ inviterId: "inviter1" })
      .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: null })
    ;(tx.invitationMilestone.findMany as jest.Mock).mockResolvedValue([BASE_MILESTONE])
    ;(tx.invitationMilestoneBonus.findMany as jest.Mock).mockResolvedValue([])
    ;(tx.order.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 600 } })
    ;(tx.invitationMilestoneBonus.create as jest.Mock).mockRejectedValue(new Error("DB error"))

    await expect(checkAndIssueMilestoneBonuses(tx, "invitee1")).rejects.toThrow("DB error")
  })
})

// ── Milestone CRUD ────────────────────────────────────────────────────────────

describe("listInvitationMilestones", () => {
  it("returns serialized milestones ordered by thresholdAmount", async () => {
    prismaMock.invitationMilestone.findMany.mockResolvedValue([
      { id: "m1", thresholdAmount: "500.00", bonusAmount: "20.00", sortOrder: 0, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01") },
    ] as never)
    const rows = await listInvitationMilestones()
    expect(rows).toHaveLength(1)
    expect(rows[0].thresholdAmount).toBe(500)
    expect(rows[0].bonusAmount).toBe(20)
  })
})

describe("createInvitationMilestone", () => {
  it("creates a milestone and returns serialized row", async () => {
    prismaMock.invitationMilestone.aggregate.mockResolvedValue({ _max: { sortOrder: null } } as never)
    prismaMock.invitationMilestone.create.mockResolvedValue({
      id: "m1", thresholdAmount: "500.00", bonusAmount: "20.00", sortOrder: 0,
      createdAt: new Date(), updatedAt: new Date(),
    } as never)
    const row = await createInvitationMilestone({ thresholdAmount: 500, bonusAmount: 20 })
    expect(row.thresholdAmount).toBe(500)
  })
})

describe("deleteInvitationMilestone", () => {
  it("throws InvitationMilestoneNotFoundError when not found", async () => {
    prismaMock.invitationMilestone.findUnique.mockResolvedValue(null)
    await expect(deleteInvitationMilestone("bad-id")).rejects.toThrow(InvitationMilestoneNotFoundError)
  })

  it("throws InvitationMilestoneHasBonusesError when bonuses exist", async () => {
    prismaMock.invitationMilestone.findUnique.mockResolvedValue({ id: "m1" } as never)
    prismaMock.invitationMilestoneBonus.count.mockResolvedValue(1)
    await expect(deleteInvitationMilestone("m1")).rejects.toThrow(InvitationMilestoneHasBonusesError)
  })

  it("deletes milestone when no bonuses exist", async () => {
    prismaMock.invitationMilestone.findUnique.mockResolvedValue({ id: "m1" } as never)
    prismaMock.invitationMilestoneBonus.count.mockResolvedValue(0)
    prismaMock.invitationMilestone.delete.mockResolvedValue({ id: "m1" } as never)
    await deleteInvitationMilestone("m1")
    expect(prismaMock.invitationMilestone.delete).toHaveBeenCalledWith({ where: { id: "m1" } })
  })
})

describe("updateInvitationMilestone", () => {
  it("throws InvitationMilestoneNotFoundError when not found", async () => {
    prismaMock.invitationMilestone.findUnique.mockResolvedValue(null)
    await expect(
      updateInvitationMilestone("bad-id", { thresholdAmount: 100 })
    ).rejects.toThrow(InvitationMilestoneNotFoundError)
  })

  it("updates milestone and returns serialized row", async () => {
    prismaMock.invitationMilestone.findUnique.mockResolvedValue({ id: "m1" } as never)
    prismaMock.invitationMilestone.update.mockResolvedValue({
      id: "m1",
      thresholdAmount: "1000.00",
      bonusAmount: "50.00",
      sortOrder: 0,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date(),
    } as never)
    const row = await updateInvitationMilestone("m1", { thresholdAmount: 1000 })
    expect(row.thresholdAmount).toBe(1000)
  })
})

describe("listDistributorMilestoneBonuses", () => {
  it("returns paginated bonus records with invitee names", async () => {
    prismaMock.invitationMilestoneBonus.findMany.mockResolvedValue([
      {
        id: "b1",
        inviteeId: "inv1",
        invitee: { name: "Alice" },
        thresholdSnapshot: "500.00",
        amount: "20.00",
        createdAt: new Date("2026-02-01"),
      },
    ] as never)
    prismaMock.invitationMilestoneBonus.count.mockResolvedValue(1)

    const result = await listDistributorMilestoneBonuses("inviter1", 1, 20)

    expect(result.total).toBe(1)
    expect(result.data).toHaveLength(1)
    expect(result.data[0].inviteeName).toBe("Alice")
    expect(result.data[0].thresholdSnapshot).toBe(500)
    expect(result.data[0].amount).toBe(20)
  })
})
