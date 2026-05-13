// lib/domains/distributors/service.ts
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getConfig } from "@/lib/config"
import { config } from "@/lib/config"
import { sendMail } from "@/lib/email"
import { render } from "@react-email/render"
import React from "react"
import { DistributorInvitation as DistributorInvitationEmail } from "@/app/emails/distributor-invitation"
import { hashPassword } from "better-auth/crypto"
import * as repo from "./repository"
import { checkAndIssueMilestoneBonuses } from "./milestone-service"
import type {
  TierRow,
  DistributorRow,
  CommissionRow,
  WithdrawalRow,
  AdminWithdrawalRow,
  DistributorTierSummary,
  TierSummaryItem,
  SendInviteResult,
  CreateOrderCommissionsParams,
} from "./types"
import {
  DistributorNotFoundError,
  DistributorNotDisabledError,
  DistributorHasAssociationsError,
  WithdrawalNotFoundError,
  WithdrawalNotPendingError,
  WithdrawalOverBalanceError,
  CommissionTierNotFoundError,
  TierRangeError,
  InviteTokenNotFoundError,
  InviteTokenExpiredError,
  UsernameConflictError,
  EmailAlreadyRegisteredError,
  InviterCodeInvalidError,
  SelfInviterError,
  CommissionWithdrawnError,
  PendingWithdrawalBlocksReassignError,
  CommissionAlreadyPaidOutError,
  UsernameRequiredError,
  InviteTokenConcurrentAcceptError,
  InviteTokenExhaustedError,
} from "./types"
import type { UpdateDistributorInput, CreateTierInput, UpdateTierInput, UpdateWithdrawalInput, AcceptInviteInput } from "./validators"

// ── Utilities ─────────────────────────────────────────────────────────────────

