# Distributors Domain Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all distributor-related business logic into `lib/domains/distributors/` following the FSD functional domain module architecture, making it the second reference domain after cards.

**Architecture:** Create a self-contained domain module (types → validators → repository → service → index). All 14 route handlers slim to ≤25 lines (auth + validate + call service + return). Old `lib/calculate-order-commission.ts`, `lib/distributor-tier-summary.ts`, `lib/send-distributor-invitation.ts`, `lib/create-no-email-invite-link.ts`, and `lib/validations/distributor-invite.ts` become re-export shims — zero test changes required since tests mock `@/lib/prisma` directly.

**Tech Stack:** TypeScript, Prisma 6, Zod, Jest, Next.js 16 App Router, better-auth

---

## File Map

**Create:**
- `lib/domains/distributors/types.ts` — domain types + error classes
- `lib/domains/distributors/validators.ts` — all Zod schemas
- `lib/domains/distributors/repository.ts` — all Prisma operations
- `lib/domains/distributors/service.ts` — all business logic
- `lib/domains/distributors/index.ts` — public API whitelist
- `lib/domains/distributors/__tests__/service.test.ts` — service unit tests

**Modify (slim to 4-step template):**
- `app/api/admin/distributors/route.ts`
- `app/api/admin/distributors/[id]/route.ts`
- `app/api/admin/distributors/invite/route.ts`
- `app/api/admin/withdrawals/route.ts`
- `app/api/admin/withdrawals/[id]/route.ts`
- `app/api/admin/withdrawals/count/route.ts`
- `app/api/admin/commission-tiers/route.ts`
- `app/api/admin/commission-tiers/[id]/route.ts`
- `app/api/admin/orders/[orderId]/distributor/route.ts`
- `app/api/admin/distributor-report/route.ts`
- `app/api/distributor/commissions/route.ts`
- `app/api/distributor/withdrawals/route.ts`
- `app/api/distributor/me/route.ts`
- `app/api/distributor/invite/route.ts`
- `app/api/distributor/accept-invite/route.ts`
- `app/api/distributor/bind-inviter/route.ts`

**Modify (re-export shims):**
- `lib/calculate-order-commission.ts`
- `lib/distributor-tier-summary.ts`
- `lib/send-distributor-invitation.ts`
- `lib/create-no-email-invite-link.ts`
- `lib/validations/distributor-invite.ts`

---

## Task 1: Create types.ts

**Files:**
- Create: `lib/domains/distributors/types.ts`

- [ ] **Step 1: Create types file**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/domains/distributors/types.ts
git commit -m "feat(distributors-domain): add types and error classes"
```

---

## Task 2: Create validators.ts

**Files:**
- Create: `lib/domains/distributors/validators.ts`

- [ ] **Step 1: Create validators file**

```typescript
// lib/domains/distributors/validators.ts
import * as z from "zod"

// ── Distributor invite ────────────────────────────────────────────────────────
export const distributorInviteSchema = z.object({
  email: z
    .string()
    .email("请输入有效的邮箱地址")
    .transform((v) => v.toLowerCase().trim()),
})

export const acceptInviteSchema = z.object({
  token: z.string().min(1, "邀请 token 不能为空"),
  name: z.string().min(1, "请输入昵称").max(50, "昵称不能超过 50 字符"),
  password: z.string().min(6, "密码至少 6 位").max(128, "密码不能超过 128 位"),
})

export const usernameSchema = z
  .string()
  .min(6, "用户名至少 6 位")
  .max(30, "用户名不能超过 30 位")
  .regex(/^[a-zA-Z0-9_]+$/, "用户名只能包含字母、数字和下划线")
  .trim()
  .transform((v) => v.toLowerCase())

export const acceptNoEmailInviteSchema = acceptInviteSchema.extend({
  username: usernameSchema,
})

export const bindInviterSchema = z.object({
  inviteCode: z.string().min(1, "邀请码不能为空").max(256, "邀请码过长"),
})

// ── Admin distributor management ──────────────────────────────────────────────
export const updateDistributorSchema = z.object({
  disabled: z.boolean().optional(),
  discountCodeEnabled: z.boolean().optional(),
  discountPercent: z.number().min(0).max(100).nullable().optional(),
})

// ── Commission tiers ──────────────────────────────────────────────────────────
export const createTierSchema = z.object({
  minAmount: z.number().min(0),
  maxAmount: z.number().min(0),
  ratePercent: z.number().min(0).max(100),
  sortOrder: z.number().int().min(0).optional(),
})

export const updateTierSchema = z.object({
  minAmount: z.number().min(0).optional(),
  maxAmount: z.number().min(0).optional(),
  ratePercent: z.number().min(0).max(100).optional(),
  sortOrder: z.number().int().min(0).optional(),
})

// ── Withdrawals ───────────────────────────────────────────────────────────────
export const updateWithdrawalSchema = z.object({
  status: z.enum(["PAID", "REJECTED"]),
  note: z.string().optional(),
})

// ── Order distributor reassign ────────────────────────────────────────────────
export const reassignDistributorSchema = z.object({
  distributorId: z.string().nullable(),
})

// ── Inferred types ────────────────────────────────────────────────────────────
export type DistributorInviteInput = z.infer<typeof distributorInviteSchema>
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>
export type AcceptNoEmailInviteInput = z.infer<typeof acceptNoEmailInviteSchema>
export type BindInviterInput = z.infer<typeof bindInviterSchema>
export type UpdateDistributorInput = z.infer<typeof updateDistributorSchema>
export type CreateTierInput = z.infer<typeof createTierSchema>
export type UpdateTierInput = z.infer<typeof updateTierSchema>
export type UpdateWithdrawalInput = z.infer<typeof updateWithdrawalSchema>
export type ReassignDistributorInput = z.infer<typeof reassignDistributorSchema>
```

- [ ] **Step 2: Commit**

```bash
git add lib/domains/distributors/validators.ts
git commit -m "feat(distributors-domain): add validators"
```

---

## Task 3: Create repository.ts

**Files:**
- Create: `lib/domains/distributors/repository.ts`

- [ ] **Step 1: Create repository file**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/domains/distributors/repository.ts
git commit -m "feat(distributors-domain): add repository with all Prisma operations"
```

---

## Task 4: Write failing service unit tests

