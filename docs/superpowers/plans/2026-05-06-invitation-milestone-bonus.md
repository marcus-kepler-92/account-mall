# Invitation Milestone Bonus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a milestone bonus system that rewards distributors with a configurable one-time bonus when their invitees reach cumulative sales thresholds, stored separately from commissions to keep existing statistics clean.

**Architecture:** Two new Prisma models (`InvitationMilestone` for admin-configured tiers, `InvitationMilestoneBonus` for payout records) + a `checkAndIssueMilestoneBonuses` function called inside the existing `completePendingOrder` transaction. Balance is extended at all 7 compute sites to include bonus totals; commission statistics are untouched.

**Tech Stack:** Prisma 6, PostgreSQL, Next.js 16 App Router, React 19 RSC, shadcn/ui, Zod, TanStack Table, Jest

---

## File Map

**New files:**
- `prisma/migrations/<timestamp>_invitation_milestone/migration.sql` — auto-generated
- `lib/domains/distributors/milestone-service.ts` — `checkAndIssueMilestoneBonuses` + milestone CRUD
- `app/api/admin/invitation-milestones/route.ts` — GET + POST
- `app/api/admin/invitation-milestones/[id]/route.ts` — PATCH + DELETE
- `app/api/distributor/milestone-bonuses/route.ts` — GET (paginated list for current distributor)
- `app/admin/(main)/invitation-milestones/page.tsx`
- `app/admin/(main)/invitation-milestones/loading.tsx`
- `app/admin/(main)/invitation-milestones/invitation-milestones-columns.tsx`
- `app/admin/(main)/invitation-milestones/invitation-milestones-data-table.tsx`
- `app/admin/(main)/invitation-milestones/invitation-milestones-row-actions.tsx`
- `app/admin/(main)/invitation-milestones/add-milestone-dialog.tsx`
- `app/admin/(main)/invitation-milestones/edit-milestone-dialog.tsx`
- `__tests__/domains/distributors/milestone-service.test.ts`

**Modified files:**
- `prisma/schema.prisma` — add two models + User relations
- `lib/domains/distributors/repository.ts` — add `aggregateMilestoneBonusSum`
- `lib/domains/distributors/types.ts` — add `MilestoneRow`, `MilestoneBonusRow`, error classes
- `lib/domains/distributors/validators.ts` — add milestone schemas
- `lib/domains/distributors/index.ts` — re-export new symbols
- `lib/complete-pending-order.ts` — call `checkAndIssueMilestoneBonuses` in transaction
- `lib/domains/distributors/service.ts` — update 4 balance calculation sites
- `app/distributor/(main)/page.tsx` — update balance calculation (site 5)
- `app/distributor/(main)/commissions/page.tsx` — update balance calculation (site 6) + add bonus records section
- `app/distributor/(main)/commissions/commissions-balance-section.tsx` — add `milestoneBonusTotal` prop
- `app/distributor/(main)/invitees/page.tsx` — add milestone progress per invitee
- `app/distributor/(main)/invitees/invitees-columns.tsx` — extend `InviteeRow` type
- `app/components/admin-sidebar.tsx` — add nav item

---

## Task 1: Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add models to schema**

In `prisma/schema.prisma`, after the `DistributorInvitation` model, add:

```prisma
model InvitationMilestone {
  id              String   @id @default(cuid())
  thresholdAmount Decimal  @db.Decimal(12, 2)
  bonusAmount     Decimal  @db.Decimal(10, 2)
  sortOrder       Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  bonuses         InvitationMilestoneBonus[]

  @@index([sortOrder])
  @@index([thresholdAmount])
}

model InvitationMilestoneBonus {
  id                String   @id @default(cuid())
  inviterId         String
  inviteeId         String
  milestoneId       String
  thresholdSnapshot Decimal  @db.Decimal(12, 2)
  amount            Decimal  @db.Decimal(10, 2)
  createdAt         DateTime @default(now())

  inviter   User                @relation("InviterMilestoneBonuses", fields: [inviterId], references: [id])
  invitee   User                @relation("InviteeMilestoneBonuses", fields: [inviteeId], references: [id])
  milestone InvitationMilestone @relation(fields: [milestoneId], references: [id])

  @@unique([inviteeId, milestoneId])
  @@index([inviterId])
  @@index([inviteeId])
  @@index([milestoneId])
}
```

Also add the two back-relations to the `User` model (after the existing `distributorInvitationsSent` line):

```prisma
  inviterMilestoneBonuses InvitationMilestoneBonus[] @relation("InviterMilestoneBonuses")
  inviteeMilestoneBonuses InvitationMilestoneBonus[] @relation("InviteeMilestoneBonuses")
```

- [ ] **Step 2: Generate migration**

```bash
npm run db:migrate
# Prompt: "add_invitation_milestone"
```

Expected: new migration file created under `prisma/migrations/`, Prisma Client regenerated with `InvitationMilestone` and `InvitationMilestoneBonus` types.

- [ ] **Step 3: Verify types available**

```bash
npx tsc --noEmit
```