export function toNumber(value: unknown): number {
  if (typeof value === "number" && !Number.isNaN(value)) return value
  const d = value as { toNumber?: () => number }
  if (typeof d?.toNumber === "function") return d.toNumber()
  const n = Number(value)
  return Number.isNaN(n) ? 0 : n
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export function adjustRate(rawRate: number, level2Rate: number, hasInviter: boolean): number {
  return hasInviter ? Math.round(rawRate * (1 - level2Rate / 100) * 100) / 100 : rawRate
}

function serializeTier(t: { id: string; minAmount: unknown; maxAmount: unknown; ratePercent: unknown; sortOrder: number; createdAt: Date; updatedAt: Date }): TierRow {
  return {
    id: t.id,
    minAmount: toNumber(t.minAmount),
    maxAmount: toNumber(t.maxAmount),
    ratePercent: toNumber(t.ratePercent),
    sortOrder: t.sortOrder,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }
}

function serializeWithdrawal(w: {
  id: string; amount: unknown; feePercent: unknown; feeAmount: unknown; status: string
  receiptImageUrl: string | null; note: string | null; processedAt: Date | null; createdAt: Date
}): WithdrawalRow {
  const feeAmount = toNumber(w.feeAmount)
  return {
    id: w.id,
    amount: toNumber(w.amount),
    feePercent: toNumber(w.feePercent),
    feeAmount,
    actualAmount: Math.round((toNumber(w.amount) - feeAmount) * 100) / 100,
    status: w.status,
    receiptImageUrl: w.receiptImageUrl,
    note: w.note,
    processedAt: w.processedAt,
    createdAt: w.createdAt,
  }
}

// ── CommissionTier ────────────────────────────────────────────────────────────

export async function listCommissionTiers(): Promise<TierRow[]> {
  const tiers = await repo.findAllTiers()
  return tiers.map(serializeTier)
}

export async function createCommissionTier(data: CreateTierInput): Promise<TierRow> {
  if (data.minAmount >= data.maxAmount) throw new TierRangeError()
  const maxSort = await repo.aggregateMaxTierSortOrder()
  const nextSort = (maxSort ?? -1) + 1
  const tier = await repo.createTierRecord({
    minAmount: data.minAmount,
    maxAmount: data.maxAmount,
    ratePercent: data.ratePercent,
    sortOrder: data.sortOrder ?? nextSort,
  })
  return serializeTier(tier)
}

export async function updateCommissionTier(id: string, data: UpdateTierInput): Promise<TierRow> {
  const existing = await repo.findTierById(id)
  if (!existing) throw new CommissionTierNotFoundError(id)
  const mergedMin = data.minAmount ?? toNumber(existing.minAmount)
  const mergedMax = data.maxAmount ?? toNumber(existing.maxAmount)
  if (mergedMin >= mergedMax) throw new TierRangeError()
  const tier = await repo.updateTierRecord(id, data)
  return serializeTier(tier)
}

export async function deleteCommissionTier(id: string): Promise<void> {
  const existing = await repo.findTierById(id)
  if (!existing) throw new CommissionTierNotFoundError(id)
  await repo.deleteTierRecord(id)
}

// ── Distributor CRUD ──────────────────────────────────────────────────────────

export async function listDistributors(): Promise<DistributorRow[]> {
  const distributors = await repo.findAllDistributors()
  return Promise.all(
    distributors.map(async (d) => {
      const [completedOrderCount, settled, paid, pending, bonuses] = await Promise.all([
        prisma.order.count({ where: { distributorId: d.id, status: "COMPLETED" } }),
        repo.aggregateCommissionSum(d.id, "SETTLED"),
        repo.aggregateWithdrawalSum(d.id, "PAID"),
        repo.aggregateWithdrawalSum(d.id, "PENDING"),
        repo.aggregateMilestoneBonusSum(d.id),
      ])
      return {
        id: d.id,
        email: d.email,
        name: d.name,
        distributorCode: d.distributorCode,
        discountCodeEnabled: d.discountCodeEnabled,
        discountPercent: d.discountPercent != null ? toNumber(d.discountPercent) : null,
        disabledAt: d.disabledAt,
        createdAt: d.createdAt,
        orderCount: d._count.ordersAsDistributor,
        completedOrderCount,
        totalCommission: settled,
        withdrawableBalance: Math.round((settled + bonuses - paid - pending) * 100) / 100,
      }
    }),
  )
}

export async function updateDistributor(id: string, data: UpdateDistributorInput) {
  const existing = await repo.findDistributorById(id)
  if (!existing) throw new DistributorNotFoundError(id)
  const update: { disabledAt?: Date | null; discountCodeEnabled?: boolean; discountPercent?: number | null } = {}
  if (data.disabled === true) update.disabledAt = new Date()
  else if (data.disabled === false) update.disabledAt = null
  if (data.discountCodeEnabled !== undefined) update.discountCodeEnabled = data.discountCodeEnabled
  if (data.discountPercent !== undefined) update.discountPercent = data.discountPercent
  const user = await repo.updateDistributorData(id, update)
  return { ...user, discountPercent: user.discountPercent != null ? toNumber(user.discountPercent) : null }
}

export async function deleteDistributor(id: string): Promise<void> {
  const existing = await repo.findDistributorById(id)
  if (!existing) throw new DistributorNotFoundError(id)
  if (!existing.disabledAt) throw new DistributorNotDisabledError()
  const [orderCount, commissionCount, withdrawalCount, inviteeCount] = await Promise.all([
    repo.countDistributorOrders(id),
    repo.countDistributorCommissions(id),
    repo.countDistributorWithdrawals(id),
    repo.countDistributorInvitees(id),
  ])
  if (orderCount > 0) throw new DistributorHasAssociationsError("orders")
  if (commissionCount > 0) throw new DistributorHasAssociationsError("commissions")
  if (withdrawalCount > 0) throw new DistributorHasAssociationsError("withdrawals")
  if (inviteeCount > 0) throw new DistributorHasAssociationsError("invitees")
  await repo.deleteDistributorInvitations(id)
  await repo.deleteDistributorRecord(id)
}

// ── Invitations ───────────────────────────────────────────────────────────────

export async function sendInvite({
  email,
  inviterId,
  inviterName,
}: {
  email: string
  inviterId: string
  inviterName: string
}): Promise<SendInviteResult> {
  const existing = await repo.findUserByEmail(email)
  if (existing) return { success: false, reason: "already_registered" }
  const ttlDays = config.distributorInviteTtlDays
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)
  const token = crypto.randomUUID()
  await repo.createInvitation({ email, token, inviterId, expiresAt, maxUses: 1 })
  const acceptUrl = `${config.siteUrl}/distributor/accept-invite?token=${token}`
  if (config.nodeEnv === "development") {
    console.log(`\n[invite] → ${email}\n[invite] ${acceptUrl}\n`)
  }
  const html = await render(
    React.createElement(DistributorInvitationEmail, {
      inviterName,
      acceptUrl,
      brandName: config.siteName,
      expiresInDays: ttlDays,
    }),
  )
  const result = await sendMail({
    to: email,
    subject: `[${config.siteName}] 您收到一份分销员邀请`,
    html,
  })
  if (!result.success) {
    console.error("[distributors-domain] Email send failed", { email })
    return { success: false, reason: "send_failed" }
  }
  return { success: true }
}

