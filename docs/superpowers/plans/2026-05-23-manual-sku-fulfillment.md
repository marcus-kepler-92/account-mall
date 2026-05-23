# Manual Fulfillment + SKU + WeCom Notify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third product fulfillment mode (`MANUAL`) with multi-SKU pricing, a 5-state order machine driven by admin actions, business-hours-aware buyer ETA text, and WeCom group-bot push notifications for new orders and buyer dun-events.

**Architecture:** New `ProductVariant` table (1-D list under MANUAL products), new `OrderFulfillment` 1-1 table that stores seller-typed text and locks on write, two new `OrderStatus` values (`AWAITING_FULFILLMENT`, `PROCESSING`) gated by a centralized state machine, `lib/business-hours.ts` for ETA computation reusing existing `SiteSetting.businessHoursStart/End/Timezone` (hour ints 0-23), and `lib/wecom-notify.ts` as a fire-and-forget POST to qyapi webhook with `NotificationLog` persistence. NORMAL/AUTO_FETCH flows are untouched; MANUAL diverges via `productType` branches in payment callback / order-creation / lookup.

**Tech Stack:** Next.js 16 App Router + React 19 + TypeScript, Prisma 6 / PostgreSQL 17, Zod, react-hook-form, shadcn/ui, TanStack Query, Jest + Testing Library, date-fns-tz (already installed).

**Spec:** `docs/superpowers/specs/2026-05-23-manual-sku-fulfillment-design.md`

---

## File Structure

### Create

```
prisma/migrations/<timestamp>_manual_sku_fulfillment/migration.sql
lib/domains/variants/types.ts
lib/domains/variants/validators.ts
lib/domains/variants/repository.ts
lib/domains/variants/service.ts
lib/domains/variants/index.ts
lib/domains/variants/__tests__/service.test.ts
lib/order-state-machine.ts
lib/business-hours.ts
lib/wecom-notify.ts
__tests__/lib/order-state-machine.test.ts
__tests__/lib/business-hours.test.ts
__tests__/lib/wecom-notify.test.ts
app/api/admin/orders/[orderId]/take/route.ts
app/api/admin/orders/[orderId]/fulfill/route.ts
app/api/orders/[orderId]/dun/route.ts
__tests__/app/api/admin/orders/take.test.ts
__tests__/app/api/admin/orders/fulfill.test.ts
__tests__/app/api/orders/dun.test.ts
app/admin/(main)/products/[productId]/variants/variants-section.tsx
app/admin/(main)/products/[productId]/variants/variant-form-dialog.tsx
app/admin/(main)/products/[productId]/variants/variant-row-actions.tsx
app/admin/(main)/orders/[orderId]/manual-fulfillment-panel.tsx
app/admin/(main)/settings/site/wecom-notify-card.tsx
app/admin/(main)/settings/site/business-hours-weekday-picker.tsx
app/components/product-variant-selector.tsx
app/orders/[orderNo]/manual-status-timeline.tsx
app/orders/[orderNo]/manual-dun-button.tsx
```

### Modify

```
prisma/schema.prisma                                            # enums, new tables, Order extension, SiteSetting columns
lib/config.ts                                                   # env defaults for new SiteSetting keys
lib/site-settings.ts                                            # extend SiteSettings type + getSiteSettings
lib/validations/site-setting.ts                                 # extend siteSettingPatchSchema
lib/validations/order.ts                                        # orderStatusSchema add new values
lib/validations/product.ts                                      # add MANUAL to productType union, variantId on order create
lib/order-history-storage.ts                                    # extend OrderStatus union
lib/complete-pending-order.ts                                   # MANUAL branch
lib/order-completion-email.ts                                   # accountContent assembly per productType
app/emails/order-completion.tsx                                 # template prop change cards → accountContent
app/api/orders/route.ts                                         # MANUAL variant validation + write variantId
app/api/orders/[orderId]/route.ts                               # CLOSED transition: restock variant if MANUAL
app/api/orders/batch/route.ts                                   # explicit reject for non-PENDING CLOSE (no behavior change, just safety assertion)
app/api/orders/lookup/route.ts                                  # fulfillment field in completed response
app/api/orders/lookup-by-email/route.ts                         # same shape change
app/orders/lookup/types.ts                                      # extend response types
app/orders/lookup/order-detail-content.tsx                      # branch render by productType
app/admin/(main)/settings/site/site-settings-form.tsx           # wire new fields into form
app/admin/(main)/products/[productId]/product-form.tsx          # ProductType select includes MANUAL; show variants section
app/admin/(main)/products/[productId]/page.tsx                  # load variants for MANUAL
app/admin/(main)/orders/[orderId]/page.tsx                      # mount manual-fulfillment-panel for MANUAL
app/admin/(main)/orders/orders-columns.tsx                      # add SKU column
app/admin/(main)/orders/orders-filters.ts                       # status filter union widened
app/products/[slug]/page.tsx                                    # render variant selector for MANUAL
app/orders/[orderNo]/awaiting-payment/awaiting-payment-client.tsx  # 5-state timeline & ETA text
lib/restock-notify.ts                                           # skip if MANUAL
app/api/restock-subscriptions/route.ts                          # reject MANUAL
lib/cross-sell.ts                                               # skip MANUAL targets
lib/purchase-limit.ts                                           # skip MANUAL
app/api/exit-discount/route.ts                                  # skip MANUAL
```

---

## Phase A — Data Layer Foundation

### Task 1: Prisma schema migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_manual_sku_fulfillment/migration.sql`

- [ ] **Step 1: Edit `prisma/schema.prisma`**

Add `MANUAL` to `ProductType` enum (line ~126):
```prisma
enum ProductType {
  NORMAL
  AUTO_FETCH
  MANUAL
}
```

Add new values to `OrderStatus` enum (line ~114):
```prisma
enum OrderStatus {
  PENDING
  AWAITING_FULFILLMENT
  PROCESSING
  COMPLETED
  CLOSED
}
```

Insert `ProductVariant` model after `Tag`:
```prisma
model ProductVariant {
  id            String   @id @default(cuid())
  productId     String
  name          String   @db.VarChar(200)
  price         Decimal  @db.Decimal(10, 2)
  unitCost      Decimal? @db.Decimal(10, 2)
  stockQuantity Int      @default(0)
  sortOrder     Int      @default(0)
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  product       Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  orders        Order[]

  @@index([productId, isActive, sortOrder])
}
```

Insert `OrderFulfillment` after `Order`:
```prisma
model OrderFulfillment {
  id          String   @id @default(cuid())
  orderId     String   @unique
  content     String   @db.Text
  fulfilledBy String
  fulfilledAt DateTime @default(now())
  order       Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  operator    User     @relation(fields: [fulfilledBy], references: [id])

  @@index([fulfilledBy])
}
```

Insert `NotificationLog`:
```prisma
model NotificationLog {
  id        String   @id @default(cuid())
  channel   String   @db.VarChar(32)
  event     String   @db.VarChar(64)
  payload   String   @db.Text
  status    String   @db.VarChar(16)
  error     String?  @db.Text
  orderId   String?
  createdAt DateTime @default(now())

  @@index([orderId])
  @@index([createdAt])
}
```

Extend `Order`:
```prisma
model Order {
  // ... existing fields ...
  variantId           String?
  variantNameSnapshot String?  @db.VarChar(200)
  dunCount            Int      @default(0)
  lastDunAt           DateTime?
  variant             ProductVariant?   @relation(fields: [variantId], references: [id], onDelete: Restrict)
  fulfillment         OrderFulfillment?

  @@index([variantId])
}
```

Update `User` model — add reverse relation for OrderFulfillment.operator:
```prisma
model User {
  // ... existing fields ...
  fulfillments OrderFulfillment[]
}
```

Update `Product` model — add reverse relation:
```prisma
model Product {
  // ... existing fields ...
  variants ProductVariant[]
}
```

Extend `SiteSetting`:
```prisma
model SiteSetting {
  // ... existing fields ...
  businessHoursWeekdays String?           // JSON array like "[1,2,3,4,5]"
  wecomWebhookUrl       String?
  dunCooldownMinutes    Int?
  dunMinAgeMinutes      Int?
}
```

Update `Order.unitPriceSnapshot` doc comment to:
```prisma
/// Snapshot of the order unit price at creation time.
/// NORMAL/AUTO_FETCH: product.price; MANUAL: variant.price.
unitPriceSnapshot   Decimal?    @db.Decimal(10, 2)
```

- [ ] **Step 2: Generate migration**

Run: `npx prisma migrate dev --name manual_sku_fulfillment --create-only`
Expected: creates `prisma/migrations/<timestamp>_manual_sku_fulfillment/migration.sql` without applying.

- [ ] **Step 3: Inspect the generated SQL**

Read the migration.sql. Confirm:
- `ALTER TYPE "ProductType" ADD VALUE 'MANUAL'`
- `ALTER TYPE "OrderStatus" ADD VALUE 'AWAITING_FULFILLMENT'` and `... 'PROCESSING'`
- `CREATE TABLE "ProductVariant"` with FK + indexes
- `CREATE TABLE "OrderFulfillment"` with unique on `orderId`
- `CREATE TABLE "NotificationLog"` with indexes
- `ALTER TABLE "Order" ADD COLUMN "variantId"`, `variantNameSnapshot`, `dunCount`, `lastDunAt` + FK with `ON DELETE RESTRICT`
- `ALTER TABLE "SiteSetting" ADD COLUMN` for 4 new keys
- `ALTER TABLE "Order"` index on `variantId`

If anything missing or `DROP` lines appear, abort and fix schema.

- [ ] **Step 4: Apply migration**

Run: `npx prisma migrate dev`
Expected: "Applied migration ..." with no errors.

- [ ] **Step 5: Regenerate Prisma Client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client" — verifies new types compile.

- [ ] **Step 6: Typecheck the repo**