**Files:**
- Create: `lib/domains/distributors/__tests__/service.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// lib/domains/distributors/__tests__/service.test.ts
jest.mock("../repository")
jest.mock("@/lib/send-distributor-invitation", () => ({
  sendDistributorInvitation: jest.fn(),
}))
jest.mock("@/lib/config", () => ({
  getConfig: jest.fn(() => ({ level2CommissionRatePercent: 20 })),
  config: {
    distributorInviteTtlDays: 7,
    siteUrl: "https://example.com",
    siteName: "TestShop",
    nodeEnv: "test",
    withdrawalFeePercent: 2,
    withdrawalMinAmount: 10,
    basePromoDiscountPercent: 5,
    level2CommissionRatePercent: 20,
  },
}))
jest.mock("@/lib/email", () => ({ sendMail: jest.fn() }))
jest.mock("@react-email/render", () => ({ render: jest.fn().mockResolvedValue("<html/>") }))
jest.mock("@/app/emails/distributor-invitation", () => ({ DistributorInvitation: "div" }))
jest.mock("better-auth/crypto", () => ({ hashPassword: jest.fn().mockResolvedValue("hashed") }))

import * as repo from "../repository"
import {
  updateDistributor,
  deleteDistributor,
  processWithdrawal,
  createWithdrawal,
  createCommissionTier,
  acceptInvite,
} from "../service"
import {
  DistributorNotFoundError,
  DistributorNotDisabledError,
  DistributorHasAssociationsError,
  WithdrawalNotFoundError,
  WithdrawalNotPendingError,
  WithdrawalOverBalanceError,
  TierRangeError,
  InviteTokenNotFoundError,
  InviteTokenUsedError,
  InviteTokenExpiredError,
} from "../types"

beforeEach(() => jest.clearAllMocks())

// ── updateDistributor ─────────────────────────────────────────────────────────

describe("updateDistributor", () => {
  it("throws DistributorNotFoundError when distributor does not exist", async () => {
    ;(repo.findDistributorById as jest.Mock).mockResolvedValue(null)
    await expect(updateDistributor("d1", { disabled: true })).rejects.toThrow(DistributorNotFoundError)
  })

  it("sets disabledAt when disabled=true", async () => {
    ;(repo.findDistributorById as jest.Mock).mockResolvedValue({ id: "d1", disabledAt: null })
    ;(repo.updateDistributorData as jest.Mock).mockResolvedValue({ id: "d1", discountPercent: null })
    await updateDistributor("d1", { disabled: true })
    const callData = (repo.updateDistributorData as jest.Mock).mock.calls[0][1]
    expect(callData.disabledAt).toBeInstanceOf(Date)
  })

  it("clears disabledAt when disabled=false", async () => {
    ;(repo.findDistributorById as jest.Mock).mockResolvedValue({ id: "d1", disabledAt: new Date() })
    ;(repo.updateDistributorData as jest.Mock).mockResolvedValue({ id: "d1", discountPercent: null })
    await updateDistributor("d1", { disabled: false })
    const callData = (repo.updateDistributorData as jest.Mock).mock.calls[0][1]
    expect(callData.disabledAt).toBeNull()
  })
})

// ── deleteDistributor ─────────────────────────────────────────────────────────

describe("deleteDistributor", () => {
  it("throws DistributorNotFoundError when not found", async () => {
    ;(repo.findDistributorById as jest.Mock).mockResolvedValue(null)
    await expect(deleteDistributor("d1")).rejects.toThrow(DistributorNotFoundError)
  })

  it("throws DistributorNotDisabledError when still active", async () => {
    ;(repo.findDistributorById as jest.Mock).mockResolvedValue({ id: "d1", disabledAt: null })
    await expect(deleteDistributor("d1")).rejects.toThrow(DistributorNotDisabledError)
  })

  it("throws DistributorHasAssociationsError when has orders", async () => {
    ;(repo.findDistributorById as jest.Mock).mockResolvedValue({ id: "d1", disabledAt: new Date() })
    ;(repo.countDistributorOrders as jest.Mock).mockResolvedValue(1)
    ;(repo.countDistributorCommissions as jest.Mock).mockResolvedValue(0)
    ;(repo.countDistributorWithdrawals as jest.Mock).mockResolvedValue(0)
    ;(repo.countDistributorInvitees as jest.Mock).mockResolvedValue(0)
    await expect(deleteDistributor("d1")).rejects.toThrow(DistributorHasAssociationsError)
  })

  it("deletes invitations and user when all checks pass", async () => {
    ;(repo.findDistributorById as jest.Mock).mockResolvedValue({ id: "d1", disabledAt: new Date() })
    ;(repo.countDistributorOrders as jest.Mock).mockResolvedValue(0)
    ;(repo.countDistributorCommissions as jest.Mock).mockResolvedValue(0)
    ;(repo.countDistributorWithdrawals as jest.Mock).mockResolvedValue(0)
    ;(repo.countDistributorInvitees as jest.Mock).mockResolvedValue(0)
    ;(repo.deleteDistributorInvitations as jest.Mock).mockResolvedValue({ count: 0 })
    ;(repo.deleteDistributorRecord as jest.Mock).mockResolvedValue({})
    await deleteDistributor("d1")
    expect(repo.deleteDistributorInvitations).toHaveBeenCalledWith("d1")
    expect(repo.deleteDistributorRecord).toHaveBeenCalledWith("d1")
  })
})

// ── processWithdrawal ─────────────────────────────────────────────────────────

describe("processWithdrawal", () => {
  it("throws WithdrawalNotFoundError when not found", async () => {
    ;(repo.findWithdrawalById as jest.Mock).mockResolvedValue(null)
    await expect(processWithdrawal("w1", { status: "PAID" })).rejects.toThrow(WithdrawalNotFoundError)
  })

  it("throws WithdrawalNotPendingError when already processed", async () => {
    ;(repo.findWithdrawalById as jest.Mock).mockResolvedValue({ id: "w1", status: "PAID" })
    await expect(processWithdrawal("w1", { status: "PAID" })).rejects.toThrow(WithdrawalNotPendingError)
  })

  it("updates withdrawal when PENDING", async () => {
    ;(repo.findWithdrawalById as jest.Mock).mockResolvedValue({ id: "w1", status: "PENDING" })
    ;(repo.updateWithdrawalRecord as jest.Mock).mockResolvedValue({
      id: "w1",
      amount: { toNumber: () => 100 },
      feeAmount: 2,
      feePercent: 2,
      status: "PAID",
      note: null,
      processedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      distributorId: "d1",
      distributor: { id: "d1", email: "a@b.com", name: null },
    })
    const result = await processWithdrawal("w1", { status: "PAID" })
    expect(result.status).toBe("PAID")
    expect(repo.updateWithdrawalRecord).toHaveBeenCalledWith(
      "w1",
      expect.objectContaining({ status: "PAID", processedAt: expect.any(Date) }),
    )
  })
})

// ── createWithdrawal ──────────────────────────────────────────────────────────

describe("createWithdrawal", () => {
  it("throws WithdrawalOverBalanceError when amount exceeds balance", async () => {
    ;(repo.aggregateCommissionSum as jest.Mock).mockResolvedValue(50)
    ;(repo.aggregateWithdrawalSum as jest.Mock)
      .mockResolvedValueOnce(40) // PAID
      .mockResolvedValueOnce(0)  // PENDING
    // balance = 50 - 40 - 0 = 10; withdraw 20 → over
    await expect(
      createWithdrawal("d1", 20, 2, "https://img.url/receipt.png"),
    ).rejects.toThrow(WithdrawalOverBalanceError)
  })

  it("creates withdrawal when amount is within balance", async () => {
    ;(repo.aggregateCommissionSum as jest.Mock).mockResolvedValue(100)
    ;(repo.aggregateWithdrawalSum as jest.Mock).mockResolvedValue(0)
    ;(repo.createWithdrawalRecord as jest.Mock).mockResolvedValue({
      id: "w1",
      amount: 50,
      feePercent: 2,
      feeAmount: 1,
      status: "PENDING",
      receiptImageUrl: "https://img.url/receipt.png",
      createdAt: new Date(),
    })
    const result = await createWithdrawal("d1", 50, 2, "https://img.url/receipt.png")
    expect(result.id).toBe("w1")
    expect(repo.createWithdrawalRecord).toHaveBeenCalledWith(
      expect.objectContaining({ distributorId: "d1", amount: 50, feePercent: 2 }),
    )
  })
})

// ── createCommissionTier ──────────────────────────────────────────────────────

describe("createCommissionTier", () => {
  it("throws TierRangeError when minAmount >= maxAmount", async () => {
    await expect(
      createCommissionTier({ minAmount: 100, maxAmount: 50, ratePercent: 5 }),
    ).rejects.toThrow(TierRangeError)
  })

  it("auto-assigns next sortOrder when not provided", async () => {
    ;(repo.aggregateMaxTierSortOrder as jest.Mock).mockResolvedValue(2)
    ;(repo.createTierRecord as jest.Mock).mockResolvedValue({
      id: "t1",
      minAmount: 0,
      maxAmount: 100,
      ratePercent: 5,
      sortOrder: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    await createCommissionTier({ minAmount: 0, maxAmount: 100, ratePercent: 5 })
    expect(repo.createTierRecord).toHaveBeenCalledWith(
      expect.objectContaining({ sortOrder: 3 }),
    )
  })
})

// ── acceptInvite ──────────────────────────────────────────────────────────────

describe("acceptInvite", () => {
  it("throws InviteTokenNotFoundError when token missing", async () => {
    ;(repo.findInvitationByToken as jest.Mock).mockResolvedValue(null)
    await expect(
      acceptInvite("bad-token", { name: "Alice", password: "pass1234" }),
    ).rejects.toThrow(InviteTokenNotFoundError)
  })

  it("throws InviteTokenUsedError when already accepted", async () => {
    ;(repo.findInvitationByToken as jest.Mock).mockResolvedValue({
      token: "tok",
      acceptedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
      email: "a@b.com",
      inviterId: "admin1",
      inviter: { role: "ADMIN" },
    })
    await expect(
      acceptInvite("tok", { name: "Alice", password: "pass1234" }),
    ).rejects.toThrow(InviteTokenUsedError)
  })

  it("throws InviteTokenExpiredError when past expiry", async () => {
    ;(repo.findInvitationByToken as jest.Mock).mockResolvedValue({
      token: "tok",
      acceptedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      email: "a@b.com",
      inviterId: "admin1",
      inviter: { role: "ADMIN" },
    })
    await expect(
      acceptInvite("tok", { name: "Alice", password: "pass1234" }),
    ).rejects.toThrow(InviteTokenExpiredError)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail (service.ts does not exist yet)**

```bash
npx jest lib/domains/distributors/__tests__/service.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module '../service'"