export async function createNoEmailInviteLink({
  inviterId,
  maxUses,
}: {
  inviterId: string
  maxUses?: number
}): Promise<{ link: string }> {
  const max = config.inviteLinkMaxCount
  const safeMax = Math.max(1, Math.min(max, Math.floor(maxUses ?? config.inviteLinkDefaultCount)))
  const ttlDays = config.distributorInviteTtlDays
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)
  const token = crypto.randomUUID()
  await repo.createInvitation({ email: null, token, inviterId, expiresAt, maxUses: safeMax })
  return { link: `${config.siteUrl}/distributor/accept-invite?token=${token}` }
}

export async function acceptInvite(token: string, data: AcceptInviteInput & { username?: string }): Promise<void> {
  const invitation = await repo.findInvitationByToken(token)
  if (!invitation) throw new InviteTokenNotFoundError()
  if (invitation.expiresAt < new Date()) throw new InviteTokenExpiredError()
  if (invitation.usedCount >= invitation.maxUses) throw new InviteTokenExhaustedError()

  const isNoEmail = invitation.email === null

  if (isNoEmail) {
    if (!data.username) throw new UsernameRequiredError()
    const existingByUsername = await repo.findUserByUsername(data.username)
    if (existingByUsername) throw new UsernameConflictError()
  } else {
    const existingUser = await repo.findUserByEmail(invitation.email!)
    if (existingUser) throw new EmailAlreadyRegisteredError()
  }

  const hashedPassword = await hashPassword(data.password)
  const now = new Date()
  const newUserInviterId = invitation.inviter.role === "DISTRIBUTOR" ? invitation.inviterId : null
  const tempId = crypto.randomUUID()
  const distributorCode = `D${tempId.replace(/-/g, "").slice(-8).toUpperCase()}`

  await prisma.$transaction(async (tx) => {
    const claimed = await repo.claimInvitation(token, now, tx)
    if (claimed === 0) throw new InviteTokenConcurrentAcceptError()

    const user = await repo.createDistributorUser(
      {
        email: isNoEmail ? null : invitation.email,
        username: isNoEmail ? data.username! : null,
        name: data.name,
        emailVerified: true,
        role: "DISTRIBUTOR",
        distributorCode,
        discountPercent: config.basePromoDiscountPercent,
        inviterId: newUserInviterId,
        createdAt: now,
        updatedAt: now,
      },
      tx as Parameters<typeof repo.createDistributorUser>[1],
    )

    await repo.createAccountRecord(
      {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      },
      tx as Parameters<typeof repo.createAccountRecord>[1],
    )
  })
}

export async function bindInviter(userId: string, inviteCode: string): Promise<void> {
  const inviter = await repo.findDistributorByCode(inviteCode.trim())
  if (!inviter) throw new InviterCodeInvalidError()
  if (inviter.id === userId) throw new SelfInviterError()
  await repo.updateDistributorInviterId(userId, inviter.id)
}

// ── Distributor profile ───────────────────────────────────────────────────────