Run: `npx tsc --noEmit`
Expected: NEW errors are acceptable at this point (the rest of the plan fixes them). Re-run after Task 2 to confirm none in `lib/site-settings.ts`.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add ProductType.MANUAL + ProductVariant + OrderFulfillment + NotificationLog + Order/SiteSetting fields"
```

---

### Task 2: Extend `SiteSettings` type + config defaults

**Files:**
- Modify: `lib/site-settings.ts`
- Modify: `lib/validations/site-setting.ts`
- Modify: `lib/config.ts`
- Test: `__tests__/lib/site-settings.test.ts` (modify or create)

- [ ] **Step 1: Add env defaults in `lib/config.ts`**

In the env schema (look for `escalateWebhookUrl: z.string().url().optional()` at line ~203), add:
```ts
wecomWebhookUrl: z.string().url().optional(),
dunCooldownMinutes: z.coerce.number().int().min(0).default(30),
dunMinAgeMinutes: z.coerce.number().int().min(0).default(5),
businessHoursWeekdays: z.string().optional(), // JSON array as string; "[0,1,2,3,4,5,6]" by default
```

In the env mapping block (around line ~369), add:
```ts
wecomWebhookUrl: e.WECOM_WEBHOOK_URL,
dunCooldownMinutes: e.DUN_COOLDOWN_MINUTES,
dunMinAgeMinutes: e.DUN_MIN_AGE_MINUTES,
businessHoursWeekdays: e.BUSINESS_HOURS_WEEKDAYS,
```

- [ ] **Step 2: Extend `SiteSettings` type in `lib/site-settings.ts`**

```ts
export type SiteSettings = {
  // ... existing ...
  wecomWebhookUrl: string | undefined
  dunCooldownMinutes: number
  dunMinAgeMinutes: number
  businessHoursWeekdays: number[]   // resolved array, e.g. [0,1,2,3,4,5,6]
}
```

Update `getSiteSettings()` body — parse `businessHoursWeekdays` JSON safely:
```ts
const weekdaysRaw = row?.businessHoursWeekdays ?? config.businessHoursWeekdays
const weekdays = parseWeekdays(weekdaysRaw)
return {
  // ... existing ...
  wecomWebhookUrl: row?.wecomWebhookUrl ?? config.wecomWebhookUrl,
  dunCooldownMinutes: row?.dunCooldownMinutes ?? config.dunCooldownMinutes,
  dunMinAgeMinutes: row?.dunMinAgeMinutes ?? config.dunMinAgeMinutes,
  businessHoursWeekdays: weekdays,
}
```

Add helper at bottom of file:
```ts
function parseWeekdays(raw: string | undefined | null): number[] {
  if (!raw) return [0, 1, 2, 3, 4, 5, 6]
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return [0, 1, 2, 3, 4, 5, 6]
    const cleaned = arr.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    return cleaned.length > 0 ? cleaned : [0, 1, 2, 3, 4, 5, 6]
  } catch {
    return [0, 1, 2, 3, 4, 5, 6]
  }
}
```

- [ ] **Step 3: Extend `siteSettingPatchSchema`**

In `lib/validations/site-setting.ts`, append before the `.refine(...)` call:
```ts
wecomWebhookUrl: z.preprocess(emptyToNull, httpUrl("企微 webhook URL 格式无效").nullable()).optional(),
dunCooldownMinutes: z.preprocess(
  (v) => (v === "" || v === null ? null : v),
  z.coerce.number().int().min(0).max(1440).nullable(),
).optional(),
dunMinAgeMinutes: z.preprocess(
  (v) => (v === "" || v === null ? null : v),
  z.coerce.number().int().min(0).max(60).nullable(),
).optional(),
businessHoursWeekdays: z.preprocess(
  emptyToNull,
  z.string().nullable().refine((v) => {
    if (v === null) return true
    try {
      const arr = JSON.parse(v)
      return Array.isArray(arr) && arr.every((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    } catch { return false }
  }, "工作日字段必须是 0-6 整数 JSON 数组"),
).optional(),
```

- [ ] **Step 4: Write failing test**

Create `__tests__/lib/site-settings.test.ts`:
```ts
import { getSiteSettings } from "@/lib/site-settings"
import { prisma } from "@/lib/prisma"

jest.mock("@/lib/prisma", () => ({
  prisma: { siteSetting: { findUnique: jest.fn() } },
}))

describe("getSiteSettings", () => {
  beforeEach(() => jest.clearAllMocks())

  it("returns defaults [0..6] when businessHoursWeekdays unset", async () => {
    ;(prisma.siteSetting.findUnique as jest.Mock).mockResolvedValue(null)
    const s = await getSiteSettings()
    expect(s.businessHoursWeekdays).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it("parses JSON-encoded weekdays", async () => {
    ;(prisma.siteSetting.findUnique as jest.Mock).mockResolvedValue({
      businessHoursWeekdays: "[1,2,3,4,5]",
    })
    const s = await getSiteSettings()
    expect(s.businessHoursWeekdays).toEqual([1, 2, 3, 4, 5])
  })

  it("falls back to defaults on malformed JSON", async () => {
    ;(prisma.siteSetting.findUnique as jest.Mock).mockResolvedValue({
      businessHoursWeekdays: "not-json",
    })
    const s = await getSiteSettings()
    expect(s.businessHoursWeekdays).toEqual([0, 1, 2, 3, 4, 5, 6])
  })
})
```

Run: `npx jest __tests__/lib/site-settings.test.ts -i`
Expected: 3 tests pass (React `cache()` is fine in Node test env).

- [ ] **Step 5: Commit**

```bash
git add lib/site-settings.ts lib/validations/site-setting.ts lib/config.ts __tests__/lib/site-settings.test.ts
git commit -m "feat(site-settings): add wecomWebhookUrl, dun cooldown, businessHoursWeekdays"
```

---

### Task 3: `lib/domains/variants/` domain layer

**Files:**
- Create: `lib/domains/variants/types.ts`
- Create: `lib/domains/variants/validators.ts`
- Create: `lib/domains/variants/repository.ts`
- Create: `lib/domains/variants/service.ts`
- Create: `lib/domains/variants/index.ts`
- Test: `lib/domains/variants/__tests__/service.test.ts`

- [ ] **Step 1: Create `types.ts`**

```ts
import type { Prisma } from "@prisma/client"

export type Variant = Prisma.ProductVariantGetPayload<Record<string, never>>

export type VariantRow = {
  id: string
  name: string
  price: string         // decimal as string for JSON safety
  unitCost: string | null
  stockQuantity: number
  sortOrder: number
  isActive: boolean
  createdAt: string
}

export class VariantNotFoundError extends Error {
  constructor(id: string) {
    super(`Variant ${id} not found`)
    this.name = "VariantNotFoundError"
  }
}

export class VariantHasOrdersError extends Error {
  constructor(id: string) {
    super(`Variant ${id} has linked orders and cannot be deleted`)
    this.name = "VariantHasOrdersError"
  }
}

export class NotManualProductError extends Error {
  constructor() {
    super("Product is not MANUAL type")
    this.name = "NotManualProductError"
  }
}
```

- [ ] **Step 2: Create `validators.ts`**

```ts
import { z } from "zod"

export const variantCreateSchema = z.object({
  name: z.string().min(1, "名称必填").max(200),
  price: z.coerce.number().nonnegative().multipleOf(0.01),
  unitCost: z.coerce.number().nonnegative().multipleOf(0.01).optional().nullable(),
  stockQuantity: z.coerce.number().int().nonnegative(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
})

export const variantUpdateSchema = variantCreateSchema.partial()

export type VariantCreateInput = z.infer<typeof variantCreateSchema>
export type VariantUpdateInput = z.infer<typeof variantUpdateSchema>
```

- [ ] **Step 3: Create `repository.ts`**

```ts
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

type Tx = Prisma.TransactionClient | typeof prisma

export function findVariantsByProduct(productId: string, tx: Tx = prisma) {
  return tx.productVariant.findMany({
    where: { productId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  })
}

export function findVariantById(id: string, tx: Tx = prisma) {
  return tx.productVariant.findUnique({ where: { id } })
}

export function countActiveVariants(productId: string, tx: Tx = prisma) {
  return tx.productVariant.count({ where: { productId, isActive: true } })
}

export function countOrdersForVariant(variantId: string, tx: Tx = prisma) {
  return tx.order.count({ where: { variantId } })
}

export function createVariant(
  productId: string,
  data: { name: string; price: number; unitCost?: number | null; stockQuantity: number; sortOrder?: number; isActive?: boolean },
  tx: Tx = prisma,
) {
  return tx.productVariant.create({
    data: {
      productId,
      name: data.name,
      price: data.price,
      unitCost: data.unitCost ?? null,
      stockQuantity: data.stockQuantity,
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true,
    },
  })
}

export function updateVariant(id: string, data: Partial<{
  name: string; price: number; unitCost: number | null; stockQuantity: number; sortOrder: number; isActive: boolean
}>, tx: Tx = prisma) {
  return tx.productVariant.update({ where: { id }, data })
}

export function deleteVariant(id: string, tx: Tx = prisma) {
  return tx.productVariant.delete({ where: { id } })
}

/**
 * Atomic decrement: returns count=1 on success, 0 when stock insufficient.
 * Caller treats 0 as "sold out" and rolls back the surrounding transaction.
 */
export function decrementVariantStock(variantId: string, tx: Tx) {
  return tx.productVariant.updateMany({
    where: { id: variantId, stockQuantity: { gte: 1 } },
    data: { stockQuantity: { decrement: 1 } },
  })
}

export function incrementVariantStock(variantId: string, by = 1, tx: Tx = prisma) {
  return tx.productVariant.update({
    where: { id: variantId },
    data: { stockQuantity: { increment: by } },
  })
}
```

- [ ] **Step 4: Create `service.ts`**

```ts
import { prisma } from "@/lib/prisma"
import {
  findVariantsByProduct,
  findVariantById,
  countActiveVariants,
  countOrdersForVariant,
  createVariant as repoCreate,
  updateVariant as repoUpdate,
  deleteVariant as repoDelete,
} from "./repository"
import type { VariantRow } from "./types"
import { VariantNotFoundError, VariantHasOrdersError, NotManualProductError } from "./types"
import type { VariantCreateInput, VariantUpdateInput } from "./validators"

function toRow(v: Awaited<ReturnType<typeof findVariantById>>): VariantRow {
  if (!v) throw new Error("toRow: null variant")
  return {
    id: v.id,
    name: v.name,
    price: v.price.toString(),
    unitCost: v.unitCost?.toString() ?? null,
    stockQuantity: v.stockQuantity,
    sortOrder: v.sortOrder,
    isActive: v.isActive,
    createdAt: v.createdAt.toISOString(),
  }
}

export async function listVariants(productId: string): Promise<VariantRow[]> {
  const rows = await findVariantsByProduct(productId)
  return rows.map(toRow)
}

async function assertManualProduct(productId: string) {
  const p = await prisma.product.findUnique({ where: { id: productId }, select: { productType: true } })
  if (!p || p.productType !== "MANUAL") throw new NotManualProductError()
}

export async function createVariantForProduct(productId: string, input: VariantCreateInput): Promise<VariantRow> {
  await assertManualProduct(productId)
  const created = await repoCreate(productId, input)
  return toRow(created)
}

export async function updateVariantById(variantId: string, input: VariantUpdateInput): Promise<VariantRow> {
  const existing = await findVariantById(variantId)
  if (!existing) throw new VariantNotFoundError(variantId)
  const updated = await repoUpdate(variantId, input)
  // If the product had its last active variant deactivated, auto-deactivate product
  if (input.isActive === false) {
    await deactivateProductIfNoActiveVariants(existing.productId)
  }
  return toRow(updated)
}

export async function deleteVariantById(variantId: string): Promise<void> {
  const existing = await findVariantById(variantId)
  if (!existing) throw new VariantNotFoundError(variantId)
  const orderCount = await countOrdersForVariant(variantId)
  if (orderCount > 0) throw new VariantHasOrdersError(variantId)
  await repoDelete(variantId)
  await deactivateProductIfNoActiveVariants(existing.productId)
}

async function deactivateProductIfNoActiveVariants(productId: string): Promise<void> {
  const active = await countActiveVariants(productId)
  if (active === 0) {
    await prisma.product.update({ where: { id: productId }, data: { status: "INACTIVE" } })
  }
}

export async function assertProductHasActiveVariant(productId: string): Promise<void> {
  const active = await countActiveVariants(productId)
  if (active === 0) {
    throw new Error("MANUAL product must have at least one active variant before going ACTIVE")
  }
}
```

- [ ] **Step 5: Create `index.ts` barrel**

```ts
export {
  listVariants,
  createVariantForProduct,
  updateVariantById,
  deleteVariantById,
  assertProductHasActiveVariant,
} from "./service"
export { findVariantById, decrementVariantStock, incrementVariantStock } from "./repository"
export type { VariantRow } from "./types"
export {
  VariantNotFoundError,
  VariantHasOrdersError,
  NotManualProductError,
} from "./types"
export { variantCreateSchema, variantUpdateSchema } from "./validators"
export type { VariantCreateInput, VariantUpdateInput } from "./validators"
```

- [ ] **Step 6: Write tests**

Create `lib/domains/variants/__tests__/service.test.ts`. Cover:
- `createVariantForProduct` throws `NotManualProductError` for non-MANUAL product
- `deleteVariantById` throws `VariantHasOrdersError` when orderCount > 0
- `updateVariantById` with `isActive: false` triggers `deactivateProductIfNoActiveVariants`
- `deleteVariantById` deactivates product when last active variant removed

```ts
import { createVariantForProduct, deleteVariantById, updateVariantById } from "../service"
import { NotManualProductError, VariantHasOrdersError } from "../types"
import { prisma } from "@/lib/prisma"

jest.mock("@/lib/prisma", () => ({
  prisma: {
    product: { findUnique: jest.fn(), update: jest.fn() },
    productVariant: {
      create: jest.fn(), findUnique: jest.fn(), update: jest.fn(),
      delete: jest.fn(), count: jest.fn(), findMany: jest.fn(),
    },
    order: { count: jest.fn() },
  },
}))

const p = prisma as unknown as {
  product: { findUnique: jest.Mock; update: jest.Mock }
  productVariant: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock; count: jest.Mock }
  order: { count: jest.Mock }
}

describe("variants service", () => {
  beforeEach(() => jest.clearAllMocks())

  it("rejects createVariantForProduct on NORMAL product", async () => {
    p.product.findUnique.mockResolvedValue({ productType: "NORMAL" })
    await expect(
      createVariantForProduct("prod1", { name: "X", price: 9.9, stockQuantity: 1 }),
    ).rejects.toBeInstanceOf(NotManualProductError)
  })

  it("rejects delete when orders exist", async () => {
    p.productVariant.findUnique.mockResolvedValue({ id: "v1", productId: "prod1" })
    p.order.count.mockResolvedValue(2)
    await expect(deleteVariantById("v1")).rejects.toBeInstanceOf(VariantHasOrdersError)
  })

  it("auto-deactivates product when last active variant deactivated", async () => {
    p.productVariant.findUnique.mockResolvedValue({ id: "v1", productId: "prod1", isActive: true })
    p.productVariant.update.mockResolvedValue({
      id: "v1", productId: "prod1", name: "X", price: { toString: () => "9.9" }, unitCost: null,
      stockQuantity: 0, sortOrder: 0, isActive: false, createdAt: new Date(),
    })
    p.productVariant.count.mockResolvedValue(0)
    p.product.update.mockResolvedValue({})

    await updateVariantById("v1", { isActive: false })

    expect(p.product.update).toHaveBeenCalledWith({
      where: { id: "prod1" },
      data: { status: "INACTIVE" },
    })
  })
})
```

Run: `npx jest lib/domains/variants -i`
Expected: 3 tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/domains/variants/
git commit -m "feat(domains/variants): CRUD service + auto-deactivate product on empty variants"
```

---

## Phase B — Core Domain Modules

### Task 4: `lib/order-state-machine.ts`

**Files:**
- Create: `lib/order-state-machine.ts`
- Test: `__tests__/lib/order-state-machine.test.ts`

- [ ] **Step 1: Write failing test**

Create `__tests__/lib/order-state-machine.test.ts`:
```ts
import { canTransition, assertTransition, InvalidTransitionError } from "@/lib/order-state-machine"

describe("order state machine", () => {
  it("allows PENDING → COMPLETED for NORMAL/AUTO_FETCH only", () => {
    expect(canTransition("PENDING", "COMPLETED", "NORMAL")).toBe(true)
    expect(canTransition("PENDING", "COMPLETED", "AUTO_FETCH")).toBe(true)
    expect(canTransition("PENDING", "COMPLETED", "MANUAL")).toBe(false)
  })

  it("allows PENDING → AWAITING_FULFILLMENT for MANUAL only", () => {
    expect(canTransition("PENDING", "AWAITING_FULFILLMENT", "MANUAL")).toBe(true)
    expect(canTransition("PENDING", "AWAITING_FULFILLMENT", "NORMAL")).toBe(false)
  })

  it("allows AWAITING_FULFILLMENT → COMPLETED (skip PROCESSING)", () => {
    expect(canTransition("AWAITING_FULFILLMENT", "COMPLETED", "MANUAL")).toBe(true)
  })

  it("allows AWAITING_FULFILLMENT → PROCESSING and PROCESSING → COMPLETED", () => {
    expect(canTransition("AWAITING_FULFILLMENT", "PROCESSING", "MANUAL")).toBe(true)
    expect(canTransition("PROCESSING", "COMPLETED", "MANUAL")).toBe(true)
  })

  it("allows CLOSED from PENDING/AWAITING_FULFILLMENT/PROCESSING", () => {
    expect(canTransition("PENDING", "CLOSED", "NORMAL")).toBe(true)
    expect(canTransition("AWAITING_FULFILLMENT", "CLOSED", "MANUAL")).toBe(true)
    expect(canTransition("PROCESSING", "CLOSED", "MANUAL")).toBe(true)
  })

  it("rejects COMPLETED → anything and CLOSED → anything", () => {
    expect(canTransition("COMPLETED", "PROCESSING", "MANUAL")).toBe(false)
    expect(canTransition("CLOSED", "PENDING", "MANUAL")).toBe(false)
  })

  it("assertTransition throws InvalidTransitionError on illegal", () => {
    expect(() => assertTransition("COMPLETED", "PENDING", "NORMAL")).toThrow(InvalidTransitionError)
  })

  it("assertTransition no-throw on legal", () => {
    expect(() => assertTransition("PENDING", "COMPLETED", "NORMAL")).not.toThrow()
  })
})
```

Run: `npx jest __tests__/lib/order-state-machine.test.ts -i`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement**

Create `lib/order-state-machine.ts`:
```ts
import type { OrderStatus, ProductType } from "@prisma/client"

type Rule = { from: OrderStatus; to: OrderStatus; productTypes: ReadonlyArray<ProductType> }

const ALL_TYPES: ReadonlyArray<ProductType> = ["NORMAL", "AUTO_FETCH", "MANUAL"]

const RULES: ReadonlyArray<Rule> = [
  { from: "PENDING", to: "COMPLETED", productTypes: ["NORMAL", "AUTO_FETCH"] },
  { from: "PENDING", to: "AWAITING_FULFILLMENT", productTypes: ["MANUAL"] },
  { from: "PENDING", to: "CLOSED", productTypes: ALL_TYPES },
  { from: "AWAITING_FULFILLMENT", to: "PROCESSING", productTypes: ["MANUAL"] },
  { from: "AWAITING_FULFILLMENT", to: "COMPLETED", productTypes: ["MANUAL"] },
  { from: "AWAITING_FULFILLMENT", to: "CLOSED", productTypes: ["MANUAL"] },
  { from: "PROCESSING", to: "COMPLETED", productTypes: ["MANUAL"] },
  { from: "PROCESSING", to: "CLOSED", productTypes: ["MANUAL"] },
]

export class InvalidTransitionError extends Error {
  constructor(from: OrderStatus, to: OrderStatus, productType: ProductType) {
    super(`Illegal order transition: ${from} → ${to} (productType=${productType})`)
    this.name = "InvalidTransitionError"
  }
}

export function canTransition(from: OrderStatus, to: OrderStatus, productType: ProductType): boolean {
  return RULES.some((r) => r.from === from && r.to === to && r.productTypes.includes(productType))
}

export function assertTransition(from: OrderStatus, to: OrderStatus, productType: ProductType): void {
  if (!canTransition(from, to, productType)) {
    throw new InvalidTransitionError(from, to, productType)
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npx jest __tests__/lib/order-state-machine.test.ts -i`
Expected: all 8 tests pass.

- [ ] **Step 4: Commit**

```bash
git add lib/order-state-machine.ts __tests__/lib/order-state-machine.test.ts
git commit -m "feat(order): centralized state machine with transition guards"
```

---

### Task 5: `lib/business-hours.ts`

**Files:**
- Create: `lib/business-hours.ts`
- Test: `__tests__/lib/business-hours.test.ts`

- [ ] **Step 1: Write failing test**

Create `__tests__/lib/business-hours.test.ts`. Set timezone explicitly via fixed `Asia/Shanghai` dates:
```ts
import {
  isWithinBusinessHours,
  nextWindowStart,
  formatEtaText,
  type BusinessHoursConfig,
} from "@/lib/business-hours"

const SH = "Asia/Shanghai"

function shDate(iso: string): Date {
  // iso assumed to be "YYYY-MM-DDTHH:mm:ss" in Shanghai local time
  // Shanghai is UTC+8, no DST → subtract 8h to get UTC
  return new Date(iso + "+08:00")
}

describe("business-hours", () => {
  const cfg: BusinessHoursConfig = { start: 9, end: 22, weekdays: [0, 1, 2, 3, 4, 5, 6], timezone: SH }

  it("isWithinBusinessHours: 10:00 Mon, 9-22 all-days → true", () => {
    expect(isWithinBusinessHours(shDate("2026-05-25T10:00:00"), cfg)).toBe(true)
  })

  it("isWithinBusinessHours: 23:00 → false", () => {
    expect(isWithinBusinessHours(shDate("2026-05-25T23:00:00"), cfg)).toBe(false)
  })

  it("isWithinBusinessHours: 09:00 (boundary start) → true; 22:00 (boundary end exclusive) → false", () => {
    expect(isWithinBusinessHours(shDate("2026-05-25T09:00:00"), cfg)).toBe(true)
    expect(isWithinBusinessHours(shDate("2026-05-25T22:00:00"), cfg)).toBe(false)
  })

  it("cross-night window 22→6: 23:00 → true (Mon counts), 05:00 → true (Tue counts as Mon's window), 07:00 → false", () => {
    const c: BusinessHoursConfig = { start: 22, end: 6, weekdays: [1], timezone: SH }
    expect(isWithinBusinessHours(shDate("2026-05-25T23:00:00"), c)).toBe(true)  // Mon 23:00
    expect(isWithinBusinessHours(shDate("2026-05-26T05:00:00"), c)).toBe(true)  // Tue 05:00 belongs to Mon window
    expect(isWithinBusinessHours(shDate("2026-05-26T07:00:00"), c)).toBe(false)
    expect(isWithinBusinessHours(shDate("2026-05-26T22:00:00"), c)).toBe(false) // Tue not in weekdays
  })

  it("excludes weekdays not in set", () => {
    const c: BusinessHoursConfig = { start: 9, end: 22, weekdays: [1, 2, 3, 4, 5], timezone: SH }
    expect(isWithinBusinessHours(shDate("2026-05-23T10:00:00"), c)).toBe(false) // Sat
    expect(isWithinBusinessHours(shDate("2026-05-25T10:00:00"), c)).toBe(true)  // Mon
  })

  it("nextWindowStart returns now when in-window", () => {
    const now = shDate("2026-05-25T10:00:00")
    expect(nextWindowStart(now, cfg).getTime()).toBe(now.getTime())
  })

  it("nextWindowStart: 23:00 (out-of-window) → next day 09:00", () => {
    const now = shDate("2026-05-25T23:00:00")
    const next = nextWindowStart(now, cfg)
    // expect SH date 2026-05-26 09:00
    expect(next.toISOString()).toBe("2026-05-26T01:00:00.000Z") // 09:00 SH = 01:00 UTC
  })

  it("nextWindowStart skips disallowed weekdays", () => {
    const c: BusinessHoursConfig = { start: 9, end: 22, weekdays: [1], timezone: SH }
    const now = shDate("2026-05-23T10:00:00") // Saturday
    const next = nextWindowStart(now, c)
    // next Monday 9:00 SH = 2026-05-25T01:00:00Z
    expect(next.toISOString()).toBe("2026-05-25T01:00:00.000Z")
  })

  it("formatEtaText in-window mentions '通常在'", () => {
    const txt = formatEtaText(shDate("2026-05-25T10:00:00"), cfg)
    expect(txt).toMatch(/通常在/)
  })

  it("formatEtaText out-of-window mentions '非工作时间'", () => {
    const txt = formatEtaText(shDate("2026-05-25T23:00:00"), cfg)
    expect(txt).toMatch(/非工作时间/)
  })
})
```

Run: `npx jest __tests__/lib/business-hours.test.ts -i`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement**

Create `lib/business-hours.ts`:
```ts
import { formatInTimeZone, toDate } from "date-fns-tz"
import { addDays, addHours, startOfHour } from "date-fns"

export type BusinessHoursConfig = {
  start: number          // hour 0-23
  end: number            // hour 0-23; end <= start means cross-night
  weekdays: number[]     // 0=Sun, 6=Sat
  timezone: string       // IANA tz, e.g. "Asia/Shanghai"
}

function getZonedParts(date: Date, tz: string): { hour: number; weekday: number; year: number; month: number; day: number } {
  const formatted = formatInTimeZone(date, tz, "yyyy-MM-dd HH e")
  // "e" is ISO day-of-week 1-7; convert to 0-6 with 0=Sun
  const [ymd, hour, eDay] = formatted.split(" ")
  const [y, m, d] = ymd.split("-").map(Number)
  const isoWeekday = Number(eDay)
  const weekday = isoWeekday === 7 ? 0 : isoWeekday
  return { hour: Number(hour), weekday, year: y, month: m, day: d }
}

function isCrossNight(cfg: BusinessHoursConfig): boolean {
  return cfg.end <= cfg.start
}

export function isWithinBusinessHours(now: Date, cfg: BusinessHoursConfig): boolean {
  const { hour, weekday } = getZonedParts(now, cfg.timezone)
  const cross = isCrossNight(cfg)
  if (cross) {
    // hour ∈ [start, 24) on the listed weekday  OR  hour ∈ [0, end) on the day after a listed weekday
    if (hour >= cfg.start && cfg.weekdays.includes(weekday)) return true
    if (hour < cfg.end) {
      const prevWeekday = (weekday + 6) % 7
      if (cfg.weekdays.includes(prevWeekday)) return true
    }
    return false
  }
  return cfg.weekdays.includes(weekday) && hour >= cfg.start && hour < cfg.end
}

export function nextWindowStart(now: Date, cfg: BusinessHoursConfig): Date {
  if (isWithinBusinessHours(now, cfg)) return now
  // Walk forward day-by-day (up to 14 days; cfg.weekdays guaranteed non-empty by getSiteSettings parser)
  let probe = now
  for (let i = 0; i < 14; i++) {
    const { hour, weekday, year, month, day } = getZonedParts(probe, cfg.timezone)
    if (cfg.weekdays.includes(weekday) && hour < cfg.start) {
      // Today still has an upcoming window start at cfg.start
      return toDate(`${year}-${pad(month)}-${pad(day)}T${pad(cfg.start)}:00:00`, { timeZone: cfg.timezone })
    }
    probe = addDays(probe, 1)
  }
  throw new Error("nextWindowStart: no upcoming window in 14 days")
}

function pad(n: number): string { return n.toString().padStart(2, "0") }

export function formatEtaText(now: Date, cfg: BusinessHoursConfig): string {
  if (isWithinBusinessHours(now, cfg)) return "卖家通常在 15 分钟内发货"
  const next = nextWindowStart(now, cfg)
  const human = formatInTimeZone(next, cfg.timezone, "M 月 d 日 HH:mm")
  return `非工作时间，卖家将在 ${human} 后处理`
}
```

- [ ] **Step 3: Run tests**

Run: `npx jest __tests__/lib/business-hours.test.ts -i`
Expected: 10 tests pass.

If `nextWindowStart` test fails due to off-by-one in `pad` or the `toDate` API, iterate. Note: `date-fns-tz@^3.2.0` `toDate(str, { timeZone })` parses the local-tz datetime string into a UTC Date.

- [ ] **Step 4: Commit**

```bash
git add lib/business-hours.ts __tests__/lib/business-hours.test.ts
git commit -m "feat(business-hours): timezone-aware window + ETA formatter (hours granularity, cross-night)"
```

---

### Task 6: `lib/wecom-notify.ts`

**Files:**
- Create: `lib/wecom-notify.ts`
- Test: `__tests__/lib/wecom-notify.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { sendWecomNotification } from "@/lib/wecom-notify"
import { prisma } from "@/lib/prisma"
import { getSiteSettings } from "@/lib/site-settings"

jest.mock("@/lib/site-settings")
jest.mock("@/lib/prisma", () => ({
  prisma: { notificationLog: { create: jest.fn() } },
}))

global.fetch = jest.fn() as unknown as typeof fetch

const mockOrder = {
  id: "ord1", orderNo: "abc-123", amount: { toString: () => "29.90" },
  email: "b@x.com", status: "AWAITING_FULFILLMENT",
  productNameSnapshot: "Netflix 高级版", variantNameSnapshot: "3 个月",
} as any

describe("wecom-notify", () => {
  beforeEach(() => jest.clearAllMocks())

  it("no-op when wecomWebhookUrl is empty", async () => {
    ;(getSiteSettings as jest.Mock).mockResolvedValue({ wecomWebhookUrl: undefined })
    await sendWecomNotification("order.awaiting_fulfillment", mockOrder)
    expect(global.fetch).not.toHaveBeenCalled()
    expect(prisma.notificationLog.create).not.toHaveBeenCalled()
  })

  it("POSTs markdown to the configured URL and logs success", async () => {
    ;(getSiteSettings as jest.Mock).mockResolvedValue({
      wecomWebhookUrl: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=KEY",
    })
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })

    await sendWecomNotification("order.awaiting_fulfillment", mockOrder)

    expect(global.fetch).toHaveBeenCalledWith(
      "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=KEY",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("msgtype"),
      }),
    )
    expect(prisma.notificationLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ channel: "wecom", status: "sent", orderId: "ord1" }),
    }))
  })

  it("logs failure when fetch rejects", async () => {
    ;(getSiteSettings as jest.Mock).mockResolvedValue({
      wecomWebhookUrl: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=KEY",
    })
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error("network"))

    await expect(
      sendWecomNotification("order.awaiting_fulfillment", mockOrder),
    ).resolves.toBeUndefined()

    expect(prisma.notificationLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "failed", error: expect.stringContaining("network") }),
    }))
  })
})
```

Run: `npx jest __tests__/lib/wecom-notify.test.ts -i`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement**

Create `lib/wecom-notify.ts`:
```ts
import { prisma } from "@/lib/prisma"
import { getSiteSettings } from "@/lib/site-settings"
import { config } from "@/lib/config"

export type WecomEvent = "order.awaiting_fulfillment" | "order.dun"

type OrderForNotify = {
  id: string
  orderNo: string
  amount: { toString(): string }
  email: string
  status: string
  productNameSnapshot: string | null
  variantNameSnapshot: string | null
  dunCount?: number
}

function buildMarkdown(event: WecomEvent, order: OrderForNotify): string {
  const adminLink = `${config.siteUrl}/admin/orders/${order.id}`
  const sku = order.variantNameSnapshot ?? "—"
  const product = order.productNameSnapshot ?? "—"
  switch (event) {
    case "order.awaiting_fulfillment":
      return [
        `### 🆕 新订单待发货`,
        `> 商品：**${product}**`,
        `> 规格：${sku}`,
        `> 金额：¥${order.amount.toString()}`,
        `> 买家：${order.email}`,
        `> 订单号：\`${order.orderNo}\``,
        `[在后台处理](${adminLink})`,
      ].join("\n")
    case "order.dun":
      return [
        `### ⏰ 买家催发货（已累计 ${order.dunCount ?? 1} 次）`,
        `> 商品：**${product}**`,
        `> 规格：${sku}`,
        `> 订单号：\`${order.orderNo}\``,
        `[立刻处理](${adminLink})`,
      ].join("\n")
  }
}

export async function sendWecomNotification(event: WecomEvent, order: OrderForNotify): Promise<void> {
  const settings = await getSiteSettings()
  const url = settings.wecomWebhookUrl
  if (!url) return

  const content = buildMarkdown(event, order)
  const payload = { msgtype: "markdown", markdown: { content } }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      await logFail(event, payload, order.id, `HTTP ${res.status}`)
      return
    }
    await prisma.notificationLog.create({
      data: {
        channel: "wecom", event, payload: JSON.stringify(payload),
        status: "sent", orderId: order.id,
      },
    })
  } catch (err) {
    await logFail(event, payload, order.id, err instanceof Error ? err.message : String(err))
  }
}

