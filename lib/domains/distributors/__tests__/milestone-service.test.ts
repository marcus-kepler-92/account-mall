jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../../../__mocks__/prisma")
  return { __esModule: true, prisma: prismaMock }
})

import { prismaMock } from "../../../../__mocks__/prisma"
import { checkAndIssueMilestoneBonuses, revokeMilestoneBonusesForInviter } from "../milestone-service"

function setupActiveInviter() {
  prismaMock.user.findUnique
    .mockResolvedValueOnce({ inviterId: "inv_1" } as any)
    .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: null } as any)
}

function setupMilestones(milestoneCreatedAt = new Date("2026-01-01")) {
  prismaMock.invitationMilestone.findMany.mockResolvedValue([
    {
      id: "m_1",
      thresholdCount: 3,
      thresholdAmount: 1000,
      bonusAmount: 50,
      createdAt: milestoneCreatedAt,
    },
  ] as any)
  prismaMock.invitationMilestoneBonus.findMany.mockResolvedValue([] as any)
  prismaMock.user.findMany.mockResolvedValue([
    { id: "invitee_1" },
    { id: "invitee_2" },
    { id: "invitee_3" },
  ] as any)
}

describe("checkAndIssueMilestoneBonuses", () => {
  it("returns early when distributorId has no inviterId", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ inviterId: null } as any)

    await checkAndIssueMilestoneBonuses(prismaMock as any, "dist_1")

    expect(prismaMock.invitationMilestone.findMany).not.toHaveBeenCalled()
  })

  it("returns early when inviter is disabled", async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ inviterId: "inv_1" } as any)
      .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: new Date("2025-01-01") } as any)

    await checkAndIssueMilestoneBonuses(prismaMock as any, "dist_1")

    expect(prismaMock.invitationMilestone.findMany).not.toHaveBeenCalled()
  })

  it("queries milestones ordered by thresholdCount asc (no type filter)", async () => {
    setupActiveInviter()
    setupMilestones()
    prismaMock.order.groupBy.mockResolvedValue([
      { distributorId: "invitee_1", _sum: { amount: 2000 } },
      { distributorId: "invitee_2", _sum: { amount: 1500 } },
      { distributorId: "invitee_3", _sum: { amount: 1200 } },
    ] as any)
    prismaMock.invitationMilestoneBonus.create.mockResolvedValue({} as any)

    await checkAndIssueMilestoneBonuses(prismaMock as any, "dist_1")

    expect(prismaMock.invitationMilestone.findMany).toHaveBeenCalledWith({
      orderBy: { thresholdCount: "asc" },
    })
  })

  it("does not create bonus when qualifiedCount is below thresholdCount", async () => {
    setupActiveInviter()
    setupMilestones()
    // Only 2 invitees meet the 1000 threshold; thresholdCount requires 3
    prismaMock.order.groupBy.mockResolvedValue([
      { distributorId: "invitee_1", _sum: { amount: 2000 } },
      { distributorId: "invitee_2", _sum: { amount: 1500 } },
    ] as any)

    await checkAndIssueMilestoneBonuses(prismaMock as any, "dist_1")

    expect(prismaMock.invitationMilestoneBonus.create).not.toHaveBeenCalled()
  })

  it("passes paidAt >= milestone.createdAt to groupBy and creates bonus when threshold met", async () => {
    const milestoneCreatedAt = new Date("2026-01-01T00:00:00.000Z")
    setupActiveInviter()
    setupMilestones(milestoneCreatedAt)
    prismaMock.order.groupBy.mockResolvedValue([
      { distributorId: "invitee_1", _sum: { amount: 2000 } },
      { distributorId: "invitee_2", _sum: { amount: 1500 } },
      { distributorId: "invitee_3", _sum: { amount: 1200 } },
    ] as any)
    prismaMock.invitationMilestoneBonus.create.mockResolvedValue({} as any)

    await checkAndIssueMilestoneBonuses(prismaMock as any, "dist_1")

    expect(prismaMock.order.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          paidAt: { gte: milestoneCreatedAt },
        }),
        _sum: { amount: true },
      }),
    )
    expect(prismaMock.invitationMilestoneBonus.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        inviterId: "inv_1",
        milestoneId: "m_1",
        thresholdSnapshot: 1000,
        countSnapshot: 3,
        amount: 50,
      }),
    })
  })

  it("skips milestones already triggered", async () => {
    setupActiveInviter()
    prismaMock.invitationMilestone.findMany.mockResolvedValue([
      { id: "m_1", thresholdCount: 3, thresholdAmount: 1000, bonusAmount: 50, createdAt: new Date("2026-01-01") },
    ] as any)
    prismaMock.invitationMilestoneBonus.findMany.mockResolvedValue([
      { milestoneId: "m_1" },
    ] as any)
    prismaMock.user.findMany.mockResolvedValue([{ id: "invitee_1" }] as any)

    await checkAndIssueMilestoneBonuses(prismaMock as any, "dist_1")

    expect(prismaMock.order.groupBy).not.toHaveBeenCalled()
    expect(prismaMock.invitationMilestoneBonus.create).not.toHaveBeenCalled()
  })
})