export async function getDistributorProfile(userId: string, currentDistributorCode: string | null | undefined) {
  let distributorCode = currentDistributorCode ?? null
  if (!distributorCode) {
    const code = `D${userId.slice(-8).toUpperCase()}`
    await repo.ensureDistributorCode(userId, code)
    distributorCode = code
  }

  const level2Rate = config.level2CommissionRatePercent
  const promoUrl = `${config.siteUrl}/?promoCode=${encodeURIComponent(distributorCode)}`

  const [settled, paid, pending, bonuses, tierSummary] = await Promise.all([
    repo.aggregateCommissionSum(userId, "SETTLED"),
    repo.aggregateWithdrawalSum(userId, "PAID"),
    repo.aggregateWithdrawalSum(userId, "PENDING"),
    repo.aggregateMilestoneBonusSum(userId),
    getDistributorTierSummary(userId, level2Rate),
  ])

  const withdrawableBalance = Math.round((settled + bonuses - paid - pending) * 100) / 100

  return {
    distributorCode,
    promoUrl,
    withdrawableBalance,
    weeklySalesTotal: tierSummary.weeklySalesTotal,
    currentTier: tierSummary.currentTier,
    tiersList: tierSummary.tiersList,
    nextTier: tierSummary.nextTier,
    encouragementMessage: tierSummary.encouragementMessage,
    hasInviter: tierSummary.hasInviter,
    level2Rate,
  }
}

export async function getDistributorTierSummary(
  distributorId: string,
  level2Rate: number,
): Promise<DistributorTierSummary> {
  const now = new Date()
  const weekStart = getWeekStart(now)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)

  const [weekOrders, tiers, selfUser] = await Promise.all([
    repo.findWeeklyCompletedOrders(distributorId, weekStart, weekEnd),
    repo.findAllTiers(),
    prisma.user.findUnique({ where: { id: distributorId }, select: { inviterId: true } }),
  ])

  const hasInviter = !!selfUser?.inviterId
  const weeklySalesTotal = weekOrders.reduce((sum, o) => sum + toNumber(o.amount), 0)
  const tiersList: TierSummaryItem[] = tiers.map((t) => ({
    minAmount: toNumber(t.minAmount),
    maxAmount: toNumber(t.maxAmount),
    ratePercent: toNumber(t.ratePercent),
    sortOrder: t.sortOrder,
  }))

  let currentTier: TierSummaryItem | null = null
  for (const t of tiers) {
    if (weeklySalesTotal >= toNumber(t.minAmount) && weeklySalesTotal < toNumber(t.maxAmount)) {
      currentTier = { minAmount: toNumber(t.minAmount), maxAmount: toNumber(t.maxAmount), ratePercent: toNumber(t.ratePercent), sortOrder: t.sortOrder }
      break
    }
  }
  if (currentTier === null && tiersList.length > 0) currentTier = tiersList[tiersList.length - 1]

  let nextTier: TierSummaryItem | null = null
  if (currentTier) {
    const next = tiers.find((t) => t.sortOrder > currentTier!.sortOrder)
    if (next) nextTier = { minAmount: toNumber(next.minAmount), maxAmount: toNumber(next.maxAmount), ratePercent: toNumber(next.ratePercent), sortOrder: next.sortOrder }
  } else if (tiers.length > 0) {
    nextTier = tiersList[0]
  }

  let encouragementMessage: string
  if (currentTier) {
    if (nextTier) {
      const gap = nextTier.minAmount - weeklySalesTotal
      encouragementMessage = `再完成 ¥${gap.toFixed(2)} 即可晋级下一档（奖金比例 ${adjustRate(nextTier.ratePercent, level2Rate, hasInviter)}%）`
    } else {
      encouragementMessage = "您已处于最高档，继续保持！"
    }
  } else if (nextTier) {
    const gap = nextTier.minAmount - weeklySalesTotal
    encouragementMessage = `再完成 ¥${gap.toFixed(2)} 即可达到第一档（奖金比例 ${adjustRate(nextTier.ratePercent, level2Rate, hasInviter)}%）`
  } else {
    encouragementMessage = "暂无阶梯档位，完成订单即可获得基础奖金。"
  }

  return { weeklySalesTotal, currentTier, tiersList, nextTier, encouragementMessage, hasInviter }
}

// ── Commissions ───────────────────────────────────────────────────────────────