Expected: no errors relating to the new models.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add InvitationMilestone and InvitationMilestoneBonus models"
```

---

## Task 2: Types, Validators, Repository Helper

**Files:**
- Modify: `lib/domains/distributors/types.ts`
- Modify: `lib/domains/distributors/validators.ts`
- Modify: `lib/domains/distributors/repository.ts`
- Modify: `lib/domains/distributors/index.ts`

- [ ] **Step 1: Add types and error classes to `types.ts`**

Append to `lib/domains/distributors/types.ts`:

```typescript
export type MilestoneRow = {
  id: string
  thresholdAmount: number
  bonusAmount: number
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

export type MilestoneBonusRow = {
  id: string
  inviteeId: string
  inviteeName: string
  thresholdSnapshot: number
  amount: number
  createdAt: Date
}

export class InvitationMilestoneNotFoundError extends Error {
  constructor(id: string) {
    super(`InvitationMilestone ${id} not found`)
    this.name = "InvitationMilestoneNotFoundError"
  }
}

export class InvitationMilestoneHasBonusesError extends Error {
  constructor() {
    super("该档位已有奖励发放记录，不可删除")
    this.name = "InvitationMilestoneHasBonusesError"
  }
}
```

- [ ] **Step 2: Add Zod schemas to `validators.ts`**

In `lib/domains/distributors/validators.ts`, append:

```typescript
export const createMilestoneSchema = z.object({
  thresholdAmount: z.number().positive("门槛金额必须大于 0"),
  bonusAmount: z.number().positive("奖励金额必须大于 0"),
})

export const updateMilestoneSchema = createMilestoneSchema.partial()

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>
```

- [ ] **Step 3: Add repository helper to `repository.ts`**

In `lib/domains/distributors/repository.ts`, after `aggregateWithdrawalSum`, add:

```typescript
export async function aggregateMilestoneBonusSum(distributorId: string) {
  const r = await prisma.invitationMilestoneBonus.aggregate({
    where: { inviterId: distributorId },
    _sum: { amount: true },
  })
  return Number(r._sum.amount ?? 0)
}
```

- [ ] **Step 4: Re-export new symbols from `index.ts`**

In `lib/domains/distributors/index.ts`, add the following exports (alongside the existing ones):

```typescript
// Milestone CRUD (will be added in Task 3)
export {
  listInvitationMilestones,
  createInvitationMilestone,
  updateInvitationMilestone,
  deleteInvitationMilestone,
  listDistributorMilestoneBonuses,
  checkAndIssueMilestoneBonuses,
} from "./milestone-service"

export type { CreateMilestoneInput, UpdateMilestoneInput } from "./validators"
export type { MilestoneRow, MilestoneBonusRow } from "./types"
export {
  InvitationMilestoneNotFoundError,
  InvitationMilestoneHasBonusesError,
} from "./types"
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: errors only for missing `milestone-service` module (to be created next). No other new errors.

- [ ] **Step 6: Commit**

```bash
git add lib/domains/distributors/types.ts lib/domains/distributors/validators.ts \
        lib/domains/distributors/repository.ts lib/domains/distributors/index.ts
git commit -m "feat(distributors): add milestone types, validators, and repository helper"
```

---

## Task 3: `checkAndIssueMilestoneBonuses` + Milestone CRUD (TDD)

**Files:**
- Create: `lib/domains/distributors/milestone-service.ts`
- Create: `__tests__/domains/distributors/milestone-service.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/domains/distributors/milestone-service.test.ts`:

```typescript
jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../../__mocks__/prisma")
  return { __esModule: true, prisma: prismaMock }
})

import type { Prisma } from "@prisma/client"
import { checkAndIssueMilestoneBonuses } from "@/lib/domains/distributors/milestone-service"
import { prismaMock } from "../../../__mocks__/prisma"
import {
  InvitationMilestoneNotFoundError,
  InvitationMilestoneHasBonusesError,
} from "@/lib/domains/distributors/types"
import {
  listInvitationMilestones,
  createInvitationMilestone,
  updateInvitationMilestone,
  deleteInvitationMilestone,
} from "@/lib/domains/distributors/milestone-service"

beforeEach(() => jest.clearAllMocks())

// ── Helper ────────────────────────────────────────────────────────────────────

function makeTx(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    user: { findUnique: jest.fn() },
    invitationMilestone: { findMany: jest.fn() },
    invitationMilestoneBonus: { findMany: jest.fn(), create: jest.fn() },
    order: { aggregate: jest.fn() },
    ...overrides,
  } as unknown as Prisma.TransactionClient
}

const BASE_MILESTONE = {
  id: "m1",
  thresholdAmount: 500,
  bonusAmount: 20,
  sortOrder: 0,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
}

// ── checkAndIssueMilestoneBonuses ─────────────────────────────────────────────

describe("checkAndIssueMilestoneBonuses", () => {
  it("skips when invitee has no inviter", async () => {
    const tx = makeTx()
    ;(tx.user.findUnique as jest.Mock).mockResolvedValue({ inviterId: null })
    await checkAndIssueMilestoneBonuses(tx, "invitee1")
    expect(tx.invitationMilestone.findMany).not.toHaveBeenCalled()
  })

  it("skips when inviter is ADMIN", async () => {
    const tx = makeTx()
    ;(tx.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ inviterId: "inviter1" })
      .mockResolvedValueOnce({ role: "ADMIN", disabledAt: null })
    await checkAndIssueMilestoneBonuses(tx, "invitee1")
    expect(tx.invitationMilestone.findMany).not.toHaveBeenCalled()
  })

  it("skips when inviter is disabled", async () => {
    const tx = makeTx()
    ;(tx.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ inviterId: "inviter1" })
      .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: new Date() })
    await checkAndIssueMilestoneBonuses(tx, "invitee1")
    expect(tx.invitationMilestone.findMany).not.toHaveBeenCalled()
  })

  it("skips when no milestones configured", async () => {
    const tx = makeTx()
    ;(tx.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ inviterId: "inviter1" })
      .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: null })
    ;(tx.invitationMilestone.findMany as jest.Mock).mockResolvedValue([])
    await checkAndIssueMilestoneBonuses(tx, "invitee1")
    expect(tx.invitationMilestoneBonus.findMany).not.toHaveBeenCalled()
  })

  it("inserts bonus when cumulative sales cross threshold", async () => {
    const tx = makeTx()
    ;(tx.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ inviterId: "inviter1" })
      .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: null })
    ;(tx.invitationMilestone.findMany as jest.Mock).mockResolvedValue([BASE_MILESTONE])
    ;(tx.invitationMilestoneBonus.findMany as jest.Mock).mockResolvedValue([])
    ;(tx.order.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 600 } })
    ;(tx.invitationMilestoneBonus.create as jest.Mock).mockResolvedValue({})

    await checkAndIssueMilestoneBonuses(tx, "invitee1")

    expect(tx.invitationMilestoneBonus.create).toHaveBeenCalledWith({
      data: {
        inviterId: "inviter1",
        inviteeId: "invitee1",
        milestoneId: "m1",
        thresholdSnapshot: 500,
        amount: 20,
      },
    })
  })

  it("does not insert when cumulative sales below threshold", async () => {
    const tx = makeTx()
    ;(tx.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ inviterId: "inviter1" })
      .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: null })
    ;(tx.invitationMilestone.findMany as jest.Mock).mockResolvedValue([BASE_MILESTONE])
    ;(tx.invitationMilestoneBonus.findMany as jest.Mock).mockResolvedValue([])
    ;(tx.order.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 400 } })

    await checkAndIssueMilestoneBonuses(tx, "invitee1")

    expect(tx.invitationMilestoneBonus.create).not.toHaveBeenCalled()
  })

  it("inserts multiple bonuses when multiple milestones crossed", async () => {
    const m2 = { ...BASE_MILESTONE, id: "m2", thresholdAmount: 1000, bonusAmount: 50 }
    const tx = makeTx()
    ;(tx.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ inviterId: "inviter1" })
      .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: null })
    ;(tx.invitationMilestone.findMany as jest.Mock).mockResolvedValue([BASE_MILESTONE, m2])
    ;(tx.invitationMilestoneBonus.findMany as jest.Mock).mockResolvedValue([])
    ;(tx.order.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 1500 } })
    ;(tx.invitationMilestoneBonus.create as jest.Mock).mockResolvedValue({})

    await checkAndIssueMilestoneBonuses(tx, "invitee1")

    expect(tx.invitationMilestoneBonus.create).toHaveBeenCalledTimes(2)
  })

  it("skips already-triggered milestones (idempotent)", async () => {
    const tx = makeTx()
    ;(tx.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ inviterId: "inviter1" })
      .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: null })
    ;(tx.invitationMilestone.findMany as jest.Mock).mockResolvedValue([BASE_MILESTONE])
    ;(tx.invitationMilestoneBonus.findMany as jest.Mock).mockResolvedValue([
      { milestoneId: "m1" },
    ])

    await checkAndIssueMilestoneBonuses(tx, "invitee1")

    expect(tx.order.aggregate).not.toHaveBeenCalled()
    expect(tx.invitationMilestoneBonus.create).not.toHaveBeenCalled()
  })

  it("does not count orders before milestone.createdAt", async () => {
    const tx = makeTx()
    ;(tx.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ inviterId: "inviter1" })
      .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: null })
    ;(tx.invitationMilestone.findMany as jest.Mock).mockResolvedValue([BASE_MILESTONE])
    ;(tx.invitationMilestoneBonus.findMany as jest.Mock).mockResolvedValue([])
    ;(tx.order.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 0 } })

    await checkAndIssueMilestoneBonuses(tx, "invitee1")

    // Verify the aggregate was called with the paidAt >= createdAt filter
    expect(tx.order.aggregate).toHaveBeenCalledWith({
      where: {
        distributorId: "invitee1",
        status: "COMPLETED",
        paidAt: { gte: BASE_MILESTONE.createdAt },
      },
      _sum: { amount: true },
    })
    expect(tx.invitationMilestoneBonus.create).not.toHaveBeenCalled()
  })

  it("ignores P2002 unique constraint error (concurrent trigger safety)", async () => {
    const tx = makeTx()
    ;(tx.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ inviterId: "inviter1" })
      .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: null })
    ;(tx.invitationMilestone.findMany as jest.Mock).mockResolvedValue([BASE_MILESTONE])
    ;(tx.invitationMilestoneBonus.findMany as jest.Mock).mockResolvedValue([])
    ;(tx.order.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 600 } })
    ;(tx.invitationMilestoneBonus.create as jest.Mock).mockRejectedValue({ code: "P2002" })

    await expect(checkAndIssueMilestoneBonuses(tx, "invitee1")).resolves.toBeUndefined()
  })

  it("rethrows non-P2002 errors", async () => {
    const tx = makeTx()
    ;(tx.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ inviterId: "inviter1" })
      .mockResolvedValueOnce({ role: "DISTRIBUTOR", disabledAt: null })
    ;(tx.invitationMilestone.findMany as jest.Mock).mockResolvedValue([BASE_MILESTONE])
    ;(tx.invitationMilestoneBonus.findMany as jest.Mock).mockResolvedValue([])
    ;(tx.order.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 600 } })
    ;(tx.invitationMilestoneBonus.create as jest.Mock).mockRejectedValue(new Error("DB error"))

    await expect(checkAndIssueMilestoneBonuses(tx, "invitee1")).rejects.toThrow("DB error")
  })
})

// ── Milestone CRUD ────────────────────────────────────────────────────────────

describe("listInvitationMilestones", () => {
  it("returns serialized milestones ordered by thresholdAmount", async () => {
    prismaMock.invitationMilestone.findMany.mockResolvedValue([
      { id: "m1", thresholdAmount: "500.00", bonusAmount: "20.00", sortOrder: 0, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01") },
    ] as never)
    const rows = await listInvitationMilestones()
    expect(rows).toHaveLength(1)
    expect(rows[0].thresholdAmount).toBe(500)
    expect(rows[0].bonusAmount).toBe(20)
  })
})

describe("createInvitationMilestone", () => {
  it("creates a milestone and returns serialized row", async () => {
    prismaMock.invitationMilestone.create.mockResolvedValue({
      id: "m1", thresholdAmount: "500.00", bonusAmount: "20.00", sortOrder: 0,
      createdAt: new Date(), updatedAt: new Date(),
    } as never)
    const row = await createInvitationMilestone({ thresholdAmount: 500, bonusAmount: 20 })
    expect(row.thresholdAmount).toBe(500)
  })
})

describe("deleteInvitationMilestone", () => {
  it("throws InvitationMilestoneNotFoundError when not found", async () => {
    prismaMock.invitationMilestone.findUnique.mockResolvedValue(null)
    await expect(deleteInvitationMilestone("bad-id")).rejects.toThrow(InvitationMilestoneNotFoundError)
  })

  it("throws InvitationMilestoneHasBonusesError when bonuses exist", async () => {
    prismaMock.invitationMilestone.findUnique.mockResolvedValue({ id: "m1" } as never)
    prismaMock.invitationMilestoneBonus.count.mockResolvedValue(1)
    await expect(deleteInvitationMilestone("m1")).rejects.toThrow(InvitationMilestoneHasBonusesError)
  })

  it("deletes milestone when no bonuses exist", async () => {
    prismaMock.invitationMilestone.findUnique.mockResolvedValue({ id: "m1" } as never)
    prismaMock.invitationMilestoneBonus.count.mockResolvedValue(0)
    prismaMock.invitationMilestone.delete.mockResolvedValue({ id: "m1" } as never)
    await deleteInvitationMilestone("m1")
    expect(prismaMock.invitationMilestone.delete).toHaveBeenCalledWith({ where: { id: "m1" } })
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx jest __tests__/domains/distributors/milestone-service.test.ts --no-coverage
```

Expected: fails with "Cannot find module `.../milestone-service`"

- [ ] **Step 3: Implement `milestone-service.ts`**

Create `lib/domains/distributors/milestone-service.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest __tests__/domains/distributors/milestone-service.test.ts --no-coverage
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/domains/distributors/milestone-service.ts \
        __tests__/domains/distributors/milestone-service.test.ts
git commit -m "feat(distributors): add milestone service and tests"
```

---

## Task 4: Wire `checkAndIssueMilestoneBonuses` into `completePendingOrder`

**Files:**
- Modify: `lib/complete-pending-order.ts`

- [ ] **Step 1: Update the import**

In `lib/complete-pending-order.ts`, add to the existing imports:

```typescript
import { checkAndIssueMilestoneBonuses } from "@/lib/domains/distributors"
```

- [ ] **Step 2: Call the function inside the transaction**

Find the block (around line 66-78):

```typescript
    // Commission: only when we actually completed this order and order has a distributor
    if (!didUpdate) return;
    const distributorId = order.distributorId;
    if (distributorId) {
      await createOrderCommissions(tx, {
        orderId: order.id,
        distributorId,
        orderEmail: order.email ?? "",
        orderAmount: order.amount,
        discountPercentApplied: order.discountPercentApplied,
        paidAt,
      });
    }
```

Replace with:

```typescript
    // Commission: only when we actually completed this order and order has a distributor
    if (!didUpdate) return;
    const distributorId = order.distributorId;
    if (distributorId) {
      await createOrderCommissions(tx, {
        orderId: order.id,
        distributorId,
        orderEmail: order.email ?? "",
        orderAmount: order.amount,
        discountPercentApplied: order.discountPercentApplied,
        paidAt,
      });
      await checkAndIssueMilestoneBonuses(tx, distributorId);
    }
```

- [ ] **Step 3: Type-check and run existing tests**

```bash
npx tsc --noEmit && npx jest --no-coverage
```

Expected: no type errors, all existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add lib/complete-pending-order.ts
git commit -m "feat: trigger milestone bonus check on order completion"
```

---

## Task 5: Update All Balance Calculation Sites

**Files:**
- Modify: `lib/domains/distributors/service.ts` (4 sites)
- Modify: `app/distributor/(main)/page.tsx` (1 site)
- Modify: `app/distributor/(main)/commissions/page.tsx` (1 site)

- [ ] **Step 1: Add import in `service.ts`**

At the top of `lib/domains/distributors/service.ts`, add to existing imports from `./repository`:

```typescript
import * as repo from "./repository"
// repo.aggregateMilestoneBonusSum is now available
```

(No change needed if `import * as repo` already exists — it does. The new function was added to repository.ts in Task 2.)

- [ ] **Step 2: Update `listDistributors` in `service.ts` (line ~143)**

Find:
```typescript
      const [completedOrderCount, settled, paid, pending] = await Promise.all([
        prisma.order.count({ where: { distributorId: d.id, status: "COMPLETED" } }),
        repo.aggregateCommissionSum(d.id, "SETTLED"),
        repo.aggregateWithdrawalSum(d.id, "PAID"),
        repo.aggregateWithdrawalSum(d.id, "PENDING"),
      ])
      return {
        ...
        withdrawableBalance: Math.round((settled - paid - pending) * 100) / 100,
```

Replace with:
```typescript
      const [completedOrderCount, settled, paid, pending, bonuses] = await Promise.all([
        prisma.order.count({ where: { distributorId: d.id, status: "COMPLETED" } }),
        repo.aggregateCommissionSum(d.id, "SETTLED"),
        repo.aggregateWithdrawalSum(d.id, "PAID"),
        repo.aggregateWithdrawalSum(d.id, "PENDING"),
        repo.aggregateMilestoneBonusSum(d.id),
      ])
      return {
        ...
        withdrawableBalance: Math.round((settled + bonuses - paid - pending) * 100) / 100,
```

- [ ] **Step 3: Update `getDistributorProfile` in `service.ts` (line ~329)**

Find:
```typescript
  const [settled, paid, pending, tierSummary] = await Promise.all([
    repo.aggregateCommissionSum(userId, "SETTLED"),
    repo.aggregateWithdrawalSum(userId, "PAID"),
    repo.aggregateWithdrawalSum(userId, "PENDING"),
    getDistributorTierSummary(userId, level2Rate),
  ])

  const withdrawableBalance = Math.round((settled - paid - pending) * 100) / 100
```

Replace with:
```typescript
  const [settled, paid, pending, bonuses, tierSummary] = await Promise.all([
    repo.aggregateCommissionSum(userId, "SETTLED"),
    repo.aggregateWithdrawalSum(userId, "PAID"),
    repo.aggregateWithdrawalSum(userId, "PENDING"),
    repo.aggregateMilestoneBonusSum(userId),
    getDistributorTierSummary(userId, level2Rate),
  ])

  const withdrawableBalance = Math.round((settled + bonuses - paid - pending) * 100) / 100
```

- [ ] **Step 4: Update `listDistributorCommissions` in `service.ts` (line ~495)**

Find:
```typescript
  const [commissions, total, settled, paid, pending] = await Promise.all([
    repo.findCommissions(distributorId, status, skip, pageSize),
    repo.countCommissions(distributorId, status),
    repo.aggregateCommissionSum(distributorId, "SETTLED"),
    repo.aggregateWithdrawalSum(distributorId, "PAID"),
    repo.aggregateWithdrawalSum(distributorId, "PENDING"),
  ])
  const withdrawableBalance = Math.round((settled - paid - pending) * 100) / 100
```

Replace with:
```typescript
  const [commissions, total, settled, paid, pending, bonuses] = await Promise.all([
    repo.findCommissions(distributorId, status, skip, pageSize),
    repo.countCommissions(distributorId, status),
    repo.aggregateCommissionSum(distributorId, "SETTLED"),
    repo.aggregateWithdrawalSum(distributorId, "PAID"),
    repo.aggregateWithdrawalSum(distributorId, "PENDING"),
    repo.aggregateMilestoneBonusSum(distributorId),
  ])
  const withdrawableBalance = Math.round((settled + bonuses - paid - pending) * 100) / 100
```

- [ ] **Step 5: Update `createWithdrawal` balance guard in `service.ts` (line ~544)**

Find:
```typescript
  const [settled, paid, pending] = await Promise.all([
    repo.aggregateCommissionSum(distributorId, "SETTLED"),
    repo.aggregateWithdrawalSum(distributorId, "PAID"),
    repo.aggregateWithdrawalSum(distributorId, "PENDING"),
  ])
  const balance = Math.round((settled - paid - pending) * 100) / 100
```

Replace with:
```typescript
  const [settled, paid, pending, bonuses] = await Promise.all([
    repo.aggregateCommissionSum(distributorId, "SETTLED"),
    repo.aggregateWithdrawalSum(distributorId, "PAID"),
    repo.aggregateWithdrawalSum(distributorId, "PENDING"),
    repo.aggregateMilestoneBonusSum(distributorId),
  ])
  const balance = Math.round((settled + bonuses - paid - pending) * 100) / 100
```

- [ ] **Step 6: Update `app/distributor/(main)/page.tsx`**

In `app/distributor/(main)/page.tsx`, add to the `Promise.all` block (after `inviteeCount`):

```typescript
    prisma.invitationMilestoneBonus.aggregate({
      where: { inviterId: user.id },
      _sum: { amount: true },
    }),
```

So the destructuring becomes:
```typescript
  const [
    orderCount,
    level1Sum,
    level2Sum,
    paidSum,
    pendingSum,
    tierSummary,
    inviteeCount,
    selfUser,
    milestoneBonusSum,
  ] = await Promise.all([
    prisma.order.count({ where: { distributorId: user.id, status: "COMPLETED" } }),
    prisma.commission.aggregate({ where: { distributorId: user.id, level: 1 }, _sum: { amount: true } }),
    prisma.commission.aggregate({ where: { distributorId: user.id, level: 2 }, _sum: { amount: true } }),
    prisma.withdrawal.aggregate({ where: { distributorId: user.id, status: "PAID" }, _sum: { amount: true } }),
    prisma.withdrawal.aggregate({ where: { distributorId: user.id, status: "PENDING" }, _sum: { amount: true } }),
    getDistributorTierSummary(user.id, level2Rate),
    prisma.user.count({ where: { inviterId: user.id } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { discountCodeEnabled: true, discountPercent: true } }),
    prisma.invitationMilestoneBonus.aggregate({ where: { inviterId: user.id }, _sum: { amount: true } }),
  ])
```

Then update the two level-settled aggregates and balance calculation (which currently run as separate awaits after the main Promise.all — keep them as is but update the final formula):

Find:
```typescript
  const withdrawableBalance =
    level1Settled + level2Settled - paidTotal - pendingTotal;
```

Replace with:
```typescript
  const milestoneBonusTotal = Number(milestoneBonusSum._sum.amount ?? 0)
  const withdrawableBalance =
    level1Settled + level2Settled + milestoneBonusTotal - paidTotal - pendingTotal;
```

- [ ] **Step 7: Update `app/distributor/(main)/commissions/page.tsx`**

Add to the `Promise.all` destructuring (after `inviteeCount`):

```typescript
    prisma.invitationMilestoneBonus.aggregate({
      where: { inviterId: user.id },
      _sum: { amount: true },
    }),
```

Destructuring becomes:
```typescript
  const [
    commissions,
    total,
    statusCounts,
    level1Settled,
    level2Settled,
    paidSum,
    pendingSum,
    tierSummary,
    inviteeCount,
    milestoneBonusSum,
  ] = await Promise.all([...existing..., prisma.invitationMilestoneBonus.aggregate({ where: { inviterId: user.id }, _sum: { amount: true } })])
```

Update balance formula:
```typescript
  const milestoneBonusTotal =
      Number(milestoneBonusSum._sum.amount ?? 0)
  const withdrawableBalance =
      level1SettledTotal + level2SettledTotal + milestoneBonusTotal - paidTotal - pendingWithdrawalTotal
```

Pass new prop to `CommissionsBalanceSection`:
```tsx
  <CommissionsBalanceSection
      level1Settled={level1SettledTotal}
      level2Settled={level2SettledTotal}
      milestoneBonusTotal={milestoneBonusTotal}
      paidTotal={paidTotal}
      pendingTotal={pendingWithdrawalTotal}
      withdrawableBalance={withdrawableBalance}
      inviteeCount={inviteeCount}
      minAmount={config.withdrawalMinAmount}
      feePercent={config.withdrawalFeePercent}
  />
```

- [ ] **Step 8: Fix existing `service.test.ts` — add mock for new repo function**

`jest.mock("../repository")` auto-mocks all exports, so `aggregateMilestoneBonusSum` gets mocked as `jest.fn()` returning `undefined`. `Number(undefined) === NaN`, which will break all balance-related tests.

In `lib/domains/distributors/__tests__/service.test.ts`, find every `beforeEach` or test block that sets up `aggregateCommissionSum` / `aggregateWithdrawalSum` mocks for `createWithdrawal`, `listDistributors`, or `getDistributorProfile`, and add:

```typescript
;(repo.aggregateMilestoneBonusSum as jest.Mock).mockResolvedValue(0)
```

For example, any test that calls `createWithdrawal` and mocks repo functions should now look like:

```typescript
;(repo.aggregateCommissionSum as jest.Mock).mockResolvedValue(100)
;(repo.aggregateWithdrawalSum as jest.Mock).mockResolvedValue(0)
;(repo.aggregateMilestoneBonusSum as jest.Mock).mockResolvedValue(0)  // ADD THIS
```

- [ ] **Step 9: Run existing tests — verify all pass**

```bash
npx jest lib/domains/distributors/__tests__/service.test.ts --no-coverage
```

Expected: all pass.

- [ ] **Step 10: Type-check**

```bash
npx tsc --noEmit
```

Expected: type error on `CommissionsBalanceSection` missing `milestoneBonusTotal` prop (will fix in Task 6).

- [ ] **Step 11: Commit**

```bash
git add lib/domains/distributors/service.ts \
        lib/domains/distributors/__tests__/service.test.ts \
        app/distributor/\(main\)/page.tsx \
        app/distributor/\(main\)/commissions/page.tsx
git commit -m "feat: include milestone bonuses in withdrawable balance calculations"
```

---

## Task 6: Update `CommissionsBalanceSection`

**Files:**
- Modify: `app/distributor/(main)/commissions/commissions-balance-section.tsx`

- [ ] **Step 1: Add `milestoneBonusTotal` prop and update formula string**

In `commissions-balance-section.tsx`, update the interface and the description string:

```typescript
interface CommissionsBalanceSectionProps {
  level1Settled: number;
  level2Settled: number;
  milestoneBonusTotal: number;   // NEW
  paidTotal: number;
  pendingTotal: number;
  withdrawableBalance: number;
  inviteeCount: number;
  minAmount: number;
  feePercent?: number;
}

export function CommissionsBalanceSection({
  level1Settled,
  level2Settled,
  milestoneBonusTotal,            // NEW
  paidTotal,
  pendingTotal,
  withdrawableBalance,
  inviteeCount,
  minAmount,
  feePercent = 0,
}: CommissionsBalanceSectionProps) {
```

Update `CardDescription` text (currently around line 41):
```tsx
<CardDescription>
  （推广奖金 ¥{level1Settled.toFixed(2)} + 团队奖金 ¥{level2Settled.toFixed(2)}
  {milestoneBonusTotal > 0 && ` + 邀请奖励 ¥${milestoneBonusTotal.toFixed(2)}`}）
  − 已打款 ¥{paidTotal.toFixed(2)} − 提现中 ¥{pendingTotal.toFixed(2)} = 可提现余额
  {feePercent > 0 ? `；提现时扣除 ${feePercent}% 服务费` : ""}
</CardDescription>
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/distributor/\(main\)/commissions/commissions-balance-section.tsx
git commit -m "feat: show milestone bonus in commissions balance breakdown"
```

---

## Task 7: Admin API Routes

**Files:**
- Create: `app/api/admin/invitation-milestones/route.ts`
- Create: `app/api/admin/invitation-milestones/[id]/route.ts`

- [ ] **Step 1: Create collection route**

Create `app/api/admin/invitation-milestones/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError } from "@/lib/api-response"
import {
  createMilestoneSchema,
  listInvitationMilestones,
  createInvitationMilestone,
} from "@/lib/domains/distributors"

export async function GET() {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const milestones = await listInvitationMilestones()
  return NextResponse.json(milestones)
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }
  const parsed = createMilestoneSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())
  const milestone = await createInvitationMilestone(parsed.data)
  return NextResponse.json(milestone, { status: 201 })
}

export const runtime = "nodejs"
```

- [ ] **Step 2: Create item route**

Create `app/api/admin/invitation-milestones/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError, notFound, badRequest } from "@/lib/api-response"
import {
  updateMilestoneSchema,
  updateInvitationMilestone,
  deleteInvitationMilestone,
  InvitationMilestoneNotFoundError,
  InvitationMilestoneHasBonusesError,
} from "@/lib/domains/distributors"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const { id } = await context.params
  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }
  const parsed = updateMilestoneSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())
  try {
    const milestone = await updateInvitationMilestone(id, parsed.data)
    return NextResponse.json(milestone)
  } catch (e) {
    if (e instanceof InvitationMilestoneNotFoundError) return notFound(e.message)
    throw e
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const { id } = await context.params
  try {
    await deleteInvitationMilestone(id)
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    if (e instanceof InvitationMilestoneNotFoundError) return notFound(e.message)
    if (e instanceof InvitationMilestoneHasBonusesError) return badRequest(e.message)
    throw e
  }
}

