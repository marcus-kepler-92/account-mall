// lib/domains/distributors/repository.ts
import { prisma } from "@/lib/prisma"
import type { PrismaClient } from "@prisma/client"

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

// ── CommissionTier ────────────────────────────────────────────────────────────

export async function findAllTiers(tx?: Tx) {
  return (tx ?? prisma).commissionTier.findMany({ orderBy: { sortOrder: "asc" } })
}

export async function findTierById(id: string, tx?: Tx) {
  return (tx ?? prisma).commissionTier.findUnique({ where: { id } })
}

export async function aggregateMaxTierSortOrder(tx?: Tx) {
  const r = await (tx ?? prisma).commissionTier.aggregate({ _max: { sortOrder: true } })
  return r._max.sortOrder
}

export async function createTierRecord(
  data: { minAmount: number; maxAmount: number; ratePercent: number; sortOrder: number },
  tx?: Tx,
) {
  return (tx ?? prisma).commissionTier.create({ data })
}

export async function updateTierRecord(
  id: string,
  data: { minAmount?: number; maxAmount?: number; ratePercent?: number; sortOrder?: number },
  tx?: Tx,
) {
  return (tx ?? prisma).commissionTier.update({ where: { id }, data })
}

export async function deleteTierRecord(id: string, tx?: Tx) {
  return (tx ?? prisma).commissionTier.delete({ where: { id } })
}

// ── Distributor (User with role=DISTRIBUTOR) ──────────────────────────────────