- [ ] **Step 3: Commit failing tests**

```bash
git add lib/domains/distributors/__tests__/service.test.ts
git commit -m "test(distributors-domain): add failing service unit tests"
```

---

## Task 5: Implement service.ts

**Files:**
- Create: `lib/domains/distributors/service.ts`

- [ ] **Step 1: Create service.ts**

```typescript
// lib/domains/distributors/service.ts
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getConfig } from "@/lib/config"
import { config } from "@/lib/config"
import { sendMail } from "@/lib/email"
import { render } from "@react-email/render"
import React from "react"
import { DistributorInvitation as DistributorInvitationEmail } from "@/app/emails/distributor-invitation"
import { hashPassword } from "better-auth/crypto"
import * as repo from "./repository"
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
  InviteTokenUsedError,
  InviteTokenExpiredError,
  UsernameConflictError,
  EmailAlreadyRegisteredError,
  InviterCodeInvalidError,
  SelfInviterError,
  CommissionWithdrawnError,
  PendingWithdrawalBlocksReassignError,
  CommissionAlreadyPaidOutError,
} from "./types"
import type { UpdateDistributorInput, CreateTierInput, UpdateTierInput, UpdateWithdrawalInput, AcceptInviteInput } from "./validators"

// ── Utilities (shared with calculate-order-commission shim) ──────────────────

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
      const [completedOrderCount, settled, paid, pending] = await Promise.all([
        prisma.order.count({ where: { distributorId: d.id, status: "COMPLETED" } }),
        repo.aggregateCommissionSum(d.id, "SETTLED"),
        repo.aggregateWithdrawalSum(d.id, "PAID"),
        repo.aggregateWithdrawalSum(d.id, "PENDING"),
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
        withdrawableBalance: Math.round((settled - paid - pending) * 100) / 100,
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
  await repo.createInvitation({ email, token, inviterId, expiresAt })
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

export async function createNoEmailInviteLink({ inviterId }: { inviterId: string }): Promise<{ link: string }> {
  const ttlDays = config.distributorInviteTtlDays
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)
  const token = crypto.randomUUID()
  await repo.createInvitation({ email: null, token, inviterId, expiresAt })
  const link = `${config.siteUrl}/distributor/accept-invite?token=${token}`
  return { link }
}

export async function acceptInvite(token: string, data: AcceptInviteInput & { username?: string }): Promise<void> {
  const invitation = await repo.findInvitationByToken(token)
  if (!invitation) throw new InviteTokenNotFoundError()
  if (invitation.acceptedAt) throw new InviteTokenUsedError()
  if (invitation.expiresAt < new Date()) throw new InviteTokenExpiredError()

  const isNoEmail = invitation.email === null

  if (isNoEmail) {
    if (!data.username) throw new InviteTokenNotFoundError() // schema should catch this before service
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
    const inv = await tx.distributorInvitation.findUnique({
      where: { token },
      select: { acceptedAt: true },
    })
    if (inv?.acceptedAt) throw new InviteTokenUsedError()

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

    await repo.markInvitationAccepted(token, now, tx as Parameters<typeof repo.markInvitationAccepted>[2])
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

  const [settled, paid, pending, tierSummary] = await Promise.all([
    repo.aggregateCommissionSum(userId, "SETTLED"),
    repo.aggregateWithdrawalSum(userId, "PAID"),
    repo.aggregateWithdrawalSum(userId, "PENDING"),
    getDistributorTierSummary(userId, level2Rate),
  ])

  const withdrawableBalance = Math.round((settled - paid - pending) * 100) / 100

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
  if (currentTier === null && tiersList.length > 0) currentTier = tiersList[0]

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
  if (ratePercent == null && tiers.length > 0) ratePercent = toNumber(tiers[0].ratePercent)

  const paidAmount = toNumber(orderAmount)
  const totalCommission =
    ratePercent != null && paidAmount > 0
      ? Math.round((paidAmount * ratePercent) / 100 * 100) / 100
      : 0
  if (totalCommission <= 0) return

  const inviterId = distributor.inviterId ?? null
  let inviter: { email: string | null; role: string; disabledAt: Date | null } | null = null
  if (inviterId) {
    inviter = await tx.user.findUnique({
      where: { id: inviterId },
      select: { email: true, role: true, disabledAt: true },
    }) as typeof inviter
  }

  const cfg = getConfig()
  const level2Rate = cfg.level2CommissionRatePercent
  const shouldSplitLevel2 =
    inviterId && inviter && inviter.role === "DISTRIBUTOR" && !inviter.disabledAt &&
    orderEmailNorm !== (inviter.email ?? "").trim().toLowerCase()

  if (shouldSplitLevel2) {
    const level2Amount = Math.round(totalCommission * level2Rate / 100 * 100) / 100
    const level1Amount = Math.round((totalCommission - level2Amount) * 100) / 100
    if (level1Amount > 0) await tx.commission.create({ data: { orderId, distributorId, amount: level1Amount, status: "SETTLED", level: 1 } })
    if (level2Amount > 0) await tx.commission.create({ data: { orderId, distributorId: inviterId!, amount: level2Amount, status: "SETTLED", level: 2, sourceDistributorId: distributorId } })
  } else {
    await tx.commission.create({ data: { orderId, distributorId, amount: totalCommission, status: "SETTLED", level: 1 } })
  }
}

export async function listDistributorCommissions(
  distributorId: string,
  status: "PENDING" | "SETTLED" | "WITHDRAWN" | undefined,
  page: number,
  pageSize: number,
) {
  const skip = (page - 1) * pageSize
  const [commissions, total, settled, paid, pending] = await Promise.all([
    repo.findCommissions(distributorId, status, skip, pageSize),
    repo.countCommissions(distributorId, status),
    repo.aggregateCommissionSum(distributorId, "SETTLED"),
    repo.aggregateWithdrawalSum(distributorId, "PAID"),
    repo.aggregateWithdrawalSum(distributorId, "PENDING"),
  ])
  const withdrawableBalance = Math.round((settled - paid - pending) * 100) / 100
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

  const [settled, paid, pending] = await Promise.all([
    repo.aggregateCommissionSum(distributorId, "SETTLED"),
    repo.aggregateWithdrawalSum(distributorId, "PAID"),
    repo.aggregateWithdrawalSum(distributorId, "PENDING"),
  ])
  const balance = Math.round((settled - paid - pending) * 100) / 100
  if (amount > balance) throw new WithdrawalOverBalanceError()

  const w = await repo.createWithdrawalRecord({ distributorId, amount, feePercent, feeAmount, receiptImageUrl })
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
  const existing = await repo.findWithdrawalById(id)
  if (!existing) throw new WithdrawalNotFoundError(id)
  if (existing.status !== "PENDING") throw new WithdrawalNotPendingError()
  const w = await repo.updateWithdrawalRecord(id, {
    status: data.status,
    ...(data.note !== undefined && { note: data.note }),
    processedAt: new Date(),
  })
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
```