export const runtime = "nodejs"
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/invitation-milestones/
git commit -m "feat(api): add admin invitation milestone CRUD routes"
```

---

## Task 8: Admin UI

**Files:**
- Create: `app/admin/(main)/invitation-milestones/invitation-milestones-columns.tsx`
- Create: `app/admin/(main)/invitation-milestones/invitation-milestones-data-table.tsx`
- Create: `app/admin/(main)/invitation-milestones/add-milestone-dialog.tsx`
- Create: `app/admin/(main)/invitation-milestones/edit-milestone-dialog.tsx`
- Create: `app/admin/(main)/invitation-milestones/invitation-milestones-row-actions.tsx`
- Create: `app/admin/(main)/invitation-milestones/page.tsx`
- Create: `app/admin/(main)/invitation-milestones/loading.tsx`
- Modify: `app/components/admin-sidebar.tsx`

- [ ] **Step 1: Create columns**

Create `app/admin/(main)/invitation-milestones/invitation-milestones-columns.tsx`:

```typescript
"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { formatCurrency } from "@/lib/utils"
import { DataTableColumnHeader } from "@/app/admin/components"
import { InvitationMilestoneRowActions } from "./invitation-milestones-row-actions"

export type MilestoneRow = {
  id: string
  thresholdAmount: number
  bonusAmount: number
  sortOrder: number
  createdAt: string
}