export async function findAllDistributors(tx?: Tx) {
  return (tx ?? prisma).user.findMany({
    where: { role: "DISTRIBUTOR" },
    select: {
      id: true,
      email: true,
      name: true,
      distributorCode: true,
      discountCodeEnabled: true,
      discountPercent: true,
      disabledAt: true,
      createdAt: true,
      _count: { select: { ordersAsDistributor: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function findDistributorById(id: string, tx?: Tx) {
  return (tx ?? prisma).user.findFirst({ where: { id, role: "DISTRIBUTOR" } })
}

export async function updateDistributorData(
  id: string,
  data: { disabledAt?: Date | null; discountCodeEnabled?: boolean; discountPercent?: number | null },
  tx?: Tx,
) {
  return (tx ?? prisma).user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      distributorCode: true,
      discountCodeEnabled: true,
      discountPercent: true,
      disabledAt: true,
    },
  })
}

export async function countDistributorOrders(id: string, tx?: Tx) {
  return (tx ?? prisma).order.count({ where: { distributorId: id } })
}

export async function countDistributorCommissions(id: string, tx?: Tx) {
  return (tx ?? prisma).commission.count({ where: { distributorId: id } })
}

export async function countDistributorWithdrawals(id: string, tx?: Tx) {
  return (tx ?? prisma).withdrawal.count({ where: { distributorId: id } })
}

export async function countDistributorInvitees(id: string, tx?: Tx) {
  return (tx ?? prisma).user.count({ where: { inviterId: id } })
}

export async function deleteDistributorInvitations(inviterId: string, tx?: Tx) {
  return (tx ?? prisma).distributorInvitation.deleteMany({ where: { inviterId } })
}

export async function deleteDistributorRecord(id: string, tx?: Tx) {
  return (tx ?? prisma).user.delete({ where: { id } })
}

export async function findDistributorByCode(code: string, tx?: Tx) {
  return (tx ?? prisma).user.findFirst({
    where: { distributorCode: code, role: "DISTRIBUTOR", disabledAt: null },
    select: { id: true },
  })
}

export async function updateDistributorInviterId(userId: string, inviterId: string, tx?: Tx) {
  return (tx ?? prisma).user.update({ where: { id: userId }, data: { inviterId } })
}

export async function ensureDistributorCode(userId: string, code: string, tx?: Tx) {
  return (tx ?? prisma).user.update({
    where: { id: userId },
    data: { distributorCode: code },
  })
}

// ── Commission aggregations ───────────────────────────────────────────────────

export async function aggregateCommissionSum(
  distributorId: string,
  status: "SETTLED" | "PENDING" | "WITHDRAWN",
  tx?: Tx,
) {
  const r = await (tx ?? prisma).commission.aggregate({
    where: { distributorId, status },
    _sum: { amount: true },
  })
  return Number(r._sum.amount ?? 0)
}

export async function aggregateWithdrawalSum(
  distributorId: string,
  status: "PAID" | "PENDING",
  tx?: Tx,
) {
  const r = await (tx ?? prisma).withdrawal.aggregate({
    where: { distributorId, status },
    _sum: { amount: true },
  })
  return Number(r._sum.amount ?? 0)
}

export async function findCommissions(
  distributorId: string,
  status: "PENDING" | "SETTLED" | "WITHDRAWN" | undefined,
  skip: number,
  take: number,
  tx?: Tx,
) {
  const where = { distributorId, ...(status ? { status } : {}) }
  return (tx ?? prisma).commission.findMany({
    where,
    include: { order: { select: { orderNo: true, amount: true, paidAt: true } } },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  })
}

export async function countCommissions(
  distributorId: string,
  status: "PENDING" | "SETTLED" | "WITHDRAWN" | undefined,
  tx?: Tx,
) {
  const where = { distributorId, ...(status ? { status } : {}) }
  return (tx ?? prisma).commission.count({ where })
}

export async function countWithdrawnCommissions(orderId: string, tx?: Tx) {
  return (tx ?? prisma).commission.count({ where: { orderId, status: "WITHDRAWN" } })
}

export async function findOrderCommissions(
  orderId: string,
  statuses: ("SETTLED" | "PENDING")[],
  tx?: Tx,
) {
  return (tx ?? prisma).commission.findMany({
    where: { orderId, status: { in: statuses } },
    select: { id: true, distributorId: true, amount: true },
  })
}

export async function cancelOrderCommissions(orderId: string, tx?: Tx) {
  return (tx ?? prisma).commission.updateMany({
    where: { orderId, status: { in: ["SETTLED", "PENDING"] } },
    data: { status: "CANCELLED" },
  })
}

export async function countPendingWithdrawalsByDistributor(distributorId: string, tx?: Tx) {
  return (tx ?? prisma).withdrawal.count({ where: { distributorId, status: "PENDING" } })
}

// ── Withdrawal ────────────────────────────────────────────────────────────────

export async function findWithdrawalById(id: string, tx?: Tx) {
  return (tx ?? prisma).withdrawal.findUnique({ where: { id } })
}

export async function findWithdrawalsByDistributor(
  distributorId: string,
  skip: number,
  take: number,
  tx?: Tx,
) {
  return (tx ?? prisma).withdrawal.findMany({
    where: { distributorId },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  })
}

export async function countWithdrawalsByDistributor(distributorId: string, tx?: Tx) {
  return (tx ?? prisma).withdrawal.count({ where: { distributorId } })
}

export async function findAllWithdrawals(status?: "PENDING" | "PAID" | "REJECTED", tx?: Tx) {
  return (tx ?? prisma).withdrawal.findMany({
    where: status ? { status } : {},
    include: { distributor: { select: { id: true, email: true, name: true } } },
    orderBy: { createdAt: "desc" },
  })
}

export async function countPendingWithdrawals(tx?: Tx) {
  return (tx ?? prisma).withdrawal.count({ where: { status: "PENDING" } })
}

export async function createWithdrawalRecord(
  data: {
    distributorId: string
    amount: number
    feePercent: number
    feeAmount: number
    receiptImageUrl: string
  },
  tx?: Tx,
) {
  return (tx ?? prisma).withdrawal.create({
    data: { ...data, status: "PENDING" },
  })
}

export async function updateWithdrawalRecord(
  id: string,
  data: { status: "PAID" | "REJECTED"; note?: string; processedAt: Date },
  tx?: Tx,
) {
  return (tx ?? prisma).withdrawal.update({
    where: { id },
    data,
    include: { distributor: { select: { id: true, email: true, name: true } } },
  })
}

// ── Invitations ───────────────────────────────────────────────────────────────

export async function findInvitationByToken(token: string, tx?: Tx) {
  return (tx ?? prisma).distributorInvitation.findUnique({
    where: { token },
    include: { inviter: { select: { role: true } } },
  })
}

export async function createInvitation(
  data: { email: string | null; token: string; inviterId: string; expiresAt: Date },
  tx?: Tx,
) {
  return (tx ?? prisma).distributorInvitation.create({ data })
}

export async function markInvitationAccepted(token: string, acceptedAt: Date, tx?: Tx) {
  return (tx ?? prisma).distributorInvitation.update({
    where: { token },
    data: { acceptedAt },
  })
}

export async function findUserByEmail(email: string, tx?: Tx) {
  return (tx ?? prisma).user.findUnique({ where: { email }, select: { id: true } })
}

export async function findUserByUsername(username: string, tx?: Tx) {
  return (tx ?? prisma).user.findUnique({ where: { username }, select: { id: true } })
}

export async function createDistributorUser(
  data: {
    email: string | null
    username: string | null
    name: string
    emailVerified: boolean
    role: "DISTRIBUTOR"
    distributorCode: string
    discountPercent: number
    inviterId: string | null
    createdAt: Date
    updatedAt: Date
  },
  tx?: Tx,
) {
  return (tx ?? prisma).user.create({ data })
}

export async function createAccountRecord(
  data: {
    userId: string
    accountId: string
    providerId: string
    password: string
    createdAt: Date
    updatedAt: Date
  },
  tx?: Tx,
) {
  return (tx ?? prisma).account.create({ data })
}

// ── Report / order queries ────────────────────────────────────────────────────

export async function countTotalDistributors(tx?: Tx) {
  return (tx ?? prisma).user.count({ where: { role: "DISTRIBUTOR" } })
}

export async function aggregateCommissionsByStatusAndPeriod(
  status: "PENDING" | "SETTLED",
  startUTC: Date,
  endUTC: Date,
  tx?: Tx,
) {
  const r = await (tx ?? prisma).commission.aggregate({
    where: { status, createdAt: { gte: startUTC, lt: endUTC } },
    _sum: { amount: true },
  })
  return Number(r._sum.amount ?? 0)
}

export async function findNewDistributors(startUTC: Date, endUTC: Date, tx?: Tx) {
  return (tx ?? prisma).user.findMany({
    where: { role: "DISTRIBUTOR", createdAt: { gte: startUTC, lt: endUTC } },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      inviter: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function groupOrdersByDistributor(startUTC: Date, endUTC: Date, tx?: Tx) {
  return (tx ?? prisma).order.groupBy({
    by: ["distributorId"],
    where: {
      status: "COMPLETED",
      distributorId: { not: null },
      paidAt: { gte: startUTC, lt: endUTC },
    },
    _sum: { amount: true },
    _count: { id: true },
  })
}

export async function findDistributorsByIds(ids: string[], tx?: Tx) {
  return (tx ?? prisma).user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
  })
}

export async function groupPendingCommissionsByDistributor(ids: string[], tx?: Tx) {
  return (tx ?? prisma).commission.groupBy({
    by: ["distributorId"],
    where: { distributorId: { in: ids }, status: "PENDING" },
    _sum: { amount: true },
  })
}

export async function findOrderById(orderId: string, tx?: Tx) {
  return (tx ?? prisma).order.findUnique({ where: { id: orderId } })
}

export async function findUserById(id: string, tx?: Tx) {
  return (tx ?? prisma).user.findUnique({ where: { id } })
}

export async function updateOrderDistributor(
  orderId: string,
  distributorId: string | null,
  tx?: Tx,
) {
  return (tx ?? prisma).order.update({ where: { id: orderId }, data: { distributorId } })
}

export async function findWeeklyCompletedOrders(
  distributorId: string,
  weekStart: Date,
  weekEnd: Date,
  tx?: Tx,
) {
  return (tx ?? prisma).order.findMany({
    where: { distributorId, status: "COMPLETED", paidAt: { gte: weekStart, lt: weekEnd } },
    select: { amount: true },
  })
}