- [ ] **Step 2: Run service tests to confirm they pass**

```bash
npx jest lib/domains/distributors/__tests__/service.test.ts --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/domains/distributors/service.ts
git commit -m "feat(distributors-domain): implement service layer (TDD green)"
```

---

## Task 6: Create index.ts

**Files:**
- Create: `lib/domains/distributors/index.ts`

- [ ] **Step 1: Create public API whitelist**

```typescript
// lib/domains/distributors/index.ts

// CommissionTier
export { listCommissionTiers, createCommissionTier, updateCommissionTier, deleteCommissionTier } from "./service"

// Distributor CRUD
export { listDistributors, updateDistributor, deleteDistributor } from "./service"

// Invitations
export { sendInvite, createNoEmailInviteLink, acceptInvite, bindInviter } from "./service"

// Profile
export { getDistributorProfile, getDistributorTierSummary } from "./service"

// Commissions
export { createOrderCommissions, listDistributorCommissions } from "./service"

// Withdrawals
export { listDistributorWithdrawals, createWithdrawal, listAdminWithdrawals, countPendingWithdrawals, processWithdrawal } from "./service"

// Order reassign
export { reassignOrderDistributor } from "./service"

// Report
export { getDistributorReport } from "./service"

// Utilities (consumed by shims)
export { toNumber, getWeekStart, adjustRate } from "./service"

// Validators
export {
  distributorInviteSchema,
  acceptInviteSchema,
  acceptNoEmailInviteSchema,
  bindInviterSchema,
  updateDistributorSchema,
  createTierSchema,
  updateTierSchema,
  updateWithdrawalSchema,
  reassignDistributorSchema,
} from "./validators"
export type {
  DistributorInviteInput,
  AcceptInviteInput,
  AcceptNoEmailInviteInput,
  BindInviterInput,
  UpdateDistributorInput,
  CreateTierInput,
  UpdateTierInput,
  UpdateWithdrawalInput,
  ReassignDistributorInput,
} from "./validators"

// Types
export type {
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

// Domain errors
export {
  DistributorNotFoundError,
  DistributorNotDisabledError,
  DistributorHasAssociationsError,
  WithdrawalNotFoundError,
  WithdrawalNotPendingError,
  WithdrawalOverBalanceError,
  CommissionTierNotFoundError,
  TierRangeError,
  InviteTokenNotFoundError,
  InviteTokenUsedError,
  InviteTokenExpiredError,
  UsernameConflictError,
  EmailAlreadyRegisteredError,
  InviterCodeInvalidError,
  SelfInviterError,
  CommissionWithdrawnError,
  PendingWithdrawalBlocksReassignError,
  CommissionAlreadyPaidOutError,
} from "./types"
```