export const invitationMilestonesColumns: ColumnDef<MilestoneRow>[] = [
  {
    accessorKey: "thresholdAmount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="被邀请人累计销售额门槛" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="text-right">{formatCurrency(row.original.thresholdAmount)}</div>
    ),
  },
  {
    accessorKey: "bonusAmount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="邀请人获得奖励" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="text-right font-medium text-green-600">
        +{formatCurrency(row.original.bonusAmount)}
      </div>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "创建时间（销售额起算日）",
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {new Date(row.original.createdAt).toLocaleDateString("zh-CN")}
      </span>
    ),
  },
  {
    id: "actions",
    header: () => <div className="w-[80px]">操作</div>,
    cell: ({ row }) => (
      <InvitationMilestoneRowActions
        id={row.original.id}
        thresholdAmount={row.original.thresholdAmount}
        bonusAmount={row.original.bonusAmount}
      />
    ),
  },
]
```

- [ ] **Step 2: Create data table**

Create `app/admin/(main)/invitation-milestones/invitation-milestones-data-table.tsx`:

```typescript
"use client"

import { useState } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
} from "@tanstack/react-table"
import { DataTable } from "@/app/admin/components"
import { invitationMilestonesColumns, type MilestoneRow } from "./invitation-milestones-columns"

export function InvitationMilestonesDataTable({ data }: { data: MilestoneRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data,
    columns: invitationMilestonesColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    getRowId: (row) => row.id,
    state: { sorting },
  })

  return (
    <DataTable
      table={table}
      columns={invitationMilestonesColumns}
      emptyMessage="暂无里程碑配置，点击右上角「添加里程碑」创建。"
    />
  )
}
```

- [ ] **Step 3: Create add dialog**

Create `app/admin/(main)/invitation-milestones/add-milestone-dialog.tsx`:

```typescript
"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { DialogFooter } from "@/components/ui/dialog"
import { ModalForm } from "@/app/admin/components"

