import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { MilestoneRow, MilestoneBonusRow } from "./types"
import {
  InvitationMilestoneNotFoundError,
  InvitationMilestoneHasBonusesError,
} from "./types"
import type { CreateMilestoneInput, UpdateMilestoneInput } from "./validators"

function serializeMilestone(m: {
  id: string
  type: string
  thresholdAmount: unknown
  thresholdCount: number
  bonusAmount: unknown
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}): MilestoneRow {
  return {
    id: m.id,
    type: m.type as "INVITATION" | "SALES",
    thresholdAmount: Number(m.thresholdAmount),
    thresholdCount: m.thresholdCount,
    bonusAmount: Number(m.bonusAmount),
    sortOrder: m.sortOrder,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  }
}

export async function listInvitationMilestones(): Promise<MilestoneRow[]> {
  const rows = await prisma.invitationMilestone.findMany({
    orderBy: { thresholdAmount: "asc" },
  })
  return rows.map(serializeMilestone)
}

export async function createInvitationMilestone(
  data: CreateMilestoneInput,
): Promise<MilestoneRow> {
  const maxSort = await prisma.invitationMilestone.aggregate({ _max: { sortOrder: true } })
  const nextSort = (maxSort._max.sortOrder ?? -1) + 1
  const row = await prisma.invitationMilestone.create({
    data: { type: data.type, thresholdAmount: data.thresholdAmount, thresholdCount: data.thresholdCount, bonusAmount: data.bonusAmount, sortOrder: nextSort },
  })
  return serializeMilestone(row)
}

export async function updateInvitationMilestone(
  id: string,
  data: UpdateMilestoneInput,
): Promise<MilestoneRow> {
  const existing = await prisma.invitationMilestone.findUnique({ where: { id } })
  if (!existing) throw new InvitationMilestoneNotFoundError(id)
  const row = await prisma.invitationMilestone.update({
    where: { id },
    data: {
      ...(data.type !== undefined && { type: data.type }),
      ...(data.thresholdAmount !== undefined && { thresholdAmount: data.thresholdAmount }),
      ...(data.thresholdCount !== undefined && { thresholdCount: data.thresholdCount }),
      ...(data.bonusAmount !== undefined && { bonusAmount: data.bonusAmount }),
    },
  })
  return serializeMilestone(row)
}

export async function deleteInvitationMilestone(id: string): Promise<void> {
  const existing = await prisma.invitationMilestone.findUnique({ where: { id } })
  if (!existing) throw new InvitationMilestoneNotFoundError(id)
  const bonusCount = await prisma.invitationMilestoneBonus.count({ where: { milestoneId: id } })
  if (bonusCount > 0) throw new InvitationMilestoneHasBonusesError()
  await prisma.invitationMilestone.delete({ where: { id } })
}

export async function listDistributorMilestoneBonuses(
  inviterId: string,
  page: number,
  pageSize: number,
): Promise<{ data: MilestoneBonusRow[]; total: number }> {
  const skip = (page - 1) * pageSize
  const [rows, total] = await Promise.all([
    prisma.invitationMilestoneBonus.findMany({
      where: { inviterId },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.invitationMilestoneBonus.count({ where: { inviterId } }),
  ])
  return {
    data: rows.map((r) => ({
      id: r.id,
      thresholdSnapshot: Number(r.thresholdSnapshot),
      countSnapshot: r.countSnapshot,
      amount: Number(r.amount),
      createdAt: r.createdAt,
    })),
    total,
  }
}

/** Called at order completion — checks SALES milestones for the invitee's inviter */
export async function checkAndIssueMilestoneBonuses(
  tx: Prisma.TransactionClient,
  distributorId: string,
): Promise<void> {
  const invitee = await tx.user.findUnique({
    where: { id: distributorId },
    select: { inviterId: true },
  })
  if (!invitee?.inviterId) return
  const inviterId = invitee.inviterId

  const inviter = await tx.user.findUnique({
    where: { id: inviterId },
    select: { role: true, disabledAt: true },
  })
  if (!inviter || inviter.role !== "DISTRIBUTOR" || inviter.disabledAt !== null) return

  const [milestones, triggered] = await Promise.all([
    tx.invitationMilestone.findMany({
      where: { type: "SALES" },
      orderBy: { thresholdAmount: "asc" },
    }),
    tx.invitationMilestoneBonus.findMany({
      where: { inviterId },
      select: { milestoneId: true },
    }),
  ])
  if (milestones.length === 0) return
  const triggeredSet = new Set(triggered.map((b) => b.milestoneId))
  const untriggered = milestones.filter((m) => !triggeredSet.has(m.id))
  if (untriggered.length === 0) return

  const invitees = await tx.user.findMany({
    where: { inviterId, role: "DISTRIBUTOR", disabledAt: null },
    select: { id: true },
  })
  const inviteeIds = invitees.map((u) => u.id)
  if (inviteeIds.length === 0) return

  for (const milestone of untriggered) {
    const result = await tx.order.aggregate({
      where: {
        distributorId: { in: inviteeIds },
        status: "COMPLETED",
        paidAt: { gte: milestone.createdAt },
      },
      _sum: { amount: true },
    })
    if (Number(result._sum.amount ?? 0) < Number(milestone.thresholdAmount)) continue

    try {
      await tx.invitationMilestoneBonus.create({
        data: {
          inviterId,
          milestoneId: milestone.id,
          thresholdSnapshot: milestone.thresholdAmount,
          countSnapshot: inviteeIds.length,
          amount: milestone.bonusAmount,
        },
      })
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") continue
      throw e
    }
  }
}

/** Called at distributor registration — checks INVITATION milestones for the new user's inviter */
export async function checkAndIssueInvitationMilestoneBonuses(
  tx: Prisma.TransactionClient,
  newUserId: string,
): Promise<void> {
  const newUser = await tx.user.findUnique({
    where: { id: newUserId },
    select: { inviterId: true },
  })
  if (!newUser?.inviterId) return
  const inviterId = newUser.inviterId

  const inviter = await tx.user.findUnique({
    where: { id: inviterId },
    select: { role: true, disabledAt: true },
  })
  if (!inviter || inviter.role !== "DISTRIBUTOR" || inviter.disabledAt !== null) return

  const [milestones, triggered] = await Promise.all([
    tx.invitationMilestone.findMany({
      where: { type: "INVITATION" },
      orderBy: { thresholdCount: "asc" },
    }),
    tx.invitationMilestoneBonus.findMany({
      where: { inviterId },
      select: { milestoneId: true },
    }),
  ])
  if (milestones.length === 0) return
  const triggeredSet = new Set(triggered.map((b) => b.milestoneId))
  const untriggered = milestones.filter((m) => !triggeredSet.has(m.id))
  if (untriggered.length === 0) return

  const inviteeCount = await tx.user.count({
    where: { inviterId, role: "DISTRIBUTOR", disabledAt: null },
  })

  for (const milestone of untriggered) {
    if (inviteeCount < milestone.thresholdCount) continue
    try {
      await tx.invitationMilestoneBonus.create({
        data: {
          inviterId,
          milestoneId: milestone.id,
          thresholdSnapshot: 0,
          countSnapshot: inviteeCount,
          amount: milestone.bonusAmount,
        },
      })
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") continue
      throw e
    }
  }
}