- [ ] **Step 2: Commit**

```bash
git add lib/domains/distributors/index.ts
git commit -m "feat(distributors-domain): add public index (API whitelist)"
```

---

## Task 7: Slim admin commission-tier routes

**Files:**
- Modify: `app/api/admin/commission-tiers/route.ts`
- Modify: `app/api/admin/commission-tiers/[id]/route.ts`

- [ ] **Step 1: Replace commission-tiers/route.ts**

```typescript
// app/api/admin/commission-tiers/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError, badRequest } from "@/lib/api-response"
import {
  createTierSchema,
  listCommissionTiers,
  createCommissionTier,
  TierRangeError,
} from "@/lib/domains/distributors"

export async function GET() {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const tiers = await listCommissionTiers()
  return NextResponse.json(tiers)
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }
  const parsed = createTierSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())
  try {
    const tier = await createCommissionTier(parsed.data)
    return NextResponse.json(tier, { status: 201 })
  } catch (e) {
    if (e instanceof TierRangeError) return badRequest(e.message)
    throw e
  }
}

export const runtime = "nodejs"
```

- [ ] **Step 2: Replace commission-tiers/[id]/route.ts**

```typescript
// app/api/admin/commission-tiers/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError, notFound, badRequest } from "@/lib/api-response"
import {
  updateTierSchema,
  updateCommissionTier,
  deleteCommissionTier,
  CommissionTierNotFoundError,
  TierRangeError,
} from "@/lib/domains/distributors"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const { id } = await context.params
  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }
  const parsed = updateTierSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())
  try {
    const tier = await updateCommissionTier(id, parsed.data)
    return NextResponse.json(tier)
  } catch (e) {
    if (e instanceof CommissionTierNotFoundError) return notFound(e.message)
    if (e instanceof TierRangeError) return badRequest(e.message)
    throw e
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const { id } = await context.params
  try {
    await deleteCommissionTier(id)
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    if (e instanceof CommissionTierNotFoundError) return notFound(e.message)
    throw e
  }
}

export const runtime = "nodejs"
```

- [ ] **Step 3: Run existing commission-tier tests**

```bash
npx jest --testPathPatterns="admin-distribution" --no-coverage
```

Expected: All commission-tier tests PASS.

- [ ] **Step 4: Commit**

```bash
git add "app/api/admin/commission-tiers/route.ts" "app/api/admin/commission-tiers/[id]/route.ts"
git commit -m "refactor(commission-tiers): slim routes, delegate to domain service"
```

---

## Task 8: Slim admin distributor routes

**Files:**
- Modify: `app/api/admin/distributors/route.ts`
- Modify: `app/api/admin/distributors/[id]/route.ts`
- Modify: `app/api/admin/distributors/invite/route.ts`

- [ ] **Step 1: Replace distributors/route.ts**

```typescript
// app/api/admin/distributors/route.ts
import { NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"
import { listDistributors } from "@/lib/domains/distributors"

export async function GET() {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const distributors = await listDistributors()
  return NextResponse.json(distributors)
}

export const runtime = "nodejs"
```

- [ ] **Step 2: Replace distributors/[id]/route.ts**

```typescript
// app/api/admin/distributors/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, notFound, badRequest } from "@/lib/api-response"
import {
  updateDistributorSchema,
  updateDistributor,
  deleteDistributor,
  DistributorNotFoundError,
  DistributorNotDisabledError,
  DistributorHasAssociationsError,
} from "@/lib/domains/distributors"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const { id } = await context.params
  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }
  const parsed = updateDistributorSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  try {
    const user = await updateDistributor(id, parsed.data)
    return NextResponse.json(user)
  } catch (e) {
    if (e instanceof DistributorNotFoundError) return notFound(e.message)
    throw e
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const { id } = await context.params
  try {
    await deleteDistributor(id)
    return NextResponse.json({ success: true })
  } catch (e) {
    if (e instanceof DistributorNotFoundError) return notFound(e.message)
    if (e instanceof DistributorNotDisabledError) return badRequest(e.message)
    if (e instanceof DistributorHasAssociationsError) return badRequest(e.message)
    throw e
  }
}

export const runtime = "nodejs"
```

- [ ] **Step 3: Replace distributors/invite/route.ts**

```typescript
// app/api/admin/distributors/invite/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { badRequest, unauthorized, validationError } from "@/lib/api-response"
import { distributorInviteSchema, sendInvite, createNoEmailInviteLink } from "@/lib/domains/distributors"

export async function POST(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const admin = session.user as { id: string; name?: string }

  let body: unknown
  try { body = await request.json() } catch { return badRequest("Invalid JSON body") }

  const hasEmail =
    typeof body === "object" && body !== null && "email" in body &&
    typeof (body as { email: unknown }).email === "string" &&
    (body as { email: string }).email.length > 0

  if (!hasEmail) {
    const result = await createNoEmailInviteLink({ inviterId: admin.id })
    return NextResponse.json({ success: true, link: result.link })
  }

  const parsed = distributorInviteSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors)

  const result = await sendInvite({
    email: parsed.data.email,
    inviterId: admin.id,
    inviterName: admin.name ?? "管理员",
  })
  if (!result.success) {
    return badRequest(result.reason === "already_registered" ? "该邮箱已注册，无需重复邀请" : "邮件发送失败，请稍后重试")
  }
  return NextResponse.json({ success: true, email: parsed.data.email })
}

export const runtime = "nodejs"
```