const schema = z.object({
  thresholdAmount: z
    .string()
    .refine((v) => !Number.isNaN(parseFloat(v)), "请输入有效数字")
    .refine((v) => parseFloat(v) > 0, "必须大于 0"),
  bonusAmount: z
    .string()
    .refine((v) => !Number.isNaN(parseFloat(v)), "请输入有效数字")
    .refine((v) => parseFloat(v) > 0, "必须大于 0"),
})
type FormValues = z.infer<typeof schema>

export function AddMilestoneDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { thresholdAmount: "", bonusAmount: "" },
  })

  const onSubmit = async (values: FormValues) => {
    try {
      const res = await fetch("/api/admin/invitation-milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thresholdAmount: parseFloat(values.thresholdAmount),
          bonusAmount: parseFloat(values.bonusAmount),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err?.error || "添加失败")
        return
      }
      toast.success("已添加")
      setOpen(false)
      form.reset()
      router.refresh()
    } catch {
      toast.error("添加失败")
    }
  }

  return (
    <ModalForm
      trigger={
        <Button>
          <Plus className="size-4 mr-1" />
          添加里程碑
        </Button>
      }
      title="添加邀请里程碑"
      description="被邀请人累计销售额（自本里程碑创建日起）达到门槛时，邀请人一次性获得奖励金额。"
      open={open}
      onOpenChange={(v) => { setOpen(v); if (!v) form.reset() }}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="thresholdAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>累计销售额门槛（元）</FormLabel>
                <FormControl>
                  <Input type="number" min={0} step="0.01" placeholder="500" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bonusAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>奖励金额（元）</FormLabel>
                <FormControl>
                  <Input type="number" min={0} step="0.01" placeholder="20" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setOpen(false); form.reset() }}>
              取消
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "添加中…" : "添加"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </ModalForm>
  )
}
```

- [ ] **Step 4: Create edit dialog**

Create `app/admin/(main)/invitation-milestones/edit-milestone-dialog.tsx`:

```typescript
"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Pencil } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { DialogFooter } from "@/components/ui/dialog"
import { ModalForm } from "@/app/admin/components"

