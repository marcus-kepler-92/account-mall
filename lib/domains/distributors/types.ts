// lib/domains/distributors/types.ts
import type { Prisma } from "@prisma/client"

// ── Prisma model aliases ──────────────────────────────────────────────────────
export type Commission = Prisma.CommissionGetPayload<Record<string, never>>
export type CommissionTier = Prisma.CommissionTierGetPayload<Record<string, never>>
export type Withdrawal = Prisma.WithdrawalGetPayload<Record<string, never>>
export type DistributorInvitation = Prisma.DistributorInvitationGetPayload<Record<string, never>>

// ── Serialized row types (safe for JSON) ─────────────────────────────────────
export type TierRow = {
  id: string
  minAmount: number
  maxAmount: number
  ratePercent: number
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

export type DistributorRow = {
  id: string
  email: string | null
  name: string | null
  distributorCode: string | null
  discountCodeEnabled: boolean
  discountPercent: number | null
  disabledAt: Date | null
  createdAt: Date
  orderCount: number
  completedOrderCount: number
  totalCommission: number
  withdrawableBalance: number
}

export type CommissionRow = {
  id: string
  orderId: string
  orderNo: string
  amount: number
  status: string
  createdAt: Date
  orderAmount: number | null
  paidAt: Date | null
}

export type WithdrawalRow = {
  id: string
  amount: number
  feePercent: number
  feeAmount: number
  actualAmount: number
  status: string
  receiptImageUrl: string | null
  note: string | null
  processedAt: Date | null
  createdAt: Date
}

export type AdminWithdrawalRow = WithdrawalRow & {
  distributorId: string
  distributor: { id: string; email: string | null; name: string | null }
  updatedAt: Date
}

// ── Tier summary (for distributor profile) ────────────────────────────────────
export type TierSummaryItem = {
  minAmount: number
  maxAmount: number
  ratePercent: number
  sortOrder: number
}

export type DistributorTierSummary = {
  weeklySalesTotal: number
  currentTier: TierSummaryItem | null
  tiersList: TierSummaryItem[]
  nextTier: TierSummaryItem | null
  encouragementMessage: string
  hasInviter: boolean
}

// ── Commission calculation ────────────────────────────────────────────────────
export interface CreateOrderCommissionsParams {
  orderId: string
  distributorId: string
  orderEmail: string
  orderAmount: unknown
  discountPercentApplied: unknown
  paidAt: Date
}

// ── Invite result ─────────────────────────────────────────────────────────────
export type SendInviteResult =
  | { success: true }
  | { success: false; reason: "already_registered" | "send_failed" }

// ── Domain errors ─────────────────────────────────────────────────────────────
export class DistributorNotFoundError extends Error {
  constructor(id: string) {
    super(`Distributor ${id} not found`)
    this.name = "DistributorNotFoundError"
  }
}

export class DistributorNotDisabledError extends Error {
  constructor() {
    super("请先停用该分销员再删除")
    this.name = "DistributorNotDisabledError"
  }
}

export class DistributorHasAssociationsError extends Error {
  constructor(reason: "orders" | "commissions" | "withdrawals" | "invitees") {
    const msgs = {
      orders: "该分销员存在关联订单，无法删除",
      commissions: "该分销员存在关联佣金记录，无法删除",
      withdrawals: "该分销员存在关联提现记录，无法删除",
      invitees: "该分销员存在下线分销员，无法删除",
    }
    super(msgs[reason])
    this.name = "DistributorHasAssociationsError"
  }
}

export class WithdrawalNotFoundError extends Error {
  constructor(id: string) {
    super(`Withdrawal ${id} not found`)
    this.name = "WithdrawalNotFoundError"
  }
}

export class WithdrawalNotPendingError extends Error {
  constructor() {
    super("Only PENDING withdrawals can be updated")
    this.name = "WithdrawalNotPendingError"
  }
}

export class WithdrawalOverBalanceError extends Error {
  constructor() {
    super("提现金额不能超过可提现余额")
    this.name = "WithdrawalOverBalanceError"
  }
}

export class CommissionTierNotFoundError extends Error {
  constructor(id: string) {
    super(`CommissionTier ${id} not found`)
    this.name = "CommissionTierNotFoundError"
  }
}

export class TierRangeError extends Error {
  constructor() {
    super("minAmount must be less than maxAmount")
    this.name = "TierRangeError"
  }
}

export class InviteTokenNotFoundError extends Error {
  constructor() {
    super("邀请链接无效")
    this.name = "InviteTokenNotFoundError"
  }
}

export class InviteTokenUsedError extends Error {
  constructor() {
    super("此邀请链接已被使用")
    this.name = "InviteTokenUsedError"
  }
}

export class InviteTokenExpiredError extends Error {
  constructor() {
    super("邀请链接已过期")
    this.name = "InviteTokenExpiredError"
  }
}

export class UsernameConflictError extends Error {
  constructor() {
    super("用户名已被使用，请换一个")
    this.name = "UsernameConflictError"
  }
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("该邮箱已注册")
    this.name = "EmailAlreadyRegisteredError"
  }
}

export class InviterCodeInvalidError extends Error {
  constructor() {
    super("邀请码无效或邀请人已停用")
    this.name = "InviterCodeInvalidError"
  }
}

export class SelfInviterError extends Error {
  constructor() {
    super("不能绑定自己为邀请人")
    this.name = "SelfInviterError"
  }
}

export class CommissionWithdrawnError extends Error {
  constructor() {
    super("此订单佣金已提现，无法修改分销归属")
    this.name = "CommissionWithdrawnError"
  }
}

export class PendingWithdrawalBlocksReassignError extends Error {
  constructor() {
    super("分销员存在待处理提现申请，无法修改分销归属")
    this.name = "PendingWithdrawalBlocksReassignError"
  }
}

export class CommissionAlreadyPaidOutError extends Error {
  constructor() {
    super("此订单佣金已被提现消耗，无法修改分销归属")
    this.name = "CommissionAlreadyPaidOutError"
  }
}