- [ ] **Step 4: Run existing distributor admin tests**

```bash
npx jest --testPathPatterns="admin-distribution|distributor-invite-admin" --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/api/admin/distributors/route.ts" "app/api/admin/distributors/[id]/route.ts" "app/api/admin/distributors/invite/route.ts"
git commit -m "refactor(admin-distributors): slim routes, delegate to domain service"
```

---

## Task 9: Slim admin withdrawal routes

**Files:**
- Modify: `app/api/admin/withdrawals/route.ts`
- Modify: `app/api/admin/withdrawals/[id]/route.ts`
- Modify: `app/api/admin/withdrawals/count/route.ts`

- [ ] **Step 1: Replace withdrawals/route.ts**

```typescript
// app/api/admin/withdrawals/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"
import { listAdminWithdrawals } from "@/lib/domains/distributors"

export async function GET(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const { searchParams } = new URL(request.url)
  const rawStatus = searchParams.get("status")
  const status =
    rawStatus === "PENDING" || rawStatus === "PAID" || rawStatus === "REJECTED"
      ? rawStatus
      : undefined
  const withdrawals = await listAdminWithdrawals(status)
  return NextResponse.json(withdrawals)
}

export const runtime = "nodejs"
```

- [ ] **Step 2: Replace withdrawals/[id]/route.ts**

```typescript
// app/api/admin/withdrawals/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, notFound, badRequest } from "@/lib/api-response"
import {
  updateWithdrawalSchema,
  processWithdrawal,
  WithdrawalNotFoundError,
  WithdrawalNotPendingError,
} from "@/lib/domains/distributors"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const { id } = await context.params
  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }
  const parsed = updateWithdrawalSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  try {
    const withdrawal = await processWithdrawal(id, parsed.data)
    return NextResponse.json(withdrawal)
  } catch (e) {
    if (e instanceof WithdrawalNotFoundError) return notFound(e.message)
    if (e instanceof WithdrawalNotPendingError) return badRequest(e.message)
    throw e
  }
}

export const runtime = "nodejs"
```

- [ ] **Step 3: Replace withdrawals/count/route.ts**

```typescript
// app/api/admin/withdrawals/count/route.ts
import { NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"
import { countPendingWithdrawals } from "@/lib/domains/distributors"

export async function GET() {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const pending = await countPendingWithdrawals()
  return NextResponse.json({ pending })
}

export const runtime = "nodejs"
```

- [ ] **Step 4: Run withdrawal tests**

```bash
npx jest --testPathPatterns="admin-distribution|withdrawals" --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/api/admin/withdrawals/route.ts" "app/api/admin/withdrawals/[id]/route.ts" "app/api/admin/withdrawals/count/route.ts"
git commit -m "refactor(admin-withdrawals): slim routes, delegate to domain service"
```

---

## Task 10: Slim admin order-distributor and distributor-report routes

**Files:**
- Modify: `app/api/admin/orders/[orderId]/distributor/route.ts`
- Modify: `app/api/admin/distributor-report/route.ts`

- [ ] **Step 1: Replace orders/[orderId]/distributor/route.ts**

```typescript
// app/api/admin/orders/[orderId]/distributor/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getSuperAdminSession } from "@/lib/auth-guard"
import { unauthorized, notFound, invalidJsonBody, validationError, badRequest, conflict, internalServerError } from "@/lib/api-response"
import {
  reassignDistributorSchema,
  reassignOrderDistributor,
  CommissionWithdrawnError,
  PendingWithdrawalBlocksReassignError,
  CommissionAlreadyPaidOutError,
} from "@/lib/domains/distributors"

type RouteContext = { params: Promise<{ orderId: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSuperAdminSession()
  if (!session) return unauthorized()
  const { orderId } = await context.params
  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }
  const parsed = reassignDistributorSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())
  try {
    await reassignOrderDistributor(orderId, parsed.data.distributorId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof CommissionWithdrawnError) return conflict(e.message)
    if (e instanceof PendingWithdrawalBlocksReassignError) return conflict(e.message)
    if (e instanceof CommissionAlreadyPaidOutError) return conflict(e.message)
    if (e instanceof Error && e.message === "ORDER_NOT_FOUND") return notFound("Order not found")
    if (e instanceof Error && e.message === "ORDER_NOT_COMPLETED") return badRequest("只能对已完成（COMPLETED）订单修改分销员")
    if (e instanceof Error && e.message === "INVALID_DISTRIBUTOR") return badRequest("Invalid distributor")
    return internalServerError()
  }
}

export const runtime = "nodejs"
```

- [ ] **Step 2: Replace distributor-report/route.ts**

```typescript
// app/api/admin/distributor-report/route.ts
import { NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, badRequest } from "@/lib/api-response"
import { fromZonedTime } from "date-fns-tz"
import { getDistributorReport } from "@/lib/domains/distributors"

const HKT = "Asia/Hong_Kong"
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidCalendarDate(y: number, m: number, d: number): boolean {
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

export async function GET(request: Request): Promise<NextResponse> {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const { searchParams } = new URL(request.url)
  const from = searchParams.get("from") ?? ""
  const to = searchParams.get("to") ?? ""
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return badRequest("from and to must be YYYY-MM-DD")
  if (from > to) return badRequest("from must not be after to")
  const [fy, fm, fd] = from.split("-").map(Number)
  const [ty, tm, td] = to.split("-").map(Number)
  if (!isValidCalendarDate(fy, fm, fd) || !isValidCalendarDate(ty, tm, td)) return badRequest("from and to must be valid calendar dates")
  const startUTC = fromZonedTime(new Date(fy, fm - 1, fd, 0, 0, 0, 0), HKT)
  const endUTC = fromZonedTime(new Date(ty, tm - 1, td + 1, 0, 0, 0, 0), HKT)
  const data = await getDistributorReport(startUTC, endUTC)
  return NextResponse.json(data)
}

export const runtime = "nodejs"
```

- [ ] **Step 3: Run related tests**

```bash
npx jest --testPathPatterns="orderId/distributor|distributor-report" --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add "app/api/admin/orders/[orderId]/distributor/route.ts" "app/api/admin/distributor-report/route.ts"
git commit -m "refactor(admin-orders-distributor): slim routes, delegate to domain service"
```

---

## Task 11: Slim distributor-side routes