const schema = z.object({
  thresholdAmount: z
    .string()
    .refine((v) => !Number.isNaN(parseFloat(v)), "请输入有效数字")
    .refine((v) => parseFloat(v) > 0, "必须大于 0"),
  bonusAmount: z
    .string()
    .refine((v) => !Number.isNaN(parseFloat(v)), "请输入有效数字")
    .refine((v) => parseFloat(v) > 0, "必须大于 0"),
})
type FormValues = z.infer<typeof schema>

type Props = { id: string; thresholdAmount: number; bonusAmount: number }

export function EditMilestoneDialog({ id, thresholdAmount, bonusAmount }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      thresholdAmount: String(thresholdAmount),
      bonusAmount: String(bonusAmount),
    },
  })

  const onSubmit = async (values: FormValues) => {
    try {
      const res = await fetch(`/api/admin/invitation-milestones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thresholdAmount: parseFloat(values.thresholdAmount),
          bonusAmount: parseFloat(values.bonusAmount),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err?.error || "保存失败")
        return
      }
      toast.success("已保存")
      setOpen(false)
      router.refresh()
    } catch {
      toast.error("保存失败")
    }
  }

  return (
    <ModalForm
      trigger={
        <Button size="sm" variant="ghost">
          <Pencil className="size-4" />
          编辑
        </Button>
      }
      title="编辑里程碑"
      description="修改门槛或奖励金额。注意：创建时间不变，已触发的奖励不受影响。"
      open={open}
      onOpenChange={(v) => { setOpen(v); if (!v) form.reset() }}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="thresholdAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>累计销售额门槛（元）</FormLabel>
                <FormControl>
                  <Input type="number" min={0} step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bonusAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>奖励金额（元）</FormLabel>
                <FormControl>
                  <Input type="number" min={0} step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setOpen(false); form.reset() }}>
              取消
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </ModalForm>
  )
}
```

- [ ] **Step 5: Create row actions**

Create `app/admin/(main)/invitation-milestones/invitation-milestones-row-actions.tsx`:

```typescript
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { EditMilestoneDialog } from "./edit-milestone-dialog"

type Props = { id: string; thresholdAmount: number; bonusAmount: number }

export function InvitationMilestoneRowActions({ id, thresholdAmount, bonusAmount }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/invitation-milestones/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err?.error ?? "删除失败")
        return
      }
      setOpen(false)
      toast.success("已删除")
      router.refresh()
    } catch {
      toast.error("删除失败")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <EditMilestoneDialog id={id} thresholdAmount={thresholdAmount} bonusAmount={bonusAmount} />
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => setOpen(true)}
        >
          <Trash2 className="size-4" />
          删除
        </Button>
      </div>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除此里程碑档位吗？若已有奖励发放记录，删除将被拒绝。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); handleDelete() }}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

- [ ] **Step 6: Create page**

Create `app/admin/(main)/invitation-milestones/page.tsx`:

```typescript
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/app/admin/components"
import { InvitationMilestonesDataTable } from "./invitation-milestones-data-table"
import { AddMilestoneDialog } from "./add-milestone-dialog"
import type { MilestoneRow } from "./invitation-milestones-columns"

export const dynamic = "force-dynamic"

export default async function InvitationMilestonesPage() {
  const milestones = await prisma.invitationMilestone.findMany({
    orderBy: { thresholdAmount: "asc" },
  })

  const data: MilestoneRow[] = milestones.map((m) => ({
    id: m.id,
    thresholdAmount: Number(m.thresholdAmount),
    bonusAmount: Number(m.bonusAmount),
    sortOrder: m.sortOrder,
    createdAt: m.createdAt.toISOString(),
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="邀请里程碑奖励"
        description="当被邀请人的累计销售额（自里程碑创建日起）达到门槛时，邀请人一次性获得对应奖励。每档每人仅触发一次。"
      >
        <AddMilestoneDialog />
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>里程碑档位</CardTitle>
          <CardDescription>
            创建时间即为该档位的销售额起算日，此前的历史销售不计入。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InvitationMilestonesDataTable data={data} />
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 7: Create loading skeleton**

Create `app/admin/(main)/invitation-milestones/loading.tsx`:

```typescript
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
```

- [ ] **Step 8: Add sidebar entry**

In `app/components/admin-sidebar.tsx`, find the line:
```typescript
{ title: "阶梯佣金配置", href: "/admin/commission-tiers", icon: Layers },
```

Add after it:
```typescript
{ title: "邀请里程碑奖励", href: "/admin/invitation-milestones", icon: Trophy },
```

Also import `Trophy` from `lucide-react` (add to the existing lucide import line).

- [ ] **Step 9: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds, new route `/admin/invitation-milestones` appears in output.

- [ ] **Step 10: Commit**

```bash
git add app/admin/\(main\)/invitation-milestones/ app/components/admin-sidebar.tsx
git commit -m "feat(admin): add invitation milestone management UI"
```

---

## Task 9: Distributor Bonus Records API + UI Section

**Files:**
- Create: `app/api/distributor/milestone-bonuses/route.ts`
- Modify: `app/distributor/(main)/commissions/page.tsx`

- [ ] **Step 1: Create API route**

Create `app/api/distributor/milestone-bonuses/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { getDistributorSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"
import { listDistributorMilestoneBonuses } from "@/lib/domains/distributors"

export async function GET(request: NextRequest) {
  const session = await getDistributorSession()
  if (!session) return unauthorized()
  const user = session.user as { id: string }
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20")))
  const result = await listDistributorMilestoneBonuses(user.id, page, pageSize)
  return NextResponse.json(result)
}

export const runtime = "nodejs"
```

- [ ] **Step 2: Add bonus records section to commissions page**

In `app/distributor/(main)/commissions/page.tsx`, after fetching `milestoneBonusSum`, also fetch bonus records:

Add to the page's data fetching (as a separate await after the main Promise.all, since it's paginated):

```typescript
  const milestoneBonuses = await prisma.invitationMilestoneBonus.findMany({
    where: { inviterId: user.id },
    include: { invitee: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  })
```

Then in the JSX, add after the commissions table:

```tsx
  {milestoneBonuses.length > 0 && (
    <div>
      <h3 className="text-lg font-semibold">邀请奖励记录</h3>
      <p className="text-sm text-muted-foreground mb-4">
        共 {milestoneBonuses.length} 笔。
      </p>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 text-left font-medium">被邀请人</th>
              <th className="px-4 py-2 text-right font-medium">门槛金额</th>
              <th className="px-4 py-2 text-right font-medium">奖励金额</th>
              <th className="px-4 py-2 text-right font-medium">触发时间</th>
            </tr>
          </thead>
          <tbody>
            {milestoneBonuses.map((b) => (
              <tr key={b.id} className="border-b last:border-0">
                <td className="px-4 py-2">{b.invitee.name}</td>
                <td className="px-4 py-2 text-right text-muted-foreground">
                  ¥{Number(b.thresholdSnapshot).toFixed(2)}
                </td>
                <td className="px-4 py-2 text-right font-medium text-green-600">
                  +¥{Number(b.amount).toFixed(2)}
                </td>
                <td className="px-4 py-2 text-right text-muted-foreground">
                  {b.createdAt.toLocaleDateString("zh-CN")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )}
```

- [ ] **Step 3: Type-check and build**

```bash
npx tsc --noEmit && npm run build 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/distributor/milestone-bonuses/ \
        app/distributor/\(main\)/commissions/page.tsx
git commit -m "feat(distributor): add milestone bonus records API and commissions page section"
```

---

## Task 10: Update Invitees Page with Milestone Progress

**Files:**
- Modify: `app/distributor/(main)/invitees/invitees-columns.tsx`
- Modify: `app/distributor/(main)/invitees/invitees-data-table.tsx`
- Modify: `app/distributor/(main)/invitees/page.tsx`

- [ ] **Step 1: Extend `InviteeRow` type**

In `app/distributor/(main)/invitees/invitees-columns.tsx`, update `InviteeRow`:

```typescript
export type InviteeRow = {
  id: string
  name: string
  email: string | null
  username: string | null
  createdAt: string
  level2CommissionTotal: number
  // Milestone progress fields
  nextMilestone: { thresholdAmount: number; bonusAmount: number; cumulative: number } | null
  triggeredMilestoneCount: number
}
```

Add a milestone progress column after `level2CommissionTotal`:

```typescript
  {
    id: "milestoneProgress",
    header: "里程碑进度",
    cell: ({ row }) => {
      const { nextMilestone, triggeredMilestoneCount } = row.original
      if (!nextMilestone && triggeredMilestoneCount === 0) return null
      return (
        <div className="space-y-1 min-w-[160px]">
          {triggeredMilestoneCount > 0 && (
            <p className="text-xs text-green-600 font-medium">
              已达成 {triggeredMilestoneCount} 个里程碑
            </p>
          )}
          {nextMilestone && (
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">
                距下一档（¥{nextMilestone.thresholdAmount.toFixed(0)}）还差
                ¥{Math.max(0, nextMilestone.thresholdAmount - nextMilestone.cumulative).toFixed(2)}
              </p>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden w-32">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${Math.min(100, (nextMilestone.cumulative / nextMilestone.thresholdAmount) * 100).toFixed(1)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )
    },
  },
```

- [ ] **Step 2: Update page to fetch milestone data**

In `app/distributor/(main)/invitees/page.tsx`, after the existing `level2CommissionsBySource` query, add:

```typescript
  // Fetch milestones and triggered bonuses for progress display
  const [milestones, triggeredBonuses] = await Promise.all([
    prisma.invitationMilestone.findMany({ orderBy: { thresholdAmount: "asc" } }),
    inviteeIds.length > 0
      ? prisma.invitationMilestoneBonus.findMany({
          where: { inviterId: user.id, inviteeId: { in: inviteeIds } },
          select: { inviteeId: true, milestoneId: true },
        })
      : Promise.resolve([]),
  ])

  // Group triggered bonuses by invitee
  const triggeredByInvitee = new Map<string, Set<string>>()
  for (const b of triggeredBonuses) {
    if (!triggeredByInvitee.has(b.inviteeId)) triggeredByInvitee.set(b.inviteeId, new Set())
    triggeredByInvitee.get(b.inviteeId)!.add(b.milestoneId)
  }

  // For each invitee, find their next unclaimed milestone and compute cumulative sales for it
  // (only query if milestones exist)
  const inviteeProgressMap = new Map<string, { nextMilestone: { thresholdAmount: number; bonusAmount: number; cumulative: number } | null; triggeredMilestoneCount: number }>()

  if (milestones.length > 0) {
    await Promise.all(
      invitees.map(async (invitee) => {
        const triggered = triggeredByInvitee.get(invitee.id) ?? new Set<string>()
        const triggeredMilestoneCount = triggered.size
        const nextMilestoneConfig = milestones.find((m) => !triggered.has(m.id))

        let nextMilestone: { thresholdAmount: number; bonusAmount: number; cumulative: number } | null = null
        if (nextMilestoneConfig) {
          const { _sum } = await prisma.order.aggregate({
            where: {
              distributorId: invitee.id,
              status: "COMPLETED",
              paidAt: { gte: nextMilestoneConfig.createdAt },
            },
            _sum: { amount: true },
          })
          nextMilestone = {
            thresholdAmount: Number(nextMilestoneConfig.thresholdAmount),
            bonusAmount: Number(nextMilestoneConfig.bonusAmount),
            cumulative: Number(_sum.amount ?? 0),
          }
        }
        inviteeProgressMap.set(invitee.id, { nextMilestone, triggeredMilestoneCount })
      }),
    )
  }
```

Update `rows` construction to include new fields:

```typescript
  const rows: InviteeRow[] = invitees.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    username: u.username,
    createdAt: u.createdAt.toISOString(),
    level2CommissionTotal: level2Map.get(u.id) ?? 0,
    ...(inviteeProgressMap.get(u.id) ?? { nextMilestone: null, triggeredMilestoneCount: 0 }),
  }))
```

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | tail -15
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/distributor/\(main\)/invitees/
git commit -m "feat(distributor): show milestone progress on invitees page"
```

---

## Task 11: Final Type-Check, Full Test Run, and Verification

- [ ] **Step 1: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass including new milestone-service tests.

- [ ] **Step 2: Full build**

```bash
npm run build
```

Expected: build succeeds, no TypeScript errors.

- [ ] **Step 3: Verify key invariants**

Check the following with grep:

```bash
# All balance calculation sites include bonuses
grep -n "withdrawableBalance\s*=" \
  lib/domains/distributors/service.ts \
  app/distributor/\(main\)/page.tsx \
  app/distributor/\(main\)/commissions/page.tsx
```

Expected: each site includes `+ bonuses` or `+ milestoneBonusTotal`.

```bash
# Commission stats queries untouched
grep -n "aggregateCommissionsByStatusAndPeriod\|settledCommission\|pendingCommissionAmount" \
  lib/domains/distributors/service.ts
```

Expected: these functions contain no reference to `InvitationMilestoneBonus`.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: invitation milestone bonus — complete implementation"
```