describe("revokeMilestoneBonusesForInviter", () => {
  function setupIssuedMilestone(milestoneCreatedAt = new Date("2026-01-01")) {
    prismaMock.invitationMilestoneBonus.findMany.mockResolvedValue([
      { id: "b_1", milestoneId: "m_1" },
    ] as any)
    prismaMock.invitationMilestone.findMany.mockResolvedValue([
      { id: "m_1", thresholdCount: 3, thresholdAmount: 1000, createdAt: milestoneCreatedAt },
    ] as any)
    prismaMock.user.findMany.mockResolvedValue([
      { id: "invitee_1" },
      { id: "invitee_2" },
      { id: "invitee_3" },
    ] as any)
  }

  it("returns early when inviter has no issued bonuses", async () => {
    prismaMock.invitationMilestoneBonus.findMany.mockResolvedValue([] as any)

    await revokeMilestoneBonusesForInviter(prismaMock as any, "inv_1")

    expect(prismaMock.invitationMilestone.findMany).not.toHaveBeenCalled()
    expect(prismaMock.invitationMilestoneBonus.delete).not.toHaveBeenCalled()
  })

  it("revokes the bonus when qualified count drops below threshold after refund", async () => {
    setupIssuedMilestone()
    // Post-refund recompute: only 2 invitees still meet the 1000 threshold (need 3)
    prismaMock.order.groupBy.mockResolvedValue([
      { distributorId: "invitee_1", _sum: { amount: 2000 } },
      { distributorId: "invitee_2", _sum: { amount: 1500 } },
    ] as any)

    await revokeMilestoneBonusesForInviter(prismaMock as any, "inv_1")

    expect(prismaMock.invitationMilestoneBonus.delete).toHaveBeenCalledWith({
      where: { id: "b_1" },
    })
  })

  it("keeps the bonus when still qualified after refund", async () => {
    setupIssuedMilestone()
    prismaMock.order.groupBy.mockResolvedValue([
      { distributorId: "invitee_1", _sum: { amount: 2000 } },
      { distributorId: "invitee_2", _sum: { amount: 1500 } },
      { distributorId: "invitee_3", _sum: { amount: 1200 } },
    ] as any)

    await revokeMilestoneBonusesForInviter(prismaMock as any, "inv_1")

    expect(prismaMock.invitationMilestoneBonus.delete).not.toHaveBeenCalled()
  })

  it("excludes the refunded order via status:COMPLETED + paidAt filter in groupBy", async () => {
    const milestoneCreatedAt = new Date("2026-01-01T00:00:00.000Z")
    setupIssuedMilestone(milestoneCreatedAt)
    prismaMock.order.groupBy.mockResolvedValue([] as any)

    await revokeMilestoneBonusesForInviter(prismaMock as any, "inv_1")

    expect(prismaMock.order.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "COMPLETED",
          paidAt: { gte: milestoneCreatedAt },
        }),
        _sum: { amount: true },
      }),
    )
  })
})