**Files:**
- Modify: `app/api/distributor/commissions/route.ts`
- Modify: `app/api/distributor/withdrawals/route.ts`
- Modify: `app/api/distributor/me/route.ts`
- Modify: `app/api/distributor/invite/route.ts`
- Modify: `app/api/distributor/accept-invite/route.ts`
- Modify: `app/api/distributor/bind-inviter/route.ts`

- [ ] **Step 1: Replace distributor/commissions/route.ts**

```typescript
// app/api/distributor/commissions/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getDistributorSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"
import { listDistributorCommissions } from "@/lib/domains/distributors"

export async function GET(request: NextRequest) {
  const session = await getDistributorSession()
  if (!session) return unauthorized()
  const user = session.user as { id: string }
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)))
  const rawStatus = searchParams.get("status")
  const status =
    rawStatus === "PENDING" || rawStatus === "SETTLED" || rawStatus === "WITHDRAWN"
      ? rawStatus
      : undefined
  const data = await listDistributorCommissions(user.id, status, page, pageSize)
  return NextResponse.json(data)
}

export const runtime = "nodejs"
```

- [ ] **Step 2: Replace distributor/withdrawals/route.ts**

```typescript
// app/api/distributor/withdrawals/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getDistributorSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"
import { checkWithdrawalCreateRateLimit } from "@/lib/rate-limit"
import { uploadBinary, DEFAULT_MAX_BYTES } from "@/lib/upload"
import { config } from "@/lib/config"
import { listDistributorWithdrawals, createWithdrawal, WithdrawalOverBalanceError } from "@/lib/domains/distributors"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const

export async function GET(request: NextRequest) {
  const session = await getDistributorSession()
  if (!session) return unauthorized()
  const user = session.user as { id: string }
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)))
  const data = await listDistributorWithdrawals(user.id, page, pageSize)
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const session = await getDistributorSession()
  if (!session) return unauthorized()
  const user = session.user as { id: string }
  const rateLimitRes = await checkWithdrawalCreateRateLimit(user.id)
  if (rateLimitRes) return rateLimitRes

  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return NextResponse.json({ error: "请使用表单提交，并上传收款码图片" }, { status: 400 })
  }

  const formData = await request.formData()
  const amountStr = formData.get("amount")
  const file = formData.get("receiptImage") as File | null

  if (!amountStr || typeof amountStr !== "string") return NextResponse.json({ error: "请填写提现金额" }, { status: 400 })
  const amountRaw = parseFloat(amountStr)
  if (Number.isNaN(amountRaw) || amountRaw <= 0) return NextResponse.json({ error: "提现金额必须大于 0" }, { status: 400 })
  const amount = Math.round(amountRaw * 100) / 100
  if (amount < config.withdrawalMinAmount) return NextResponse.json({ error: `提现金额至少 ${config.withdrawalMinAmount} 元` }, { status: 400 })
  if (!file || !(file instanceof File) || file.size === 0) return NextResponse.json({ error: "请上传收款码图片" }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) return NextResponse.json({ error: "仅支持 JPG、PNG、WebP 图片" }, { status: 400 })
  if (file.size > DEFAULT_MAX_BYTES) return NextResponse.json({ error: "图片大小不能超过 4MB" }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const receiptImageUrl = await uploadBinary(buffer, { mimeType: file.type, pathPrefix: "receipts", cacheControlMaxAge: 365 * 24 * 60 * 60 })

  try {
    const w = await createWithdrawal(user.id, amount, config.withdrawalFeePercent, receiptImageUrl)
    return NextResponse.json(w, { status: 201 })
  } catch (e) {
    if (e instanceof WithdrawalOverBalanceError) {
      return NextResponse.json({ error: e.message, fieldErrors: { amount: ["超额"] } }, { status: 400 })
    }
    throw e
  }
}

export const runtime = "nodejs"
```

- [ ] **Step 3: Replace distributor/me/route.ts**

```typescript
// app/api/distributor/me/route.ts
import { NextResponse } from "next/server"
import { getDistributorSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"
import { getDistributorProfile } from "@/lib/domains/distributors"

export async function GET() {
  const session = await getDistributorSession()
  if (!session) return unauthorized()
  const user = session.user as { id: string; email?: string; name?: string; distributorCode?: string | null }
  const profile = await getDistributorProfile(user.id, user.distributorCode)
  return NextResponse.json({ id: user.id, email: user.email, name: user.name, ...profile })
}

export const runtime = "nodejs"
```

- [ ] **Step 4: Replace distributor/invite/route.ts**

```typescript
// app/api/distributor/invite/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getDistributorSession } from "@/lib/auth-guard"
import { badRequest, unauthorized, validationError } from "@/lib/api-response"
import { checkDistributorInviteRateLimit } from "@/lib/rate-limit"
import { distributorInviteSchema, sendInvite, createNoEmailInviteLink } from "@/lib/domains/distributors"

export async function POST(request: NextRequest) {
  const session = await getDistributorSession()
  if (!session) return unauthorized()
  const user = session.user as { id: string; name?: string; disabledAt?: string | null }
  if (user.disabledAt) return unauthorized("账号已停用，无法发送邀请")
  const rateLimitRes = await checkDistributorInviteRateLimit(user.id)
  if (rateLimitRes) return rateLimitRes

  let body: unknown
  try { body = await request.json() } catch { return badRequest("Invalid JSON body") }

  const hasEmail =
    typeof body === "object" && body !== null && "email" in body &&
    typeof (body as { email: unknown }).email === "string" &&
    (body as { email: string }).email.length > 0

  if (!hasEmail) {
    const result = await createNoEmailInviteLink({ inviterId: user.id })
    return NextResponse.json({ success: true, link: result.link })
  }

  const parsed = distributorInviteSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors)

  const result = await sendInvite({
    email: parsed.data.email,
    inviterId: user.id,
    inviterName: user.name ?? "分销员",
  })
  if (!result.success) {
    return badRequest(result.reason === "already_registered" ? "该邮箱已注册，无需重复邀请" : "邮件发送失败，请稍后重试")
  }
  return NextResponse.json({ success: true, email: parsed.data.email })
}

export const runtime = "nodejs"
```

- [ ] **Step 5: Replace distributor/accept-invite/route.ts**

