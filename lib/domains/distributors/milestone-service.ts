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
  thresholdAmount: unknown
  thresholdCount: number
  bonusAmount: unknown
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}): MilestoneRow {
  return {
    id: m.id,
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
    orderBy: { thresholdCount: "asc" },
  })
  return rows.map(serializeMilestone)
}

export async function createInvitationMilestone(
  data: CreateMilestoneInput,
): Promise<MilestoneRow> {
  const maxSort = await prisma.invitationMilestone.aggregate({ _max: { sortOrder: true } })
  const nextSort = (maxSort._max.sortOrder ?? -1) + 1
  const row = await prisma.invitationMilestone.create({
    data: { thresholdAmount: data.thresholdAmount, thresholdCount: data.thresholdCount, bonusAmount: data.bonusAmount, sortOrder: nextSort },
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

/**
 * Called at order completion.
 * Triggers bonus when N invitees have each individually spent >= thresholdAmount since milestone creation.
 */
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
    tx.invitationMilestone.findMany({ orderBy: { thresholdCount: "asc" } }),
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
    // Count invitees who have each individually spent >= thresholdAmount since milestone creation
    const salesByInvitee = await tx.order.groupBy({
      by: ["distributorId"],
      where: {
        distributorId: { in: inviteeIds },
        status: "COMPLETED",
        paidAt: { gte: milestone.createdAt },
      },
      _sum: { amount: true },
    })
    const qualifiedCount = salesByInvitee.filter(
      (g) => Number(g._sum.amount ?? 0) >= Number(milestone.thresholdAmount),
    ).length
    if (qualifiedCount < milestone.thresholdCount) continue

    try {
      await tx.invitationMilestoneBonus.create({
        data: {
          inviterId,
          milestoneId: milestone.id,
          thresholdSnapshot: milestone.thresholdAmount,
          countSnapshot: qualifiedCount,
          amount: milestone.bonusAmount,
        },
      })
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") continue
      throw e
    }
  }
}

/**
 * Called after an order refund reverses one of a downline's COMPLETED sales.
 * Recomputes every already-issued bonus for this inviter using the same qualification
 * rule as checkAndIssueMilestoneBonuses, and revokes (deletes) any bonus whose qualifying
 * invitee count has now dropped below the milestone threshold.
 *
 * Must run AFTER the refunded order has been flipped to REFUNDED in the same transaction,
 * so the COMPLETED-filtered groupBy below no longer counts it.
 */
export async function revokeMilestoneBonusesForInviter(
  tx: Prisma.TransactionClient,
  inviterId: string,
): Promise<void> {
  const issued = await tx.invitationMilestoneBonus.findMany({
    where: { inviterId },
    select: { id: true, milestoneId: true },
  })
  if (issued.length === 0) return

  const milestones = await tx.invitationMilestone.findMany({
    where: { id: { in: issued.map((b) => b.milestoneId) } },
  })
  const milestoneById = new Map(milestones.map((m) => [m.id, m]))

  const invitees = await tx.user.findMany({
    where: { inviterId, role: "DISTRIBUTOR", disabledAt: null },
    select: { id: true },
  })
  const inviteeIds = invitees.map((u) => u.id)

  for (const bonus of issued) {
    const milestone = milestoneById.get(bonus.milestoneId)
    if (!milestone) continue

    let qualifiedCount = 0
    if (inviteeIds.length > 0) {
      const salesByInvitee = await tx.order.groupBy({
        by: ["distributorId"],
        where: {
          distributorId: { in: inviteeIds },
          status: "COMPLETED",
          paidAt: { gte: milestone.createdAt },
        },
        _sum: { amount: true },
      })
      qualifiedCount = salesByInvitee.filter(
        (g) => Number(g._sum.amount ?? 0) >= Number(milestone.thresholdAmount),
      ).length
    }

    if (qualifiedCount < milestone.thresholdCount) {
      await tx.invitationMilestoneBonus.delete({ where: { id: bonus.id } })
    }
  }
}