async function logFail(event: WecomEvent, payload: unknown, orderId: string, error: string) {
  try {
    await prisma.notificationLog.create({
      data: {
        channel: "wecom", event, payload: JSON.stringify(payload),
        status: "failed", error, orderId,
      },
    })
  } catch (logErr) {
    console.error("[wecom-notify] failed to log failure", logErr)
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npx jest __tests__/lib/wecom-notify.test.ts -i`
Expected: 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add lib/wecom-notify.ts __tests__/lib/wecom-notify.test.ts
git commit -m "feat(wecom-notify): fire-and-forget POST to qyapi webhook with NotificationLog persistence"
```

---

## Phase C — Order Flow Wiring

### Task 7: Create-order API — MANUAL branch

**Files:**
- Modify: `app/api/orders/route.ts`
- Modify: `lib/validations/order.ts`
- Test: `__tests__/app/api/orders/create-manual.test.ts`

- [ ] **Step 1: Extend `createOrderSchema`**

In `lib/validations/order.ts`, add `variantId: z.string().cuid().optional()` to the order body schema (locate existing `createOrderSchema`):
```ts
export const createOrderSchema = z.object({
  // ... existing ...
  variantId: z.string().cuid().optional(),
})
```

- [ ] **Step 2: Write failing test**

Create `__tests__/app/api/orders/create-manual.test.ts`. Test that POST `/api/orders` with a MANUAL product:
- Requires `variantId`
- Rejects if variant belongs to a different product
- Rejects if variant is inactive
- Rejects if `stockQuantity = 0`
- Writes `variantNameSnapshot` and `unitPriceSnapshot=variant.price`
- Sets `quantity` to 1 regardless of input

(Mock `prisma.product.findUnique`, `prisma.productVariant.findUnique`, `prisma.order.create`. Use `next-test-api-route-handler` if already in repo, otherwise call the route handler directly with a mocked `NextRequest`.)

Run: `npx jest __tests__/app/api/orders/create-manual.test.ts -i`
Expected: FAIL.

- [ ] **Step 3: Add MANUAL branch in `app/api/orders/route.ts`**

Find the `POST` handler. After product lookup (around line ~565 where `isAutoFetch` is computed), insert:
```ts
const isManual = productWithType.productType === "MANUAL"

if (isManual) {
  if (!parsed.data.variantId) {
    return validationError({ variantId: ["MANUAL 商品必须选择规格"] })
  }
  const variant = await prisma.productVariant.findUnique({ where: { id: parsed.data.variantId } })
  if (!variant || variant.productId !== productWithType.id) {
    return validationError({ variantId: ["规格不存在"] })
  }
  if (!variant.isActive) {
    return validationError({ variantId: ["该规格已停售"] })
  }
  if (variant.stockQuantity < 1) {
    return validationError({ variantId: ["该规格已售罄"] })
  }
  // override
  parsed.data.quantity = 1
  // continue to common Order.create below, passing variant fields
}
```

In the `prisma.order.create` data block, conditionally include MANUAL fields:
```ts
const orderData: Prisma.OrderCreateInput = {
  // ... existing fields ...
  ...(isManual && variant ? {
    variantId: variant.id,
    variantNameSnapshot: variant.name,
    unitPriceSnapshot: variant.price,
  } : {
    unitPriceSnapshot: productWithType.price,
  }),
  // ...
}
```

Skip cross-sell / exit-discount usage for MANUAL (already covered in Task 15 but ensure the MANUAL branch doesn't accidentally activate them).

- [ ] **Step 4: Run tests**

Run: `npx jest __tests__/app/api/orders/create-manual.test.ts -i`
Expected: 5 tests pass.

- [ ] **Step 5: Regression check**

Run: `npx jest __tests__/app/api/orders -i`
Expected: existing NORMAL/AUTO_FETCH tests still pass.

- [ ] **Step 6: Commit**

```bash
git add app/api/orders/route.ts lib/validations/order.ts __tests__/app/api/orders/create-manual.test.ts
git commit -m "feat(orders): MANUAL branch in POST /api/orders with variant validation + snapshots"
```

---

### Task 8: Payment callback — MANUAL branch in `complete-pending-order.ts`

**Files:**
- Modify: `lib/complete-pending-order.ts`
- Test: `__tests__/lib/complete-pending-order-manual.test.ts`

- [ ] **Step 1: Write failing test**

`__tests__/lib/complete-pending-order-manual.test.ts`:
- For MANUAL order: transitions PENDING → AWAITING_FULFILLMENT
- Calls `decrementVariantStock` (optimistic lock)
- Writes `costTotalSnapshot = variant.unitCost`
- Does NOT mark cards SOLD
- Does NOT call `createOrderCommissions`
- Triggers `sendWecomNotification("order.awaiting_fulfillment", ...)`
- On stock-lock failure: order stays PENDING, no notification

Run: `npx jest __tests__/lib/complete-pending-order-manual.test.ts -i`
Expected: FAIL.

- [ ] **Step 2: Refactor `completePendingOrder`**

Add MANUAL branch BEFORE the existing transaction:
```ts
const isManual = order.product?.productType === "MANUAL"

if (isManual) {
  return await completeManualOrder(order)  // new helper below
}

// existing logic for NORMAL/AUTO_FETCH unchanged
```

Add helper at bottom of `lib/complete-pending-order.ts`:
```ts
import { decrementVariantStock } from "@/lib/domains/variants"
import { sendWecomNotification } from "@/lib/wecom-notify"
import { assertTransition } from "@/lib/order-state-machine"

async function completeManualOrder(
  order: { id: string; orderNo: string; variantId: string | null; status: string; product: { productType: string } | null },
): Promise<CompletePendingOrderResult> {
  if (!order.variantId) return { done: false, error: "MANUAL order missing variantId" }
  assertTransition("PENDING", "AWAITING_FULFILLMENT", "MANUAL")

  const paidAt = new Date()
  let stockOk = false

  await prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.findUnique({ where: { id: order.variantId! } })
    if (!variant) throw new Error("Variant disappeared")
    const decRes = await decrementVariantStock(order.variantId!, tx)
    if (decRes.count === 0) {
      // out of stock — abort by throwing, the transaction will roll back
      throw new OutOfStockSentinel()
    }
    // Use updateMany so we can carry the "status must still be PENDING" guard;
    // Prisma's `update` only accepts WhereUniqueInput, which can't include status.
    const orderUpd = await tx.order.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: {
        status: "AWAITING_FULFILLMENT",
        paidAt,
        costTotalSnapshot: variant.unitCost ?? new Prisma.Decimal(0),
      },
    })
    if (orderUpd.count === 0) {
      // someone else completed it in the meantime; roll back stock decrement too
      throw new ConcurrentCompletionSentinel()
    }
    stockOk = true
  }).catch((err) => {
    if (err instanceof OutOfStockSentinel || err instanceof ConcurrentCompletionSentinel) {
      stockOk = false
      return
    }
    throw err
  })

  if (!stockOk) {
    console.warn("[complete-manual] stock lock or status race for order", order.orderNo)
    return { done: false, error: "Out of stock or already completed; order left as-is" }
  }

  sendWecomNotification("order.awaiting_fulfillment", {
    id: order.id,
    orderNo: order.orderNo,
    amount: order.amount,
    email: order.email,
    status: "AWAITING_FULFILLMENT",
    productNameSnapshot: order.productNameSnapshot,
    variantNameSnapshot: order.variantNameSnapshot,
  } as any).catch((err) => console.error("[wecom-notify]", err))

  return { done: true, orderNo: order.orderNo }
}

class OutOfStockSentinel extends Error { constructor() { super("Out of stock"); this.name = "OutOfStockSentinel" } }
class ConcurrentCompletionSentinel extends Error { constructor() { super("Order already completed"); this.name = "ConcurrentCompletionSentinel" } }
```

Update the `prisma.order.findFirst` call near the top of `completePendingOrder` to include `variantId`, `email`, `amount`, `productNameSnapshot`, `variantNameSnapshot`:
```ts
const order = await prisma.order.findFirst({
  where: { orderNo },
  include: {
    product: { select: { name: true, productType: true, validityHours: true } },
    cards: { select: { id: true, status: true, unitCost: true } },
  },
  // existing variantId / email / amount / snapshots are top-level Order fields,
  // automatically included
})
```

- [ ] **Step 3: Run tests**

Run: `npx jest __tests__/lib/complete-pending-order-manual.test.ts -i`
Expected: 6 tests pass.

Run: `npx jest __tests__/lib/complete-pending-order.test.ts -i` (if exists)
Expected: existing NORMAL/AUTO_FETCH tests still pass.

- [ ] **Step 4: Commit**

```bash
git add lib/complete-pending-order.ts __tests__/lib/complete-pending-order-manual.test.ts
git commit -m "feat(orders): MANUAL payment callback transitions to AWAITING_FULFILLMENT + decrements variant stock"
```

---

### Task 9: Close-order API — restock variant on CLOSED

**Files:**
- Modify: `app/api/orders/[orderId]/route.ts`
- Test: `__tests__/app/api/orders/close-manual.test.ts`

- [ ] **Step 1: Write failing test**

`__tests__/app/api/orders/close-manual.test.ts`:
- PATCH /api/orders/[id] with `{ status: "CLOSED" }` on MANUAL order in `AWAITING_FULFILLMENT`
  → variant.stockQuantity += 1, order.status → CLOSED
- Same on `PROCESSING` → restock + close
- PATCH on already COMPLETED → reject (illegal transition)

Run: `npx jest __tests__/app/api/orders/close-manual.test.ts -i`
Expected: FAIL.

- [ ] **Step 2: Replace `isValidStatusTransition` with the state machine**

In `app/api/orders/[orderId]/route.ts` at line ~127, replace:
```ts
if (!isValidStatusTransition(currentStatus, nextStatus)) {
  return conflict("Invalid status transition")
}
```
with:
```ts
import { canTransition } from "@/lib/order-state-machine"

const productType = existing.product?.productType ?? "NORMAL"
if (!canTransition(currentStatus, nextStatus, productType)) {
  return conflict("Invalid status transition")
}
```

Delete the old `isValidStatusTransition` helper from this file.

In the existing `nextStatus === "CLOSED"` branch (line ~147), wrap the transaction to also restock the variant when MANUAL:
```ts
} else if (nextStatus === "CLOSED") {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: existing.id }, data: { status: "CLOSED" } })
      if (currentStatus === "PENDING") {
        await tx.card.updateMany({
          where: { orderId: existing.id, status: "RESERVED" },
          data: { status: "UNSOLD", orderId: null },
        })
      }
      if (
        productType === "MANUAL" &&
        (currentStatus === "AWAITING_FULFILLMENT" || currentStatus === "PROCESSING") &&
        existing.variantId
      ) {
        await tx.productVariant.update({
          where: { id: existing.variantId },
          data: { stockQuantity: { increment: 1 } },
        })
      }
    })
  } catch { return internalServerError() }
}
```

The `existing` query already returns `productId` & cards; add `variantId` and `product.productType` to its include:
```ts
const existing = await prisma.order.findUnique({
  where: { id: orderId },
  include: {
    product: { select: { id: true, productType: true, name: true, price: true } },
    cards: { select: { id: true, status: true } },
  },
})
```

- [ ] **Step 3: Run tests**

Run: `npx jest __tests__/app/api/orders/close-manual.test.ts -i`
Expected: 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/api/orders/[orderId]/route.ts __tests__/app/api/orders/close-manual.test.ts
git commit -m "feat(orders): close-order restocks variant for MANUAL in AWAITING/PROCESSING"
```

---

### Task 10: Email template — `accountContent` unification

**Files:**
- Modify: `app/emails/order-completion.tsx`
- Modify: `lib/order-completion-email.ts`
- Test: `__tests__/lib/order-completion-email.test.ts` (modify or create)

- [ ] **Step 1: Update email template signature**

In `app/emails/order-completion.tsx`, change the props:
```ts
type Props = {
  orderNo: string
  productName: string
  quantity: number
  accountContent: string    // was: cards: Array<{ content: string }>
  lookupUrl: string
  brandName: string
}
```

In the template body, render `accountContent` as a `<Text style={{ whiteSpace: "pre-wrap" }}>{accountContent}</Text>`. Remove the `cards.map` loop.

- [ ] **Step 2: Update assembly in `lib/order-completion-email.ts`**

Replace:
```ts
const order = await prisma.order.findUnique({
  where: { id: orderId },
  include: {
    product: { select: { name: true, productType: true } },
    cards: { where: { status: "SOLD" }, select: { content: true } },
    fulfillment: { select: { content: true } },
  },
})
```

Build `accountContent`:
```ts
const accountContent = order.product.productType === "MANUAL"
  ? order.fulfillment?.content ?? ""
  : order.cards.map((c) => c.content).join("\n\n")

if (!accountContent) {
  console.warn("[order-completion-email] empty accountContent for order", orderId)
  return
}
```

Pass `accountContent` to the template instead of `cards`.

- [ ] **Step 3: Update test**

```ts
it("assembles accountContent from cards for NORMAL order", async () => {
  // ... mock NORMAL order with two cards ...
  await sendOrderCompletionEmail("ord1")
  expect(renderProps.accountContent).toBe("card1-content\n\ncard2-content")
})

it("assembles accountContent from fulfillment for MANUAL order", async () => {
  // ... mock MANUAL order with fulfillment ...
  await sendOrderCompletionEmail("ord2")
  expect(renderProps.accountContent).toBe("manual-content")
})
```

Run: `npx jest __tests__/lib/order-completion-email.test.ts -i`
Expected: tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/emails/order-completion.tsx lib/order-completion-email.ts __tests__/lib/order-completion-email.test.ts
git commit -m "feat(email): unify OrderCompletion template to accountContent (cards or fulfillment text)"
```

---

## Phase D — New API Endpoints

### Task 11: `POST /api/admin/orders/[orderId]/take`

**Files:**
- Create: `app/api/admin/orders/[orderId]/take/route.ts`
- Test: `__tests__/app/api/admin/orders/take.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// POST /api/admin/orders/[id]/take
// - 401 if no admin session
// - 409 if order not in AWAITING_FULFILLMENT
// - 200 transitions order to PROCESSING
```

Run: `npx jest __tests__/app/api/admin/orders/take.test.ts -i`
Expected: FAIL.

- [ ] **Step 2: Implement**

```ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { assertTransition, InvalidTransitionError } from "@/lib/order-state-machine"
import { unauthorized, conflict, notFound, internalServerError } from "@/lib/api-response"

export async function POST(_request: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { orderId } = await ctx.params
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { product: { select: { productType: true } } },
  })
  if (!order) return notFound("Order not found")
  if (!order.product) return internalServerError()

  try {
    assertTransition(order.status, "PROCESSING", order.product.productType)
  } catch (err) {
    if (err instanceof InvalidTransitionError) return conflict(err.message)
    throw err
  }

  await prisma.order.update({ where: { id: orderId }, data: { status: "PROCESSING" } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Run tests**

Run: `npx jest __tests__/app/api/admin/orders/take.test.ts -i`
Expected: 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/orders/[orderId]/take/ __tests__/app/api/admin/orders/take.test.ts
git commit -m "feat(orders): POST /api/admin/orders/[id]/take transitions AWAITING_FULFILLMENT → PROCESSING"
```

---

### Task 12: `POST /api/admin/orders/[orderId]/fulfill`

**Files:**
- Create: `app/api/admin/orders/[orderId]/fulfill/route.ts`
- Test: `__tests__/app/api/admin/orders/fulfill.test.ts`

- [ ] **Step 1: Write failing test**

- 401 without admin session
- 422 when `content` empty / > 5000 chars
- 409 when order already COMPLETED/CLOSED/PENDING
- 200 transitions to COMPLETED, creates OrderFulfillment, calls commission helper, triggers `sendOrderCompletionEmail`
- Second call (idempotency) returns 409 (OrderFulfillment.orderId unique violation)

Run: `npx jest __tests__/app/api/admin/orders/fulfill.test.ts -i`
Expected: FAIL.

- [ ] **Step 2: Implement**

```ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { assertTransition, InvalidTransitionError } from "@/lib/order-state-machine"
import { createOrderCommissions } from "@/lib/calculate-order-commission"
import { checkAndIssueMilestoneBonuses } from "@/lib/domains/distributors"
import { sendOrderCompletionEmail } from "@/lib/order-completion-email"
import { unauthorized, conflict, notFound, invalidJsonBody, validationError, internalServerError } from "@/lib/api-response"

const bodySchema = z.object({
  content: z.string().min(1, "发货内容必填").max(5000),
})

export async function POST(request: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { orderId } = await ctx.params
  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors)

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { product: { select: { productType: true } } },
  })
  if (!order || !order.product) return notFound("Order not found")

  try {
    assertTransition(order.status, "COMPLETED", order.product.productType)
  } catch (err) {
    if (err instanceof InvalidTransitionError) return conflict(err.message)
    throw err
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.orderFulfillment.create({
        data: { orderId, content: parsed.data.content, fulfilledBy: session.user.id },
      })
      await tx.order.update({ where: { id: orderId }, data: { status: "COMPLETED" } })
      if (order.distributorId) {
        await createOrderCommissions(tx, {
          orderId, distributorId: order.distributorId,
          orderEmail: order.email ?? "", orderAmount: order.amount,
          discountPercentApplied: order.discountPercentApplied, paidAt: order.paidAt ?? new Date(),
        })
        await checkAndIssueMilestoneBonuses(tx, order.distributorId)
      }
    })
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as any).code === "P2002") {
      return conflict("订单已被发货，无法重复")
    }
    return internalServerError()
  }

  sendOrderCompletionEmail(orderId).catch((e) => console.error("[order-completion-email]", e))
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Run tests**

Run: `npx jest __tests__/app/api/admin/orders/fulfill.test.ts -i`
Expected: 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/orders/[orderId]/fulfill/ __tests__/app/api/admin/orders/fulfill.test.ts
git commit -m "feat(orders): POST /api/admin/orders/[id]/fulfill creates OrderFulfillment + completes order + emails buyer"
```

---

### Task 13: `POST /api/orders/[orderId]/dun`

**Files:**
- Create: `app/api/orders/[orderId]/dun/route.ts`
- Test: `__tests__/app/api/orders/dun.test.ts`

- [ ] **Step 1: Write failing test**

- 401 when `orderNo + email + password` mismatch
- 409 when order status not in {AWAITING_FULFILLMENT, PROCESSING}
- 429 when order age < `dunMinAgeMinutes`
- 429 when `lastDunAt` within cooldown
- 200 increments `dunCount`, updates `lastDunAt`, triggers `sendWecomNotification("order.dun", ...)`, returns `cooldownRemainingSeconds: 0`

Run: `npx jest __tests__/app/api/orders/dun.test.ts -i`
Expected: FAIL.

- [ ] **Step 2: Implement**

```ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { verifyPassword } from "better-auth/crypto"
import { prisma } from "@/lib/prisma"
import { sendWecomNotification } from "@/lib/wecom-notify"
import { getSiteSettings } from "@/lib/site-settings"
import { unauthorized, conflict, tooManyRequests, notFound, invalidJsonBody, validationError } from "@/lib/api-response"

const bodySchema = z.object({
  orderNo: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(request: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await ctx.params
  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors)

  const order = await prisma.order.findFirst({
    where: { id: orderId, orderNo: parsed.data.orderNo, email: parsed.data.email },
  })
  if (!order) return notFound("Order not found")
  const ok = await verifyPassword({ hash: order.passwordHash, password: parsed.data.password })
  if (!ok) return unauthorized()

  if (order.status !== "AWAITING_FULFILLMENT" && order.status !== "PROCESSING") {
    return conflict("当前订单状态不允许催发货")
  }

  const settings = await getSiteSettings()
  const ageMs = Date.now() - order.createdAt.getTime()
  if (ageMs < settings.dunMinAgeMinutes * 60_000) {
    return tooManyRequests("订单刚创建，请稍后再催")
  }
  if (order.lastDunAt) {
    const elapsed = Date.now() - order.lastDunAt.getTime()
    const cooldownMs = settings.dunCooldownMinutes * 60_000
    if (elapsed < cooldownMs) {
      const remaining = Math.ceil((cooldownMs - elapsed) / 1000)
      return tooManyRequests(`催发货冷却中，请 ${remaining} 秒后再试`)
    }
  }

  const now = new Date()
  await prisma.order.update({
    where: { id: orderId },
    data: { dunCount: { increment: 1 }, lastDunAt: now },
  })

  sendWecomNotification("order.dun", {
    id: order.id, orderNo: order.orderNo, amount: order.amount, email: order.email,
    status: order.status, productNameSnapshot: order.productNameSnapshot,
    variantNameSnapshot: order.variantNameSnapshot, dunCount: order.dunCount + 1,
  }).catch((e) => console.error("[wecom-notify]", e))

  return NextResponse.json({
    ok: true,
    cooldownRemainingSeconds: settings.dunCooldownMinutes * 60,
  })
}
```

If `tooManyRequests` doesn't exist in `lib/api-response.ts`, add:
```ts
export function tooManyRequests(message: string) {
  return NextResponse.json({ error: message }, { status: 429 })
}
```

- [ ] **Step 3: Run tests**

Run: `npx jest __tests__/app/api/orders/dun.test.ts -i`
Expected: 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/api/orders/[orderId]/dun/ __tests__/app/api/orders/dun.test.ts lib/api-response.ts
git commit -m "feat(orders): POST /api/orders/[id]/dun with lookup-credential auth + cooldown + wecom push"
```

---

## Phase E — Lookup API Compatibility

### Task 14: `lookup` & `lookup-by-email` MANUAL support

**Files:**
- Modify: `app/api/orders/lookup/route.ts`
- Modify: `app/api/orders/lookup-by-email/route.ts`
- Modify: `app/orders/lookup/types.ts`
- Modify: `lib/order-history-storage.ts`
- Modify: `app/orders/lookup/order-detail-content.tsx`
- Test: `__tests__/app/api/orders/lookup-manual.test.ts`

- [ ] **Step 1: Extend types**

In `app/orders/lookup/types.ts` (and any related shared type), extend the union:
```ts
export type LookupResponseCompleted = {
  // ... existing ...
  productType: "NORMAL" | "AUTO_FETCH" | "MANUAL"
  fulfillment: { content: string } | null
  variantName: string | null
  dunCount: number
  lastDunAt: string | null
  status: "AWAITING_FULFILLMENT" | "PROCESSING" | "COMPLETED" | "CLOSED"
}
```

Add a new variant of `LookupResponsePending` so the existing one stays for not-yet-paid orders.

- [ ] **Step 2: Write failing test**

`__tests__/app/api/orders/lookup-manual.test.ts`:
- MANUAL completed order → response contains `fulfillment.content`, `cards = []`, `productType = "MANUAL"`
- MANUAL awaiting → response contains `status: "AWAITING_FULFILLMENT"`, `variantName`, `fulfillment: null`
- NORMAL order → response unchanged (cards as before, `productType: "NORMAL"`, `fulfillment: null`)

Run: `npx jest __tests__/app/api/orders/lookup-manual.test.ts -i`
Expected: FAIL.

- [ ] **Step 3: Update `app/api/orders/lookup/route.ts`**

Include `fulfillment` and product type:
```ts
const order = await prisma.order.findFirst({
  where: { orderNo: parsed.data.orderNo },
  include: {
    product: { select: { name: true, productType: true, accountSwitchLimit: true } },
    cards: { select: { content: true, status: true } },
    fulfillment: { select: { content: true } },
  },
})
```

After the existing PENDING branch, before the COMPLETED branch, insert MANUAL-only intermediate states:
```ts
if (order.status === "AWAITING_FULFILLMENT" || order.status === "PROCESSING") {
  return NextResponse.json({
    orderNo: order.orderNo,
    productName: order.productNameSnapshot ?? order.product.name,
    productType: order.product.productType,
    createdAt: order.createdAt,
    status: order.status,
    amount: Number(order.amount),
    cards: [],
    fulfillment: null,
    variantName: order.variantNameSnapshot,
    dunCount: order.dunCount,
    lastDunAt: order.lastDunAt?.toISOString() ?? null,
  })
}
```

Modify the COMPLETED branch to branch on productType:
```ts
const isManual = order.product.productType === "MANUAL"
const cards = isManual
  ? []
  : (order.cards as CardRow[])
      .filter((c) => c.status === "SOLD" || c.status === "RESERVED")
      .map((c) => /* existing logic */)

return NextResponse.json({
  // ... existing ...
  productType: order.product.productType,
  cards,
  fulfillment: isManual ? order.fulfillment : null,
  variantName: order.variantNameSnapshot,
  dunCount: order.dunCount,
  lastDunAt: order.lastDunAt?.toISOString() ?? null,
})
```

- [ ] **Step 4: Mirror the same changes in `app/api/orders/lookup-by-email/route.ts`**

- [ ] **Step 5: Update `lib/order-history-storage.ts`**

Extend the Zod schema for stored order history to include the new status values and the optional `fulfillment` / `variantName` fields. Older entries without these fields should default to `null`.

- [ ] **Step 6: Update `app/orders/lookup/order-detail-content.tsx`**

Add a render branch:
```tsx
{order.productType === "MANUAL" && order.fulfillment ? (
  <pre className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm">
    {order.fulfillment.content}
  </pre>
) : (
  /* existing cards rendering */
)}
```

When `status === "AWAITING_FULFILLMENT"` or `"PROCESSING"`, render the timeline component (built in Task 20) instead of "cards pending".

- [ ] **Step 7: Run tests**

Run: `npx jest __tests__/app/api/orders/lookup-manual.test.ts -i`
Expected: 3 tests pass.

- [ ] **Step 8: Commit**

```bash
git add app/api/orders/lookup/ app/api/orders/lookup-by-email/ app/orders/lookup/ lib/order-history-storage.ts __tests__/app/api/orders/lookup-manual.test.ts
git commit -m "feat(lookup): support MANUAL orders with fulfillment field + intermediate statuses"
```

---

## Phase F — Growth-Feature Guards

### Task 15: Skip MANUAL in cross-sell / restock / purchase-limit / exit-discount

**Files:**
- Modify: `lib/restock-notify.ts`
- Modify: `app/api/restock-subscriptions/route.ts`
- Modify: `lib/cross-sell.ts`
- Modify: `lib/purchase-limit.ts`
- Modify: `app/api/exit-discount/route.ts`
- Modify: `app/api/orders/batch/route.ts` (defensive: ensure CLOSE rejects non-PENDING)

- [ ] **Step 1: Find call sites**

Run: `grep -rn "productType" /Users/idah/code/account-mall/lib /Users/idah/code/account-mall/app/api | grep -v __tests__`
Expected: identifies branches in cross-sell, restock, purchase-limit, exit-discount, auto-fetch.

- [ ] **Step 2: Add MANUAL guards**

In `lib/restock-notify.ts` `notifyRestockSubscribers()` head:
```ts
if (product.productType === "MANUAL") return  // MANUAL uses Variant stock, no restock-subscription
```

In `app/api/restock-subscriptions/route.ts` POST handler, after product lookup:
```ts
if (product.productType === "MANUAL") {
  return badRequest("MANUAL 商品不支持到货提醒")
}
```

In `lib/cross-sell.ts` `resolveCrossSellDiscount()` head:
```ts
if (targetProduct.productType === "MANUAL") return null
```

In `lib/purchase-limit.ts` `checkPurchaseLimit()` head:
```ts
if (product.productType === "MANUAL") return { allowed: true, reason: null }
```

In `app/api/exit-discount/route.ts` POST handler:
```ts
if (product.productType === "MANUAL") {
  return badRequest("MANUAL 商品不支持退出折扣")
}
```

In `app/api/orders/batch/route.ts` CLOSE branch, the existing `where: { status: "PENDING" }` filter naturally rejects new states; add a comment:
```ts
// CLOSE is intentionally restricted to PENDING orders only (spec non-goal:
// no batch CLOSE on AWAITING_FULFILLMENT/PROCESSING — variant stock rollback
// is handled per-order, not in batch).
```

- [ ] **Step 3: Tests**

Add one targeted test per guard, e.g. `__tests__/lib/cross-sell-manual.test.ts`:
```ts
it("returns null for MANUAL target product", async () => {
  const result = await resolveCrossSellDiscount({ targetProduct: { productType: "MANUAL" } as any })
  expect(result).toBeNull()
})
```

Run all guard tests:
`npx jest __tests__/lib/cross-sell-manual.test.ts __tests__/lib/purchase-limit-manual.test.ts -i`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add lib/restock-notify.ts app/api/restock-subscriptions/ lib/cross-sell.ts lib/purchase-limit.ts app/api/exit-discount/ app/api/orders/batch/route.ts __tests__/lib/
git commit -m "feat(growth): skip MANUAL products in cross-sell/restock/purchase-limit/exit-discount"
```

---

## Phase G — Admin UI

### Task 16: Product form — SKU section

**Files:**
- Modify: `app/admin/(main)/products/[productId]/product-form.tsx`
- Modify: `app/admin/(main)/products/[productId]/page.tsx`
- Create: `app/admin/(main)/products/[productId]/variants/variants-section.tsx`
- Create: `app/admin/(main)/products/[productId]/variants/variant-form-dialog.tsx`
- Create: `app/admin/(main)/products/[productId]/variants/variant-row-actions.tsx`
- Create: `app/api/admin/products/[productId]/variants/route.ts` (GET list, POST create)
- Create: `app/api/admin/products/[productId]/variants/[variantId]/route.ts` (PATCH, DELETE)

- [ ] **Step 1: API endpoints**

`app/api/admin/products/[productId]/variants/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { listVariants, createVariantForProduct, variantCreateSchema, NotManualProductError } from "@/lib/domains/variants"
import { unauthorized, invalidJsonBody, validationError, badRequest } from "@/lib/api-response"

export async function GET(_req: NextRequest, ctx: { params: Promise<{ productId: string }> }) {
  const session = await getAdminSession(); if (!session) return unauthorized()
  const { productId } = await ctx.params
  return NextResponse.json({ variants: await listVariants(productId) })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ productId: string }> }) {
  const session = await getAdminSession(); if (!session) return unauthorized()
  const { productId } = await ctx.params
  let body: unknown; try { body = await req.json() } catch { return invalidJsonBody() }
  const parsed = variantCreateSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors)
  try {
    const created = await createVariantForProduct(productId, parsed.data)
    return NextResponse.json(created)
  } catch (err) {
    if (err instanceof NotManualProductError) return badRequest(err.message)
    throw err
  }
}
```

`app/api/admin/products/[productId]/variants/[variantId]/route.ts`:
```ts
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ productId: string; variantId: string }> }) {
  const session = await getAdminSession(); if (!session) return unauthorized()
  const { variantId } = await ctx.params
  let body: unknown; try { body = await req.json() } catch { return invalidJsonBody() }
  const parsed = variantUpdateSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors)
  try {
    const updated = await updateVariantById(variantId, parsed.data)
    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof VariantNotFoundError) return notFound(err.message)
    throw err
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ variantId: string }> }) {
  const session = await getAdminSession(); if (!session) return unauthorized()
  const { variantId } = await ctx.params
  try {
    await deleteVariantById(variantId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof VariantHasOrdersError) return conflict(err.message)
    if (err instanceof VariantNotFoundError) return notFound(err.message)
    throw err
  }
}
```

- [ ] **Step 2: Add MANUAL to product-form ProductType select**

In `product-form.tsx`, locate the ProductType `<Select>` and add:
```tsx
<SelectItem value="MANUAL">手动发货</SelectItem>
```

When `productType === "MANUAL"`, hide `maxQuantity`, `sourceUrl`, `validityHours`, `allowAccountSwitch`, `accountSwitchLimit`. Hide the "卡密池" tab on the parent page. Show the variants section instead.

- [ ] **Step 3: Build `variants-section.tsx`**

```tsx
"use client"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/app/admin/components"
import { Plus } from "lucide-react"
import { useState } from "react"
import { VariantFormDialog } from "./variant-form-dialog"
import { VariantRowActions } from "./variant-row-actions"
import type { ColumnDef } from "@tanstack/react-table"
import { formatCurrency, formatDateTime } from "@/lib/utils"

type VariantRow = { id: string; name: string; price: string; unitCost: string | null; stockQuantity: number; sortOrder: number; isActive: boolean; createdAt: string }

const columns: ColumnDef<VariantRow>[] = [
  { accessorKey: "name", header: "名称" },
  { accessorKey: "price", header: "售价", cell: ({ row }) => formatCurrency(Number(row.original.price)) },
  { accessorKey: "unitCost", header: "成本", cell: ({ row }) => row.original.unitCost ? formatCurrency(Number(row.original.unitCost)) : "—" },
  { accessorKey: "stockQuantity", header: "库存" },
  { accessorKey: "isActive", header: "启用", cell: ({ row }) => row.original.isActive ? "✓" : "✗" },
  { accessorKey: "sortOrder", header: "排序" },
  { id: "actions", cell: ({ row }) => <VariantRowActions variant={row.original} productId={productId} />, meta: { className: "w-[60px]" } },
]

export function VariantsSection({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["variants", productId],
    queryFn: () => fetch(`/api/admin/products/${productId}/variants`).then((r) => r.json()),
  })

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">SKU 管理</h3>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="size-4" />新建 SKU</Button>
      </div>
      <DataTable columns={columns} data={data?.variants ?? []} isLoading={isLoading} getRowId={(r) => r.id} />
      <VariantFormDialog productId={productId} open={open} onOpenChange={setOpen} onSuccess={() => refetch()} />
    </section>
  )
}
```

- [ ] **Step 3.5: Build `variant-form-dialog.tsx` and `variant-row-actions.tsx`**

Follow the admin-crud-page pattern. Form fields: `name`, `price`, `unitCost`, `stockQuantity`, `sortOrder`, `isActive`. Use `useForm` + `zodResolver(variantCreateSchema)`.

Row actions DropdownMenu with `MoreHorizontal` icon (per `feedback_row_actions_dropdown` memory):
- Edit → opens VariantFormDialog in edit mode
- Toggle active → PATCH `{ isActive: !current }`
- Delete → AlertDialog confirmation → DELETE; if 409 (has orders), show toast "存在关联订单，请改为停用"

- [ ] **Step 4: Wire into product detail page**

In `app/admin/(main)/products/[productId]/page.tsx`, when loaded product has `productType === "MANUAL"`, render `<VariantsSection productId={product.id} />` instead of the Card pool tab.

Also add a guard on product status PATCH (likely in `app/api/admin/products/[productId]/route.ts`):
```ts
if (data.status === "ACTIVE" && existing.productType === "MANUAL") {
  await assertProductHasActiveVariant(existing.id)  // throws if zero
}
```

Wrap the call in try/catch; catch the generic Error and return 422.

- [ ] **Step 5: Smoke test**

Start dev: `npm run dev`. Create a MANUAL product, see the SKU section, add 2 variants (1 month / 3 months with different prices), toggle one inactive, delete one (should succeed since no orders), try to set product ACTIVE before adding variants (should fail with 422).

- [ ] **Step 6: Commit**

```bash
git add app/admin/(main)/products/[productId]/ app/api/admin/products/[productId]/variants/ app/api/admin/products/[productId]/route.ts
git commit -m "feat(admin/products): MANUAL product type + SKU section (CRUD + activate guard)"
```

---

### Task 17: Admin order detail — MANUAL fulfillment panel

**Files:**
- Create: `app/admin/(main)/orders/[orderId]/manual-fulfillment-panel.tsx`
- Modify: `app/admin/(main)/orders/[orderId]/page.tsx`
- Modify: `app/admin/(main)/orders/orders-columns.tsx`

- [ ] **Step 1: Build the panel component**

```tsx
"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { toast } from "sonner"

type Props = {
  orderId: string
  status: "AWAITING_FULFILLMENT" | "PROCESSING" | "COMPLETED" | "CLOSED"
  existingContent: string | null
  dunCount: number
  lastDunAt: string | null
}

export function ManualFulfillmentPanel({ orderId, status, existingContent, dunCount, lastDunAt }: Props) {
  const router = useRouter()
  const [content, setContent] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  if (status === "COMPLETED" || status === "CLOSED") {
    return (
      <section className="space-y-2">
        <h3 className="text-lg font-semibold">发货内容</h3>
        <pre className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm">{existingContent ?? "—"}</pre>
      </section>
    )
  }

  const take = async () => {
    setBusy(true)
    const res = await fetch(`/api/admin/orders/${orderId}/take`, { method: "POST" })
    setBusy(false)
    if (!res.ok) { toast.error("接单失败"); return }
    toast.success("已接单")
    router.refresh()
  }

  const fulfill = async () => {
    setBusy(true)
    const res = await fetch(`/api/admin/orders/${orderId}/fulfill`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    })
    setBusy(false); setConfirmOpen(false)
    if (!res.ok) { const j = await res.json().catch(() => ({})); toast.error(j.error ?? "发货失败"); return }
    toast.success("已发货")
    router.refresh()
  }

  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold">发货操作</h3>
      <div className="text-sm text-muted-foreground">
        催发货 {dunCount} 次{lastDunAt ? `（最近 ${new Date(lastDunAt).toLocaleString("zh-CN")}）` : ""}
      </div>
      {status === "AWAITING_FULFILLMENT" && (
        <Button variant="outline" disabled={busy} onClick={take}>接单</Button>
      )}
      <Textarea
        value={content} onChange={(e) => setContent(e.target.value)}
        rows={6} maxLength={5000} placeholder="账号/卡密/网盘链接等发货内容；最多 5000 字"
      />
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogTrigger asChild>
          <Button disabled={busy || content.trim().length === 0}>发货</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认发货？</AlertDialogTitle>
            <AlertDialogDescription>发货内容提交后无法修改，且会立即推送给买家。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={fulfill}>确认发货</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
```

- [ ] **Step 2: Mount in order detail page**

In `app/admin/(main)/orders/[orderId]/page.tsx`, after the existing summary block, render conditionally:
```tsx
{order.product.productType === "MANUAL" && (
  <ManualFulfillmentPanel
    orderId={order.id}
    status={order.status as any}
    existingContent={order.fulfillment?.content ?? null}
    dunCount={order.dunCount}
    lastDunAt={order.lastDunAt?.toISOString() ?? null}
  />
)}
```

Also `include: { fulfillment: { select: { content: true } } }` in the `findUnique` query.

- [ ] **Step 3: Add SKU column to orders list**

In `app/admin/(main)/orders/orders-columns.tsx`, insert a column after product:
```ts
{
  accessorKey: "variantNameSnapshot",
  header: "SKU",
  cell: ({ row }) => row.original.variantNameSnapshot ?? "—",
},
```

Update the `Row` type to include `variantNameSnapshot: string | null`.

In `app/admin/(main)/orders/orders-filters.ts`, widen status filter to include `AWAITING_FULFILLMENT` and `PROCESSING`.

- [ ] **Step 4: Smoke test**

Create a MANUAL product, place a test order (use `/api/dev/complete-order` to bypass payment), see new statuses in admin list, open detail, click "接单" → status flips to PROCESSING; type content + click "发货" → confirm dialog → status flips to COMPLETED.

- [ ] **Step 5: Commit**

```bash
git add app/admin/(main)/orders/
git commit -m "feat(admin/orders): manual fulfillment panel + SKU column + status filter widened"
```

---

### Task 18: Admin settings — WeCom + business hours weekdays + dun thresholds

**Files:**
- Modify: `app/admin/(main)/settings/site/site-settings-form.tsx`
- Create: `app/admin/(main)/settings/site/wecom-notify-card.tsx`
- Create: `app/admin/(main)/settings/site/business-hours-weekday-picker.tsx`
- Create: `app/api/admin/site-setting/test-wecom/route.ts`

- [ ] **Step 1: Extend form schema in `site-settings-form.tsx`**

Add fields under existing schema:
```ts
wecomWebhookUrl: z.string().refine((v) => v === "" || /^https?:\/\//.test(v), "必须是 http(s) URL"),
dunCooldownMinutes: z.coerce.number().int().min(0).max(1440).optional(),
dunMinAgeMinutes: z.coerce.number().int().min(0).max(60).optional(),
businessHoursWeekdays: z.string().optional(),
```

Render the new fields. Use the WeekdayPicker (built next step) to construct the JSON array string.

- [ ] **Step 2: Build `business-hours-weekday-picker.tsx`**

```tsx
"use client"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const LABELS = ["日", "一", "二", "三", "四", "五", "六"]

type Props = {
  value: string | null    // JSON array "[1,2,3,4,5]"
  onChange: (next: string) => void
}

export function BusinessHoursWeekdayPicker({ value, onChange }: Props) {
  let selected: string[] = []
  try { const arr = JSON.parse(value ?? "[]"); if (Array.isArray(arr)) selected = arr.map(String) } catch {}

  return (
    <ToggleGroup
      type="multiple"
      value={selected}
      onValueChange={(vals) => {
        const nums = vals.map(Number).filter((n) => n >= 0 && n <= 6).sort()
        onChange(JSON.stringify(nums))
      }}
    >
      {LABELS.map((l, i) => (
        <ToggleGroupItem key={i} value={String(i)} aria-label={l}>{l}</ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
```

Install `toggle-group` if missing: `npx shadcn@latest add toggle-group`.

- [ ] **Step 3: Build `wecom-notify-card.tsx`**

A small card with the URL input + "发送测试消息" button:
```tsx
const onTest = async () => {
  const res = await fetch("/api/admin/site-setting/test-wecom", { method: "POST" })
  if (res.ok) toast.success("测试消息已发送，请检查群")
  else toast.error("发送失败，请检查 URL 配置")
}
```

- [ ] **Step 4: Implement test endpoint**

`app/api/admin/site-setting/test-wecom/route.ts`:
```ts
import { NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"
import { getSiteSettings } from "@/lib/site-settings"

export async function POST() {
  const session = await getAdminSession(); if (!session) return unauthorized()
  const settings = await getSiteSettings()
  if (!settings.wecomWebhookUrl) return NextResponse.json({ ok: false, error: "未配置 wecomWebhookUrl" }, { status: 400 })

  const res = await fetch(settings.wecomWebhookUrl, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ msgtype: "markdown", markdown: { content: "### ✅ 测试消息\n来自 Account Mall 管理后台" } }),
  })
  return NextResponse.json({ ok: res.ok })
}
```

- [ ] **Step 5: Smoke test**

Configure a real webhook URL in dev, click "发送测试消息", verify it lands in the WeCom group.

- [ ] **Step 6: Commit**

```bash
git add app/admin/(main)/settings/site/ app/api/admin/site-setting/test-wecom/
git commit -m "feat(admin/settings): wecom webhook + weekday picker + dun thresholds + test-message button"
```

---

## Phase H — Buyer-Facing UI

### Task 19: Product detail — Variant selector

**Files:**
- Create: `app/components/product-variant-selector.tsx`
- Modify: `app/products/[slug]/page.tsx`
- Modify: `app/components/product-catalog.tsx` (or where the buy CTA lives)

- [ ] **Step 1: Build the selector**

```tsx
"use client"
import { cn } from "@/lib/utils"
import { useState } from "react"

type Variant = { id: string; name: string; price: string; stockQuantity: number; isActive: boolean }

type Props = {
  variants: Variant[]
  value: string | null
  onChange: (id: string) => void
}

export function ProductVariantSelector({ variants, value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {variants.filter((v) => v.isActive).map((v) => {
        const soldOut = v.stockQuantity < 1
        const active = value === v.id
        return (
          <button
            key={v.id}
            type="button"
            disabled={soldOut}
            onClick={() => onChange(v.id)}
            className={cn(
              "rounded-md border p-3 text-left transition",
              active ? "border-primary bg-primary/5" : "border-muted",
              soldOut && "opacity-50",
            )}
          >
            <div className="font-medium">{v.name}</div>
            <div className="text-sm text-muted-foreground">¥{v.price}</div>
            {soldOut && <div className="mt-1 text-xs text-destructive">已售罄</div>}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Load variants in product page**

In `app/products/[slug]/page.tsx`:
```ts
const variants = product.productType === "MANUAL"
  ? await prisma.productVariant.findMany({
      where: { productId: product.id, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    })
  : []
```

Pass `variants` and `businessHours` (from `getSiteSettings()` + `formatInTimeZone`) into the page component.

Render the selector when `productType === "MANUAL"`; require a selection before allowing checkout; pass `variantId` to the create-order request.

Render the business-hours hint at the bottom of the product card: e.g. "工作时间：9:00–22:00（周一至周日）".

- [ ] **Step 3: Wire variant into create-order flow**

In the create-order CTA component, send `variantId` only when `productType === "MANUAL"`. Tighten the existing TypeScript types so it's not present on other types.

- [ ] **Step 4: Smoke test**

Visit a MANUAL product. Selecting nothing disables the buy button; selecting a sold-out one shows the badge; selecting a live one + clicking buy goes to checkout and the order is created with the correct variantId.

- [ ] **Step 5: Commit**

```bash
git add app/components/product-variant-selector.tsx app/products/[slug]/page.tsx app/components/product-catalog.tsx
git commit -m "feat(buyer): MANUAL product variant selector + business-hours hint"
```

---

### Task 20: Buyer order page — 5-state timeline + ETA + dun button

**Files:**
- Create: `app/orders/[orderNo]/manual-status-timeline.tsx`
- Create: `app/orders/[orderNo]/manual-dun-button.tsx`
- Modify: `app/orders/[orderNo]/awaiting-payment/awaiting-payment-client.tsx`
- Modify: `app/orders/lookup/order-detail-content.tsx`

- [ ] **Step 1: Build `manual-status-timeline.tsx`**

```tsx
import { CheckCircle2, Circle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const STEPS = [
  { status: "PENDING", label: "待付款" },
  { status: "AWAITING_FULFILLMENT", label: "待发货" },
  { status: "PROCESSING", label: "处理中" },
  { status: "COMPLETED", label: "已完成" },
] as const

type Status = "PENDING" | "AWAITING_FULFILLMENT" | "PROCESSING" | "COMPLETED" | "CLOSED"

export function ManualStatusTimeline({ current, etaText }: { current: Status; etaText?: string }) {
  if (current === "CLOSED") {
    return <div className="text-sm text-muted-foreground">订单已关闭，如有疑问联系客服。</div>
  }
  const currentIdx = STEPS.findIndex((s) => s.status === current)
  return (
    <ol className="flex items-center gap-2 text-sm">
      {STEPS.map((s, i) => {
        const done = i < currentIdx
        const active = i === currentIdx
        return (
          <li key={s.status} className={cn("flex items-center gap-1", done ? "text-foreground" : active ? "text-primary" : "text-muted-foreground")}>
            {done ? <CheckCircle2 className="size-4" /> : active ? <Loader2 className="size-4 animate-spin" /> : <Circle className="size-4" />}
            <span>{s.label}</span>
            {i < STEPS.length - 1 && <span className="mx-1 text-muted-foreground">›</span>}
          </li>
        )
      })}
      {etaText && <li className="ml-2 text-xs text-muted-foreground">{etaText}</li>}
    </ol>
  )
}
```

- [ ] **Step 2: Build `manual-dun-button.tsx`**

```tsx
"use client"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

type Props = {
  orderId: string; orderNo: string; email: string; password: string
  initialCooldownSeconds: number; minAgeSeconds: number; orderAgeSeconds: number
}

export function ManualDunButton({ orderId, orderNo, email, password, initialCooldownSeconds, minAgeSeconds, orderAgeSeconds }: Props) {
  const [cooldown, setCooldown] = useState(initialCooldownSeconds)
  const [ageLeft, setAgeLeft] = useState(Math.max(0, minAgeSeconds - orderAgeSeconds))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const t = setInterval(() => {
      setCooldown((s) => Math.max(0, s - 1))
      setAgeLeft((s) => Math.max(0, s - 1))
    }, 1000)
    return () => clearInterval(t)
  }, [])

  const blocked = cooldown > 0 || ageLeft > 0

  const onClick = async () => {
    setBusy(true)
    const res = await fetch(`/api/orders/${orderId}/dun`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNo, email, password }),
    })
    setBusy(false)
    if (res.status === 429) { const j = await res.json().catch(() => ({})); toast.error(j.error ?? "请稍后再试"); return }
    if (!res.ok) { toast.error("催发货失败"); return }
    const j = await res.json()
    setCooldown(j.cooldownRemainingSeconds ?? 1800)
    toast.success("提醒已发出")
  }

  return (
    <Button variant="outline" disabled={blocked || busy} onClick={onClick}>
      {ageLeft > 0 ? `订单刚下，${ageLeft}s 后可催` : cooldown > 0 ? `${cooldown}s 后可催` : "催发货"}
    </Button>
  )
}
```

- [ ] **Step 3: Wire into awaiting-payment-client / order-detail-content**

Where the buyer's order detail renders (`awaiting-payment-client.tsx` or `lookup/order-detail-content.tsx`), for MANUAL orders in `AWAITING_FULFILLMENT` or `PROCESSING`:
- Render `<ManualStatusTimeline current={order.status} etaText={...} />`
- Render `<ManualDunButton ... />` when allowed
- For `COMPLETED`: render the fulfillment.content via `<pre className="whitespace-pre-wrap">…</pre>`

The buyer's session-side ETA text needs to be precomputed server-side and passed as a prop (don't call `lib/business-hours.ts` from a client component — server only).

In the page that wraps these clients, do:
```ts
const settings = await getSiteSettings()
const cfg = {
  start: settings.businessHoursStart,
  end: settings.businessHoursEnd,
  weekdays: settings.businessHoursWeekdays,
  timezone: settings.businessHoursTimezone,
}
const etaText = isWithinBusinessHours(new Date(), cfg)
  ? "卖家通常在 15 分钟内发货"
  : formatEtaText(new Date(), cfg)
