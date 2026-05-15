jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../../../__mocks__/prisma")
  return { __esModule: true, prisma: prismaMock }
})

import { prismaMock } from "../../../../__mocks__/prisma"
import {
  checkAndIssueMilestoneBonuses,
  checkAndIssueInvitationMilestoneBonuses,
} from "../milestone-service"

function setupActiveInviter() {
  prismaMock.user.findUnique
    .mockResolvedValueOnce({ inviterId: "inv_1" } as any)
    .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: null } as any)
}

function setupSalesMilestones(milestoneCreatedAt = new Date("2026-01-01")) {
  prismaMock.invitationMilestone.findMany.mockResolvedValue([
    {
      id: "m_sales_1",
      type: "SALES",
      thresholdAmount: 1000,
      bonusAmount: 50,
      createdAt: milestoneCreatedAt,
    },
  ] as any)
  prismaMock.invitationMilestoneBonus.findMany.mockResolvedValue([] as any)
  prismaMock.user.findMany.mockResolvedValue([{ id: "invitee_1" }] as any)
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

  it("queries only SALES milestones", async () => {
    setupActiveInviter()
    setupSalesMilestones()
    prismaMock.order.aggregate.mockResolvedValue({ _sum: { amount: 2000 } } as any)
    prismaMock.invitationMilestoneBonus.create.mockResolvedValue({} as any)

    await checkAndIssueMilestoneBonuses(prismaMock as any, "dist_1")

    expect(prismaMock.invitationMilestone.findMany).toHaveBeenCalledWith({
      where: { type: "SALES" },
      orderBy: { thresholdAmount: "asc" },
    })
  })

  it("does not create bonus when aggregate sum is below threshold", async () => {
    setupActiveInviter()
    setupSalesMilestones()
    prismaMock.order.aggregate.mockResolvedValue({ _sum: { amount: 999 } } as any)

    await checkAndIssueMilestoneBonuses(prismaMock as any, "dist_1")

    expect(prismaMock.invitationMilestoneBonus.create).not.toHaveBeenCalled()
  })

  it("passes paidAt >= milestone.createdAt to aggregate query and creates bonus", async () => {
    const milestoneCreatedAt = new Date("2026-01-01T00:00:00.000Z")
    setupActiveInviter()
    setupSalesMilestones(milestoneCreatedAt)
    prismaMock.order.aggregate.mockResolvedValue({ _sum: { amount: 2000 } } as any)
    prismaMock.invitationMilestoneBonus.create.mockResolvedValue({} as any)

    await checkAndIssueMilestoneBonuses(prismaMock as any, "dist_1")

    expect(prismaMock.order.aggregate).toHaveBeenCalledWith(
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
        milestoneId: "m_sales_1",
        thresholdSnapshot: 1000,
        countSnapshot: 1,
        amount: 50,
      }),
    })
  })

  it("skips milestones already triggered", async () => {
    setupActiveInviter()
    prismaMock.invitationMilestone.findMany.mockResolvedValue([
      { id: "m_sales_1", type: "SALES", thresholdAmount: 1000, bonusAmount: 50, createdAt: new Date("2026-01-01") },
    ] as any)
    prismaMock.invitationMilestoneBonus.findMany.mockResolvedValue([
      { milestoneId: "m_sales_1" },
    ] as any)
    prismaMock.user.findMany.mockResolvedValue([{ id: "invitee_1" }] as any)

    await checkAndIssueMilestoneBonuses(prismaMock as any, "dist_1")

    expect(prismaMock.order.aggregate).not.toHaveBeenCalled()
    expect(prismaMock.invitationMilestoneBonus.create).not.toHaveBeenCalled()
  })
})

describe("checkAndIssueInvitationMilestoneBonuses", () => {
  function setupInvitationMilestones() {
    prismaMock.invitationMilestone.findMany.mockResolvedValue([
      { id: "inv_m_1", type: "INVITATION", thresholdCount: 5, bonusAmount: 30, createdAt: new Date("2026-01-01") },
    ] as any)
    prismaMock.invitationMilestoneBonus.findMany.mockResolvedValue([] as any)
  }

  it("returns early when new user has no inviterId", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ inviterId: null } as any)

    await checkAndIssueInvitationMilestoneBonuses(prismaMock as any, "new_user_1")

    expect(prismaMock.invitationMilestone.findMany).not.toHaveBeenCalled()
  })

  it("returns early when inviter is disabled", async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ inviterId: "inv_1" } as any)
      .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: new Date("2025-01-01") } as any)

    await checkAndIssueInvitationMilestoneBonuses(prismaMock as any, "new_user_1")

    expect(prismaMock.invitationMilestone.findMany).not.toHaveBeenCalled()
  })

  it("queries only INVITATION milestones", async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ inviterId: "inv_1" } as any)
      .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: null } as any)
    setupInvitationMilestones()
    prismaMock.user.count.mockResolvedValue(5 as any)
    prismaMock.invitationMilestoneBonus.create.mockResolvedValue({} as any)

    await checkAndIssueInvitationMilestoneBonuses(prismaMock as any, "new_user_1")

    expect(prismaMock.invitationMilestone.findMany).toHaveBeenCalledWith({
      where: { type: "INVITATION" },
      orderBy: { thresholdCount: "asc" },
    })
  })

  it("creates bonus when inviteeCount meets threshold, sets thresholdSnapshot to 0", async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ inviterId: "inv_1" } as any)
      .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: null } as any)
    setupInvitationMilestones()
    prismaMock.user.count.mockResolvedValue(5 as any)
    prismaMock.invitationMilestoneBonus.create.mockResolvedValue({} as any)

    await checkAndIssueInvitationMilestoneBonuses(prismaMock as any, "new_user_1")

    expect(prismaMock.invitationMilestoneBonus.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        inviterId: "inv_1",
        milestoneId: "inv_m_1",
        thresholdSnapshot: 0,
        countSnapshot: 5,
        amount: 30,
      }),
    })
  })

  it("does not create bonus when inviteeCount is below threshold", async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ inviterId: "inv_1" } as any)
      .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: null } as any)
    setupInvitationMilestones()
    prismaMock.user.count.mockResolvedValue(4 as any)

    await checkAndIssueInvitationMilestoneBonuses(prismaMock as any, "new_user_1")

    expect(prismaMock.invitationMilestoneBonus.create).not.toHaveBeenCalled()
  })

  it("skips already-triggered INVITATION milestone", async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ inviterId: "inv_1" } as any)
      .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: null } as any)
    prismaMock.invitationMilestone.findMany.mockResolvedValue([
      { id: "inv_m_1", type: "INVITATION", thresholdCount: 5, bonusAmount: 30, createdAt: new Date("2026-01-01") },
    ] as any)
    prismaMock.invitationMilestoneBonus.findMany.mockResolvedValue([
      { milestoneId: "inv_m_1" },
    ] as any)
    prismaMock.user.count.mockResolvedValue(10 as any)

    await checkAndIssueInvitationMilestoneBonuses(prismaMock as any, "new_user_1")

    expect(prismaMock.invitationMilestoneBonus.create).not.toHaveBeenCalled()
  })
})