```typescript
// app/api/distributor/accept-invite/route.ts
import { NextRequest, NextResponse } from "next/server"
import { badRequest, conflict, notFound, validationError } from "@/lib/api-response"
import { checkAcceptInviteRateLimit } from "@/lib/rate-limit"
import {
  acceptInviteSchema,
  acceptNoEmailInviteSchema,
  acceptInvite,
  InviteTokenNotFoundError,
  InviteTokenUsedError,
  InviteTokenExpiredError,
  UsernameConflictError,
  EmailAlreadyRegisteredError,
} from "@/lib/domains/distributors"

export async function POST(request: NextRequest) {
  const rateLimitRes = await checkAcceptInviteRateLimit(request)
  if (rateLimitRes) return rateLimitRes

  let body: unknown
  try { body = await request.json() } catch { return badRequest("Invalid JSON body") }

  const parsed = acceptInviteSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors)

  // Determine if no-email invite and extract username if needed
  const noEmailParsed = acceptNoEmailInviteSchema.safeParse(body)
  const username = noEmailParsed.success ? noEmailParsed.data.username : undefined

  try {
    await acceptInvite(parsed.data.token, { ...parsed.data, username })
    return NextResponse.json({ success: true })
  } catch (e) {
    if (e instanceof InviteTokenNotFoundError) return notFound(e.message)
    if (e instanceof InviteTokenUsedError) return conflict(e.message)
    if (e instanceof InviteTokenExpiredError) return badRequest(e.message, { code: "INVITE_EXPIRED" })
    if (e instanceof UsernameConflictError) return conflict(e.message)
    if (e instanceof EmailAlreadyRegisteredError) return badRequest(e.message)
    if (e instanceof Error && e.message.includes("P2002")) return conflict("注册冲突，请重试")
    throw e
  }
}

export const runtime = "nodejs"
```

- [ ] **Step 6: Replace distributor/bind-inviter/route.ts**

```typescript
// app/api/distributor/bind-inviter/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getDistributorSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"
import { bindInviterSchema, bindInviter, InviterCodeInvalidError, SelfInviterError } from "@/lib/domains/distributors"

export async function POST(request: NextRequest) {
  const session = await getDistributorSession()
  if (!session) return unauthorized()
  const user = session.user as { id: string }
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: "请求体无效" }, { status: 400 }) }
  const parsed = bindInviterSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().formErrors?.[0] ?? "参数错误" }, { status: 400 })
  try {
    await bindInviter(user.id, parsed.data.inviteCode)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof InviterCodeInvalidError) return NextResponse.json({ error: e.message }, { status: 400 })
    if (e instanceof SelfInviterError) return NextResponse.json({ error: e.message }, { status: 400 })
    throw e
  }
}

export const runtime = "nodejs"
```

- [ ] **Step 7: Run distributor-side tests**

```bash
npx jest --testPathPatterns="distributor\.(test|spec)|distributor-accept|distributor-bind|distributor-invite-by" --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add \
  "app/api/distributor/commissions/route.ts" \
  "app/api/distributor/withdrawals/route.ts" \
  "app/api/distributor/me/route.ts" \
  "app/api/distributor/invite/route.ts" \
  "app/api/distributor/accept-invite/route.ts" \
  "app/api/distributor/bind-inviter/route.ts"
git commit -m "refactor(distributor): slim all distributor-side routes, delegate to domain service"
```

---

## Task 12: Create lib re-export shims

**Files:**
- Modify: `lib/calculate-order-commission.ts`
- Modify: `lib/distributor-tier-summary.ts`
- Modify: `lib/send-distributor-invitation.ts`
- Modify: `lib/create-no-email-invite-link.ts`
- Modify: `lib/validations/distributor-invite.ts`

- [ ] **Step 1: Replace lib/calculate-order-commission.ts**

```typescript
// lib/calculate-order-commission.ts
// Re-exported from domain module. Import directly from @/lib/domains/distributors instead.
export { toNumber, getWeekStart, createOrderCommissions } from "@/lib/domains/distributors"
export type { CreateOrderCommissionsParams } from "@/lib/domains/distributors"
```

- [ ] **Step 2: Replace lib/distributor-tier-summary.ts**

```typescript
// lib/distributor-tier-summary.ts
// Re-exported from domain module. Import directly from @/lib/domains/distributors instead.
export { adjustRate, getDistributorTierSummary } from "@/lib/domains/distributors"
export type { TierSummaryItem, DistributorTierSummary } from "@/lib/domains/distributors"
```

- [ ] **Step 3: Replace lib/send-distributor-invitation.ts**

```typescript
// lib/send-distributor-invitation.ts
// Re-exported from domain module. Import directly from @/lib/domains/distributors instead.
export { sendInvite as sendDistributorInvitation } from "@/lib/domains/distributors"
export type { SendInviteResult as SendDistributorInvitationResult } from "@/lib/domains/distributors"
```

- [ ] **Step 4: Replace lib/create-no-email-invite-link.ts**

```typescript
// lib/create-no-email-invite-link.ts
// Re-exported from domain module. Import directly from @/lib/domains/distributors instead.
export { createNoEmailInviteLink } from "@/lib/domains/distributors"
```

- [ ] **Step 5: Replace lib/validations/distributor-invite.ts**

```typescript
// lib/validations/distributor-invite.ts
// Re-exported from domain module. Import directly from @/lib/domains/distributors instead.
export {
  distributorInviteSchema,
  acceptInviteSchema,
  acceptNoEmailInviteSchema,
  usernameSchema,
  bindInviterSchema,
} from "@/lib/domains/distributors"
export type {
  DistributorInviteInput,
  AcceptInviteInput,
  AcceptNoEmailInviteInput,
  BindInviterInput,
} from "@/lib/domains/distributors"
```

- [ ] **Step 6: Commit**

```bash
git add \
  lib/calculate-order-commission.ts \
  lib/distributor-tier-summary.ts \
  lib/send-distributor-invitation.ts \
  lib/create-no-email-invite-link.ts \
  lib/validations/distributor-invite.ts
git commit -m "refactor(distributors): redirect lib shims to domain module"
```

---

## Task 13: Run full test suite

- [ ] **Step 1: Run all distributor-related tests**

```bash
npx jest --testPathPatterns="distributor|commission|withdrawal|complete-pending-order|create-no-email" --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 2: Run full test suite**

```bash
npm test -- --no-coverage
```

Expected: No new failures. All previously passing tests still pass.

- [ ] **Step 3: Final commit**

```bash
git commit --allow-empty -m "feat(distributors-domain): pilot complete — FSD functional domain module"
```