export async function createOrderCommissions(
  tx: Prisma.TransactionClient,
  params: CreateOrderCommissionsParams,
): Promise<void> {
  const { orderId, distributorId, orderEmail, orderAmount, paidAt } = params
  const distributor = await tx.user.findUnique({
    where: { id: distributorId },
    select: { email: true, inviterId: true },
  })
  if (!distributor) return

  const orderEmailNorm = orderEmail?.trim().toLowerCase() ?? ""
  const distributorEmailNorm = distributor.email?.trim().toLowerCase() ?? ""
  if (orderEmailNorm && orderEmailNorm === distributorEmailNorm) return

  const weekStart = getWeekStart(paidAt)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)

  const weekOrders = await tx.order.findMany({
    where: { distributorId, status: "COMPLETED", paidAt: { gte: weekStart, lt: weekEnd } },
    select: { amount: true },
  })
  const weekTotal = weekOrders.reduce((sum, o) => sum + toNumber(o.amount), 0)

  const tiers = await tx.commissionTier.findMany({ orderBy: { sortOrder: "asc" } })
  let ratePercent: number | null = null
  for (const tier of tiers) {
    if (weekTotal >= toNumber(tier.minAmount) && weekTotal < toNumber(tier.maxAmount)) {
      ratePercent = toNumber(tier.ratePercent)
      break
    }
  }
  if (ratePercent == null && tiers.length > 0) ratePercent = toNumber(tiers[tiers.length - 1].ratePercent)

  const paidAmount = toNumber(orderAmount)
  const totalCommission =
    ratePercent != null && paidAmount > 0
      ? Math.round((paidAmount * ratePercent) / 100 * 100) / 100
      : 0
  if (totalCommission <= 0) return

  const inviterId = distributor.inviterId ?? null
  type InviterInfo = { email: string | null; role: string; disabledAt: Date | null }
  let inviter: InviterInfo | null = null
  if (inviterId) {
    const found = await tx.user.findUnique({
      where: { id: inviterId },
      select: { email: true, role: true, disabledAt: true },
    })
    if (found) inviter = found
  }

  const cfg = getConfig()
  const level2Rate = cfg.level2CommissionRatePercent
  const shouldSplitLevel2 =
    inviterId != null &&
    inviter != null &&
    inviter.role === "DISTRIBUTOR" &&
    !inviter.disabledAt &&
    orderEmailNorm !== (inviter.email ?? "").trim().toLowerCase()

  if (shouldSplitLevel2 && inviter != null) {
    const level2Amount = Math.round(totalCommission * level2Rate / 100 * 100) / 100
    const level1Amount = Math.round((totalCommission - level2Amount) * 100) / 100
    if (level1Amount > 0) await tx.commission.create({ data: { orderId, distributorId, amount: level1Amount, status: "SETTLED", level: 1, createdAt: paidAt } })
    if (level2Amount > 0) await tx.commission.create({ data: { orderId, distributorId: inviterId, amount: level2Amount, status: "SETTLED", level: 2, sourceDistributorId: distributorId, createdAt: paidAt } })
  } else {
    await tx.commission.create({ data: { orderId, distributorId, amount: totalCommission, status: "SETTLED", level: 1, createdAt: paidAt } })
  }
}

export async function listDistributorCommissions(
  distributorId: string,
  status: "PENDING" | "SETTLED" | "WITHDRAWN" | undefined,
  page: number,
  pageSize: number,
) {
  const skip = (page - 1) * pageSize
  const [commissions, total, settled, paid, pending, bonuses] = await Promise.all([
    repo.findCommissions(distributorId, status, skip, pageSize),
    repo.countCommissions(distributorId, status),
    repo.aggregateCommissionSum(distributorId, "SETTLED"),
    repo.aggregateWithdrawalSum(distributorId, "PAID"),
    repo.aggregateWithdrawalSum(distributorId, "PENDING"),
    repo.aggregateMilestoneBonusSum(distributorId),
  ])
  const withdrawableBalance = Math.round((settled + bonuses - paid - pending) * 100) / 100
  const data: CommissionRow[] = commissions.map((c) => ({
    id: c.id,
    orderId: c.orderId,
    orderNo: c.order.orderNo,
    amount: toNumber(c.amount),
    status: c.status,
    createdAt: c.createdAt,
    orderAmount: c.order ? toNumber(c.order.amount) : null,
    paidAt: c.order?.paidAt ?? null,
  }))
  return {
    data,
    meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 },
    withdrawableBalance,
    withdrawalMinAmount: config.withdrawalMinAmount,
  }
}