```

- [ ] **Step 4: Smoke test**

Create a MANUAL order; verify the timeline shows the right stage at each transition; click 催发货 outside cooldown → toast + WeCom message in group; rapid double-click → 429.

Use mobile-check skill on the timeline component (per `mobile-check` skill description).

- [ ] **Step 5: Commit**

```bash
git add app/orders/[orderNo]/manual-status-timeline.tsx app/orders/[orderNo]/manual-dun-button.tsx app/orders/ app/orders/lookup/order-detail-content.tsx
git commit -m "feat(buyer): 5-state timeline + ETA hint + dun button for MANUAL orders"
```

---

## Phase I — Final Wiring & Safety

### Task 21: Full regression + type check

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: zero errors.

- [ ] **Step 3: Full test suite**

Run: `npm test`
Expected: all green.

- [ ] **Step 4: Manual E2E walk-through**

`npm run dev`. Walk:
1. Create MANUAL product → fail to activate without variants (422 expected)
2. Add 3 variants (1 month / 3 months / 12 months, varying prices + stock)
3. Activate product
4. Visit storefront → see selector
5. Buy 1 unit of a variant → checkout → fake-pay via `/api/dev/complete-order`
6. Verify Variant.stockQuantity decremented
7. Verify WeCom message appears in the configured group (if env set)
8. Admin: order is `AWAITING_FULFILLMENT` → click 接单 → `PROCESSING` → type content → confirm → `COMPLETED`
9. Buyer lookup page now shows fulfillment text
10. Buyer's email shows the same content (check Mailhog or equivalent)
11. Place another order; buyer clicks 催发货 → WeCom push
12. Place another, then admin clicks 关闭 → variant stock restored

- [ ] **Step 5: Commit any small fixes from the walkthrough**

If anything breaks during the walkthrough, fix it as separate commits. Don't add un-tested fixes.

---

## Self-Review (engineer note)

Before declaring complete:
- Re-grep for `productType` in API handlers — every place that branches must include `MANUAL`
- Re-grep for `OrderStatus` literals — every state machine adjacent place uses `assertTransition` not local `if`
- Re-grep for `cards` in front-end render code — every place that assumes `cards.length > 0` has the MANUAL `fulfillment.content` branch
- Run `grep -rn "isValidStatusTransition" app lib` — should be zero results (the helper is removed)
- Make sure `app/admin/(main)/orders/orders-data-table.tsx` and related toolbar filters don't crash when status is `AWAITING_FULFILLMENT` or `PROCESSING`

---

## Reference

- Spec: `docs/superpowers/specs/2026-05-23-manual-sku-fulfillment-design.md`
- WeCom group bot docs: https://developer.work.weixin.qq.com/document/path/91770
- date-fns-tz docs: https://date-fns.org/v4.1.0/docs/Time-Zones
