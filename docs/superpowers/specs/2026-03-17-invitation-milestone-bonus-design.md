# Invitation Milestone Bonus — Design Spec

**Date**: 2026-03-17  
**Status**: Approved

## Background

The platform already has two distributor incentive mechanisms:

1. **Level-2 commission** — ongoing per-order revenue share: when an invitee (distributor) makes a sale, the inviter receives `level2Rate%` of the commission amount, every time.
2. **Invitation reward** (schema comment, not yet implemented) — a fixed one-time bonus when the invitee completes their first order.

This spec introduces a third, complementary mechanism: **invitation milestone bonuses**. The goal is to incentivize distributors to recruit productive peers, not just anyone. Bonuses are tied to cumulative sales milestones of the invitee, configurable by admin, and are issued one-time per milestone per invitee.

## Business Rules

- Inviter receives a bonus when their invitee's cumulative sales exceed a configured threshold.
- Multiple milestone tiers can be configured (e.g. ¥500 → ¥20, ¥2000 → ¥80, ¥10000 → ¥300).
- Each milestone fires **at most once per invitee** — identified by `(inviteeId, milestoneId)` uniqueness.
- Cumulative sales are counted from **the milestone's `createdAt`** date onward (`Order.paidAt >= milestone.createdAt`). No retroactive payouts for pre-existing sales.
- Bonuses are added to the inviter's **withdrawable balance**, participating in the existing withdrawal flow.
- Bonuses are stored in a **separate table** and excluded from commission statistics. Balance formula becomes: `SETTLED commissions + all milestone bonus records - PAID withdrawals - PENDING withdrawals`. A bonus record's existence means it has been issued; there is no separate status field.
- If the inviter is **disabled** (`disabledAt != null`) at the time of the triggering order, no bonus is issued.
- If the invitee was invited by an **admin** (inviter role is not `DISTRIBUTOR`), no bonus is issued.
- If the inviter changes (`bindInviter`), the milestone is consumed by whoever was the current inviter at trigger time. The new inviter cannot re-trigger the same milestone for the same invitee.

## Data Model

### `InvitationMilestone` — admin-configured tiers

```prisma
model InvitationMilestone {
  id              String   @id @default(cuid())
  thresholdAmount Decimal  @db.Decimal(12, 2)  // invitee cumulative sales threshold
  bonusAmount     Decimal  @db.Decimal(10, 2)  // bonus paid to inviter on trigger
  sortOrder       Int      @default(0)
  createdAt       DateTime @default(now())     // also serves as the sales start date for this milestone
  updatedAt       DateTime @updatedAt
  bonuses         InvitationMilestoneBonus[]

  @@index([sortOrder])
  @@index([thresholdAmount])
}
```

### `InvitationMilestoneBonus` — payout records

```prisma
model InvitationMilestoneBonus {
  id                String   @id @default(cuid())
  inviterId         String                       // recipient of the bonus
  inviteeId         String                       // whose sales triggered the milestone
  milestoneId       String
  thresholdSnapshot Decimal  @db.Decimal(12, 2) // milestone threshold at time of trigger (for display stability)
  amount            Decimal  @db.Decimal(10, 2) // bonus amount actually paid
  createdAt         DateTime @default(now())

  inviter   User               @relation("InviterMilestoneBonuses", fields: [inviterId], references: [id])
  invitee   User               @relation("InviteeMilestoneBonuses", fields: [inviteeId], references: [id])
  milestone InvitationMilestone @relation(fields: [milestoneId], references: [id])

  @@unique([inviteeId, milestoneId])            // each milestone fires at most once per invitee
  @@index([inviterId])
  @@index([inviteeId])
  @@index([milestoneId])
}
```

No `status` field — a bonus record's existence means it has been issued. Withdrawal tracking is handled by the existing `Withdrawal` table, consistent with how commissions work.

## Business Logic

### Trigger location

`completePendingOrder` (`lib/complete-pending-order.ts`) — after `createOrderCommissions` succeeds, within the same `prisma.$transaction`.

### New function: `checkAndIssueMilestoneBonuses`

Located in `lib/domains/distributors/service.ts`, called inside the transaction client.

**Flow**:

```
1. Fetch invitee's inviterId from User
   └─ No inviterId → skip

2. Fetch inviter User (role, disabledAt)
   └─ role !== 'DISTRIBUTOR' → skip (admin-invited)
   └─ disabledAt !== null    → skip (disabled)

3. Fetch all InvitationMilestone records (ordered by thresholdAmount asc)
   └─ Empty → skip

4. For each milestone, compute invitee's cumulative sales since milestone.createdAt:
   SUM(Order.amount)
   WHERE distributorId = inviteeId
     AND status = 'COMPLETED'
     AND paidAt >= milestone.createdAt
   (current order is already COMPLETED at this point in the transaction)

5. Fetch already-triggered milestones:
   SELECT milestoneId FROM InvitationMilestoneBonus WHERE inviteeId = Y

6. For each milestone where:
   - cumulativeTotal >= milestone.thresholdAmount
   - milestoneId NOT IN already-triggered set

   → INSERT InvitationMilestoneBonus {
       inviterId, inviteeId, milestoneId,
       thresholdSnapshot: milestone.thresholdAmount,
       amount: milestone.bonusAmount
     }
   → On unique constraint conflict: ignore (concurrent safety)
```

