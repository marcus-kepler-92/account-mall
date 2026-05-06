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
  bonusAmount: unknown
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}): MilestoneRow {
  return {
    id: m.id,
    thresholdAmount: Number(m.thresholdAmount),
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
    data: { thresholdAmount: data.thresholdAmount, bonusAmount: data.bonusAmount, sortOrder: nextSort },
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
      include: { invitee: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.invitationMilestoneBonus.count({ where: { inviterId } }),
  ])
  return {
    data: rows.map((r) => ({
      id: r.id,
      inviteeId: r.inviteeId,
      inviteeName: r.invitee.name,
      thresholdSnapshot: Number(r.thresholdSnapshot),
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

  const milestones = await tx.invitationMilestone.findMany({
    orderBy: { thresholdAmount: "asc" },
  })
  if (milestones.length === 0) return

  const triggered = await tx.invitationMilestoneBonus.findMany({
    where: { inviteeId },
    select: { milestoneId: true },
  })
  const triggeredSet = new Set(triggered.map((b) => b.milestoneId))
  const untriggered = milestones.filter((m) => !triggeredSet.has(m.id))
  if (untriggered.length === 0) return

  for (const milestone of untriggered) {
    const { _sum } = await tx.order.aggregate({
      where: {
        distributorId: inviteeId,
        status: "COMPLETED",
        paidAt: { gte: milestone.createdAt },
      },
      _sum: { amount: true },
    })
    const cumulative = Number(_sum.amount ?? 0)
    if (cumulative < Number(milestone.thresholdAmount)) continue

    try {
      await tx.invitationMilestoneBonus.create({
        data: {
          inviterId,
          inviteeId,
          milestoneId: milestone.id,
          thresholdSnapshot: milestone.thresholdAmount,
          amount: milestone.bonusAmount,
        },
      })
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") continue
      throw e
    }
  }
}
