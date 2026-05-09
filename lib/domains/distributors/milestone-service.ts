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

export async function checkAndIssueMilestoneBonuses(
  tx: Prisma.TransactionClient,
  inviteeId: string,
): Promise<void> {
  const invitee = await tx.user.findUnique({
    where: { id: inviteeId },
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
    tx.invitationMilestone.findMany({ orderBy: { thresholdAmount: "asc" } }),
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

  const qualifiedCounts = await Promise.all(
    untriggered.map((milestone) =>
      tx.order.groupBy({
        by: ["distributorId"],
        where: {
          distributorId: { in: inviteeIds },
          status: "COMPLETED",
          paidAt: { gte: milestone.createdAt },
        },
        _sum: { amount: true },
        having: {
          amount: {
            _sum: { gte: milestone.thresholdAmount },
          },
        },
      })
    )
  )

  for (let i = 0; i < untriggered.length; i++) {
    const milestone = untriggered[i]
    const qualifiedCount = qualifiedCounts[i].length
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