**Idempotency**: The `@@unique([inviteeId, milestoneId])` constraint ensures at-most-once delivery. Concurrent order completions that race to the same milestone trigger a constraint violation on the second writer; the caller catches and ignores it.

**Performance**: Extra queries only run when the completing order's distributor has an inviter who is an active DISTRIBUTOR. In practice this affects a subset of orders. Acceptable overhead.

### Withdrawable balance change

All places that compute withdrawable balance must be updated:

```
balance = SETTLED commissions + SUM(InvitationMilestoneBonus.amount WHERE inviterId = X)
          - PAID withdrawals - PENDING withdrawals
```

Files affected (exhaustive — all six locations that compute withdrawable balance):

1. `lib/domains/distributors/repository.ts` — add `aggregateMilestoneBonusSum(distributorId)` helper
2. `lib/domains/distributors/service.ts: listDistributors` — admin distributor list shows `withdrawableBalance` per row
3. `lib/domains/distributors/service.ts: getDistributorProfile` — distributor profile API
4. `lib/domains/distributors/service.ts: listDistributorCommissions` — commissions page balance
5. `lib/domains/distributors/service.ts: createWithdrawal` — balance guard before creating withdrawal
6. `app/distributor/(main)/page.tsx` — dashboard RSC computes balance directly via `prisma.commission.aggregate`; does NOT go through service
7. `app/distributor/(main)/commissions/page.tsx` — commissions RSC also computes balance directly; does NOT go through service

> Note: `reassignOrderDistributor` (service.ts line ~638) does a `settled - cancelAmount - paid` check to verify commission solvency before reassignment. This is commission-only logic and should NOT include milestone bonuses.

**UI formula string**: `app/distributor/(main)/commissions/commissions-balance-section.tsx` hardcodes the balance breakdown description as "推广奖金 + 团队奖金 − 已打款 − 提现中". This string must be updated to include "＋邀请奖励 ¥X". Add a `milestoneBonusTotal: number` prop to this component; only show the term when `milestoneBonusTotal > 0`.

Commission statistics queries (`aggregateCommissionsByStatusAndPeriod`, leaderboard, etc.) are **not modified** — they only touch the `Commission` table.

## Admin UI

**Route**: `app/admin/(main)/invitation-milestones/`

**Files**:
```
invitation-milestones/
├── page.tsx                           // server component, fetches all milestones
├── invitation-milestones-data-table.tsx
├── invitation-milestones-columns.tsx
├── invitation-milestones-row-actions.tsx
└── loading.tsx
```

**Page layout**:
- Info callout at top explaining the mechanism
- DataTable columns: Threshold (¥) / Bonus (¥) / Created At / Actions
- "Add Milestone" button → Dialog form with two fields: threshold amount + bonus amount
- Edit: same Dialog form, pre-populated
- Delete: AlertDialog; blocked if any `InvitationMilestoneBonus` records reference this milestone (error: "该档位已有奖励发放记录，不可删除")

**Sidebar**: `app/components/admin-sidebar.tsx` — add entry after `{ title: "阶梯佣金配置", href: "/admin/commission-tiers" }`.

**API routes**:
- `GET /api/admin/invitation-milestones` — list all
- `POST /api/admin/invitation-milestones` — create
- `PATCH /api/admin/invitation-milestones/[id]` — update
- `DELETE /api/admin/invitation-milestones/[id]` — delete (with guard)

## Distributor UI

### Invitation progress (extend existing invitees page)

**Route**: `app/distributor/(main)/invitees/` — **already exists**. Do not create a new page. The current page shows invitees with their level-2 commission total. Extend it to also show milestone progress per invitee.

**Additional data per invitee row**:
- Per-milestone progress: each milestone has its own cumulative sales window starting from `milestone.createdAt`. Display the next unclaimed milestone's progress bar (sales so far vs. threshold), and badges for already-triggered milestones.
- Preserve all existing level-2 commission display — do not remove or replace it.
- If no milestones are configured, show nothing extra (no placeholder needed).

### Bonus records

New tab or section in `app/distributor/(main)/commissions/` (or a standalone `/bonuses/` page):
- Table columns: Invitee name / Milestone threshold / Bonus amount / Triggered at
- Separate from commission records — no mixing

### Balance card update

On the distributor home page (`/distributor/(main)/dashboard/` or profile section):
- Withdrawable balance figure: unchanged (already includes bonuses)
- Add a secondary line: `含邀请奖励 ¥XX.XX` — shown only when the distributor has at least one bonus record
- This gives transparency without changing any existing aggregation

**API routes**:
- `GET /api/distributor/milestone-bonuses` — paginated list of the current distributor's bonus records
- `GET /api/distributor/invitees` — list of invitees with milestone progress (new or extend existing)

## Testing

- Unit test `checkAndIssueMilestoneBonuses`:
  - No inviter → no bonus
  - Admin inviter → no bonus
  - Disabled inviter → no bonus
  - Single milestone crossed → one bonus inserted
  - Multiple milestones crossed in one order → all inserted
  - Already-triggered milestone → not re-inserted (idempotent)
  - Cumulative sales before milestone `createdAt` → not counted (no retroactive bonus)
  - Concurrent duplicate trigger → unique constraint handles gracefully
- Integration test: `completePendingOrder` end-to-end with milestone check
- Unit test balance calculation includes milestone bonuses
- Unit test withdrawal guard includes milestone bonuses in balance