// ── Withdrawals ───────────────────────────────────────────────────────────────

export async function listDistributorWithdrawals(
  distributorId: string,
  page: number,
  pageSize: number,
) {
  const skip = (page - 1) * pageSize
  const [withdrawals, total] = await Promise.all([
    repo.findWithdrawalsByDistributor(distributorId, skip, pageSize),
    repo.countWithdrawalsByDistributor(distributorId),
  ])
  return {
    data: withdrawals.map(serializeWithdrawal),
    meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 },
  }
}

export async function createWithdrawal(
  distributorId: string,
  amount: number,
  feePercent: number,
  receiptImageUrl: string,
): Promise<WithdrawalRow> {
  const feeAmount = Math.round(amount * feePercent) / 100

  const w = await prisma.$transaction(
    async (tx) => {
      const [settled, paid, pending, bonuses] = await Promise.all([
        repo.aggregateCommissionSum(distributorId, "SETTLED", tx),
        repo.aggregateWithdrawalSum(distributorId, "PAID", tx),
        repo.aggregateWithdrawalSum(distributorId, "PENDING", tx),
        repo.aggregateMilestoneBonusSum(distributorId, tx),
      ])
      const balance = Math.round((settled + bonuses - paid - pending) * 100) / 100
      if (amount > balance) throw new WithdrawalOverBalanceError()
      return repo.createWithdrawalRecord({ distributorId, amount, feePercent, feeAmount, receiptImageUrl }, tx)
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )

  return serializeWithdrawal(w)
}

export async function listAdminWithdrawals(status?: "PENDING" | "PAID" | "REJECTED"): Promise<AdminWithdrawalRow[]> {
  const withdrawals = await repo.findAllWithdrawals(status)
  return withdrawals.map((w) => {
    const feeAmount = toNumber(w.feeAmount)
    return {
      id: w.id,
      distributorId: w.distributorId,
      distributor: w.distributor,
      amount: toNumber(w.amount),
      feePercent: toNumber(w.feePercent),
      feeAmount,
      actualAmount: Math.round((toNumber(w.amount) - feeAmount) * 100) / 100,
      status: w.status,
      note: w.note,
      receiptImageUrl: w.receiptImageUrl,
      processedAt: w.processedAt,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }
  })
}

export async function countPendingWithdrawals(): Promise<number> {
  return repo.countPendingWithdrawals()
}

export async function processWithdrawal(id: string, data: UpdateWithdrawalInput): Promise<AdminWithdrawalRow> {
  const w = await prisma.$transaction(
    async (tx) => {
      const existing = await repo.findWithdrawalById(id, tx)
      if (!existing) throw new WithdrawalNotFoundError(id)
      if (existing.status !== "PENDING") throw new WithdrawalNotPendingError()

      if (data.status === "PAID") {
        const [settled, paid, bonuses] = await Promise.all([
          repo.aggregateCommissionSum(existing.distributorId, "SETTLED", tx),
          repo.aggregateWithdrawalSum(existing.distributorId, "PAID", tx),
          repo.aggregateMilestoneBonusSum(existing.distributorId, tx),
        ])
        const available = Math.round((settled + bonuses - paid) * 100) / 100
        if (toNumber(existing.amount) > available) throw new WithdrawalOverBalanceError()
      }

      return repo.updateWithdrawalRecord(id, {
        status: data.status,
        ...(data.note !== undefined && { note: data.note }),
        processedAt: new Date(),
      }, tx)
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
  const feeAmount = toNumber(w.feeAmount)
  return {
    id: w.id,
    distributorId: w.distributorId,
    distributor: w.distributor,
    amount: toNumber(w.amount),
    feePercent: toNumber(w.feePercent),
    feeAmount,
    actualAmount: Math.round((toNumber(w.amount) - feeAmount) * 100) / 100,
    status: w.status,
    note: w.note,
    receiptImageUrl: w.receiptImageUrl,
    processedAt: w.processedAt,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  }
}

// ── Order distributor reassign ────────────────────────────────────────────────

export async function reassignOrderDistributor(
  orderId: string,
  distributorId: string | null,
): Promise<void> {
  const order = await repo.findOrderById(orderId)
  if (!order) throw new Error("ORDER_NOT_FOUND")
  if (order.status !== "COMPLETED") throw new Error("ORDER_NOT_COMPLETED")

  if (distributorId !== null) {
    const user = await repo.findUserById(distributorId)
    if (!user || user.role !== "DISTRIBUTOR") throw new Error("INVALID_DISTRIBUTOR")
  }

  const withdrawnCount = await repo.countWithdrawnCommissions(orderId)
  if (withdrawnCount > 0) throw new CommissionWithdrawnError()

  const existingCommissions = await repo.findOrderCommissions(orderId, ["SETTLED", "PENDING"])

  if (existingCommissions.length > 0) {
    const amountByDistributor = new Map<string, number>()
    for (const c of existingCommissions) {
      const prev = amountByDistributor.get(c.distributorId) ?? 0
      amountByDistributor.set(c.distributorId, prev + toNumber(c.amount))
    }
    for (const [distId, cancelAmount] of amountByDistributor) {
      const pendingCount = await repo.countPendingWithdrawalsByDistributor(distId)
      if (pendingCount > 0) throw new PendingWithdrawalBlocksReassignError()
      const [settled, paid] = await Promise.all([
        repo.aggregateCommissionSum(distId, "SETTLED"),
        repo.aggregateWithdrawalSum(distId, "PAID"),
      ])
      if (settled - cancelAmount - paid < 0) throw new CommissionAlreadyPaidOutError()
    }
  }

  await prisma.$transaction(async (tx) => {
    await repo.cancelOrderCommissions(orderId, tx as Parameters<typeof repo.cancelOrderCommissions>[1])
    await repo.updateOrderDistributor(orderId, distributorId, tx as Parameters<typeof repo.updateOrderDistributor>[2])
    if (distributorId !== null && order.paidAt) {
      await createOrderCommissions(tx, {
        orderId,
        distributorId,
        orderEmail: order.email ?? "",
        orderAmount: order.amount,
        discountPercentApplied: order.discountPercentApplied,
        paidAt: order.paidAt,
      })
      await checkAndIssueMilestoneBonuses(tx, distributorId)
    }
  })
}

// ── Distributor report ────────────────────────────────────────────────────────

export async function getDistributorReport(startUTC: Date, endUTC: Date) {
  const [
    pendingAmount,
    distributorCount,
    settledAmount,
    ordersByDistributor,
    newDistributors,
  ] = await Promise.all([
    repo.aggregateCommissionsByStatusAndPeriod("PENDING", startUTC, endUTC),
    repo.countTotalDistributors(),
    repo.aggregateCommissionsByStatusAndPeriod("SETTLED", startUTC, endUTC),
    repo.groupOrdersByDistributor(startUTC, endUTC),
    repo.findNewDistributors(startUTC, endUTC),
  ])

  const distributorIds = ordersByDistributor.map((r) => r.distributorId as string)
  const [distributors, pendingCommissions] =
    distributorIds.length > 0
      ? await Promise.all([
          repo.findDistributorsByIds(distributorIds),
          repo.groupPendingCommissionsByDistributor(distributorIds),
        ])
      : [[], []]

  const nameMap = new Map(distributors.map((d) => [d.id, { name: d.name, email: d.email }]))
  const pendingMap = new Map(
    (pendingCommissions as { distributorId: string; _sum: { amount: unknown } }[]).map((c) => [
      c.distributorId,
      toNumber(c._sum.amount),
    ]),
  )

  const leaderboard = ordersByDistributor
    .map((r) => {
      const info = nameMap.get(r.distributorId as string)
      return {
        distributorId: r.distributorId as string,
        name: info?.name ?? null,
        email: info?.email ?? "",
        revenue: toNumber(r._sum.amount),
        orderCount: r._count.id,
        pendingCommission: pendingMap.get(r.distributorId as string) ?? 0,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)

  return {
    summary: {
      pendingCommissionAmount: pendingAmount,
      settledCommission: settledAmount,
      distributorCount,
      newDistributorCount: newDistributors.length,
    },
    leaderboard,
    newDistributors: newDistributors.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email ?? "",
      inviterName: u.inviter?.name ?? null,
      inviterEmail: u.inviter?.email ?? null,
      createdAt: u.createdAt.toISOString(),
    })),
  }
}
