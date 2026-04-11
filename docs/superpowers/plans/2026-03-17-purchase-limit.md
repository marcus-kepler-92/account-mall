# Purchase Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a configurable per-product purchase limit: when enabled, the same user (identified by email + fingerprint/IP corroboration) can only complete checkout up to N times for that product.

**Architecture:** New `lib/purchase-limit.ts` utility encapsulates the multi-factor count check; called in `POST /api/orders` after product validation, before NORMAL/AUTO_FETCH branching. Existing AUTO_FETCH time-window check is removed entirely—purchase limiting is now the single mechanism.

**Tech Stack:** Prisma (PostgreSQL), Next.js App Router API routes, Zod, React Hook Form + shadcn/ui

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modify | Add `purchaseLimitEnabled`, `purchaseLimitQuantity` to `Product` |
| `lib/purchase-limit.ts` | Create | `checkPurchaseLimit` — multi-factor COMPLETED order count check |
| `lib/validations/product.ts` | Modify | Add two fields to all three schemas |
| `app/api/products/route.ts` | Modify | Pass new fields on product create |
| `app/api/products/[productId]/route.ts` | Modify | Pass new fields on product update |
| `app/api/orders/route.ts` | Modify | Insert purchase limit check; remove AUTO_FETCH time-window check |
| `app/components/product-form-purchase-limit-fields.tsx` | Create | UI section for limit toggle + quantity input |
| `app/components/product-form.tsx` | Modify | Wire new sub-component into form |
| `__tests__/lib/purchase-limit.test.ts` | Create | Unit tests for `checkPurchaseLimit` |
| `__tests__/api/orders-purchase-limit.test.ts` | Create | Integration tests for limit check in order flow |
| `__tests__/api/orders-create-auto-fetch-fingerprint.test.ts` | Modify | Remove obsolete time-window tests; update remaining to use `purchaseLimitEnabled: true` |

---

## Task 1: Schema — add purchase limit fields

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add fields to Product model**

In `prisma/schema.prisma`, after `riskWarningConfirmText String? @db.VarChar(50)`, add:

```prisma
purchaseLimitEnabled  Boolean @default(false)
purchaseLimitQuantity Int     @default(1)
```

- [ ] **Step 2: Run migration**

```bash
npm run db:migrate -- --name add-purchase-limit
```

Expected: new migration file created and applied with no errors.

- [ ] **Step 3: Verify Prisma client regenerated**

```bash
npm run db:generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add purchaseLimitEnabled and purchaseLimitQuantity to Product"
```

---

## Task 2: `lib/purchase-limit.ts` with unit tests (TDD)

**Files:**
- Create: `lib/purchase-limit.ts`
- Create: `__tests__/lib/purchase-limit.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/purchase-limit.test.ts`:

```typescript
/**
 * Unit tests for lib/purchase-limit.ts
 */
import { checkPurchaseLimit } from "@/lib/purchase-limit"
import { prismaMock } from "../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../__mocks__/prisma")
  return { __esModule: true, prisma: prismaMock }
})

const BASE_PARAMS = {
  productId: "prod_1",
  email: "user@example.com",
  fingerprintHash: null,
  clientIp: "1.2.3.4",
  limitQuantity: 1,
}

describe("checkPurchaseLimit", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("blocking logic", () => {
    it("count=0 → not blocked", async () => {
      prismaMock.order.count.mockResolvedValue(0)

      const result = await checkPurchaseLimit(BASE_PARAMS)

      expect(result.blocked).toBe(false)
      expect(prismaMock.order.findFirst).not.toHaveBeenCalled()
    })

    it("count=1, limitQuantity=1 → blocked", async () => {
      prismaMock.order.count.mockResolvedValue(1)
      prismaMock.order.findFirst.mockResolvedValue({
        orderNo: "order-uuid",
        email: "user@example.com",
      } as any)

      const result = await checkPurchaseLimit(BASE_PARAMS)

      expect(result.blocked).toBe(true)
    })

    it("count=1, limitQuantity=2 → not blocked", async () => {
      prismaMock.order.count.mockResolvedValue(1)

      const result = await checkPurchaseLimit({ ...BASE_PARAMS, limitQuantity: 2 })

      expect(result.blocked).toBe(false)
    })

    it("count=2, limitQuantity=2 → blocked", async () => {
      prismaMock.order.count.mockResolvedValue(2)
      prismaMock.order.findFirst.mockResolvedValue({
        orderNo: "order-uuid",
        email: "user@example.com",
      } as any)

      const result = await checkPurchaseLimit({ ...BASE_PARAMS, limitQuantity: 2 })

      expect(result.blocked).toBe(true)
    })

    it("error message includes limitQuantity and count", async () => {
      prismaMock.order.count.mockResolvedValue(3)
      prismaMock.order.findFirst.mockResolvedValue({
        orderNo: "uuid",
        email: "user@example.com",
      } as any)

      const result = await checkPurchaseLimit({ ...BASE_PARAMS, limitQuantity: 2 })

      expect(result.message).toContain("2")
      expect(result.message).toContain("3")
    })
  })

  describe("orderNo security", () => {
    it("blocked, email matches → orderNo exposed", async () => {
      prismaMock.order.count.mockResolvedValue(1)
      prismaMock.order.findFirst.mockResolvedValue({
        orderNo: "own-uuid",
        email: "user@example.com",
      } as any)

      const result = await checkPurchaseLimit(BASE_PARAMS)

      expect(result.orderNo).toBe("own-uuid")
    })

    it("blocked, email differs (fingerprint/IP match) → orderNo not exposed", async () => {
      prismaMock.order.count.mockResolvedValue(1)
      prismaMock.order.findFirst.mockResolvedValue({
        orderNo: "other-uuid",
        email: "other@example.com",
      } as any)

      const result = await checkPurchaseLimit(BASE_PARAMS)

      expect(result.orderNo).toBeUndefined()
    })
  })

  describe("multi-factor WHERE condition", () => {
    it("no fingerprint, no IP — only email signal in OR", async () => {
      prismaMock.order.count.mockResolvedValue(0)

      await checkPurchaseLimit({ ...BASE_PARAMS, fingerprintHash: null, clientIp: "unknown" })

      const call = prismaMock.order.count.mock.calls[0]![0]!
      const orCondition = (call.where as any).OR as object[]
      expect(orCondition).toHaveLength(1)
      expect((orCondition[0] as any).email).toBe("user@example.com")
    })

    it("fingerprint provided — fingerprint signal requires corroboration (OR sub-condition)", async () => {
      prismaMock.order.count.mockResolvedValue(0)

      await checkPurchaseLimit({ ...BASE_PARAMS, fingerprintHash: "fp-abc" })

      const call = prismaMock.order.count.mock.calls[0]![0]!
      const orCondition = (call.where as any).OR as object[]
      const fpEntry = orCondition.find((c) => (c as any).fingerprintHash === "fp-abc") as any
      expect(fpEntry).toBeDefined()
      // Must have corroboration OR, not standalone
      expect(fpEntry.OR).toBeDefined()
      expect((fpEntry.OR as object[]).length).toBeGreaterThan(0)
    })

    it("IP signal requires corroboration — has OR sub-condition with email or fingerprint", async () => {
      prismaMock.order.count.mockResolvedValue(0)

      await checkPurchaseLimit({ ...BASE_PARAMS, fingerprintHash: "fp-abc" })

      const call = prismaMock.order.count.mock.calls[0]![0]!
      const orCondition = (call.where as any).OR as object[]
      const ipEntry = orCondition.find((c) => (c as any).clientIp === "1.2.3.4") as any
      expect(ipEntry).toBeDefined()
      expect(ipEntry.OR).toBeDefined()
      const ipSubOR = ipEntry.OR as object[]
      const hasEmail = ipSubOR.some((c) => (c as any).email !== undefined)
      expect(hasEmail).toBe(true)
    })

    it("unknown IP — no IP auxiliary signal added", async () => {
      prismaMock.order.count.mockResolvedValue(0)

      await checkPurchaseLimit({ ...BASE_PARAMS, clientIp: "unknown" })

      const call = prismaMock.order.count.mock.calls[0]![0]!
      const orCondition = (call.where as any).OR as object[]
      const hasIp = orCondition.some((c) => (c as any).clientIp !== undefined)
      expect(hasIp).toBe(false)
    })

    it("WHERE always filters productId and status=COMPLETED", async () => {
      prismaMock.order.count.mockResolvedValue(0)

      await checkPurchaseLimit(BASE_PARAMS)

      const call = prismaMock.order.count.mock.calls[0]![0]!
      expect((call.where as any).productId).toBe("prod_1")
      expect((call.where as any).status).toBe("COMPLETED")
    })

    it("email is lowercased before use in WHERE", async () => {
      prismaMock.order.count.mockResolvedValue(0)

      await checkPurchaseLimit({ ...BASE_PARAMS, email: "USER@Example.COM" })

      const call = prismaMock.order.count.mock.calls[0]![0]!
      const orCondition = (call.where as any).OR as object[]
      const emailEntry = orCondition.find((c) => (c as any).email !== undefined) as any
      expect(emailEntry.email).toBe("user@example.com")
    })
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest __tests__/lib/purchase-limit.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/purchase-limit'`

- [ ] **Step 3: Implement `lib/purchase-limit.ts`**

Create `lib/purchase-limit.ts`:

```typescript
import { prisma } from "@/lib/prisma"

export async function checkPurchaseLimit(params: {
  productId: string
  email: string
  fingerprintHash: string | null
  clientIp: string
  limitQuantity: number
}): Promise<{ blocked: boolean; orderNo?: string; message: string }> {
  const { productId, email, fingerprintHash, clientIp, limitQuantity } = params
  const emailLower = email.trim().toLowerCase()

  const emailSignal = { email: emailLower }
  const auxiliarySignals: object[] = []

  if (fingerprintHash) {
    auxiliarySignals.push({
      fingerprintHash,
      OR: [
        { email: emailLower },
        ...(clientIp !== "unknown" ? [{ clientIp }] : []),
      ],
    })
  }

  if (clientIp !== "unknown") {
    auxiliarySignals.push({
      clientIp,
      OR: [
        { email: emailLower },
        ...(fingerprintHash ? [{ fingerprintHash }] : []),
      ],
    })
  }

  const orCondition = [emailSignal, ...auxiliarySignals]

  const count = await prisma.order.count({
    where: {
      productId,
      status: "COMPLETED",
      OR: orCondition,
    },
  })

  if (count < limitQuantity) {
    return { blocked: false, message: "" }
  }

  const existingOrder = await prisma.order.findFirst({
    where: {
      productId,
      status: "COMPLETED",
      OR: orCondition,
    },
    select: { orderNo: true, email: true },
  })

  const message = `该商品限购 ${limitQuantity} 件，您已购买 ${count} 件。`
  const isOwnOrder = existingOrder?.email === emailLower

  return {
    blocked: true,
    ...(isOwnOrder && existingOrder ? { orderNo: existingOrder.orderNo } : {}),
    message,
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest __tests__/lib/purchase-limit.test.ts --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/purchase-limit.ts __tests__/lib/purchase-limit.test.ts
git commit -m "feat: add checkPurchaseLimit utility with multi-factor corroboration"
```

---

## Task 3: Zod validations — add purchase limit fields

**Files:**
- Modify: `lib/validations/product.ts`
- Modify: `__tests__/lib/validations-product.test.ts`

- [ ] **Step 1: Add fields to all three schemas in `lib/validations/product.ts`**

In `createProductSchema`, after `riskWarningConfirmText`:
```typescript
purchaseLimitEnabled: z.boolean().optional(),
purchaseLimitQuantity: z.number().int().min(1).optional(),
```

In `updateProductSchema`, after `riskWarningConfirmText`:
```typescript
purchaseLimitEnabled: z.boolean().optional(),
purchaseLimitQuantity: z.number().int().min(1).optional(),
```

In `productFormSchema` object (`.object({ ... })`), after `riskWarningConfirmText`:
```typescript
purchaseLimitEnabled: z.boolean().optional(),
purchaseLimitQuantity: z.string().optional(),
```

- [ ] **Step 2: Add tests to `__tests__/lib/validations-product.test.ts`**

Append to the file:

```typescript
describe("purchaseLimitEnabled / purchaseLimitQuantity", () => {
  it("createProductSchema accepts purchaseLimitEnabled=true and quantity=2", () => {
    const result = createProductSchema.safeParse({
      name: "P",
      slug: "p",
      price: 10,
      purchaseLimitEnabled: true,
      purchaseLimitQuantity: 2,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.purchaseLimitEnabled).toBe(true)
      expect(result.data.purchaseLimitQuantity).toBe(2)
    }
  })

  it("createProductSchema rejects purchaseLimitQuantity=0", () => {
    const result = createProductSchema.safeParse({
      name: "P",
      slug: "p",
      price: 10,
      purchaseLimitEnabled: true,
      purchaseLimitQuantity: 0,
    })
    expect(result.success).toBe(false)
  })

  it("productFormSchema accepts purchaseLimitQuantity as string", () => {
    const result = productFormSchema.safeParse({
      name: "P",
      slug: "p",
      price: "10",
      maxQuantity: "5",
      isActive: true,
      purchaseLimitEnabled: true,
      purchaseLimitQuantity: "3",
    })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npx jest __tests__/lib/validations-product.test.ts --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/validations/product.ts __tests__/lib/validations-product.test.ts
git commit -m "feat(validations): add purchaseLimitEnabled and purchaseLimitQuantity to product schemas"
```

---

## Task 4: Product API routes — propagate new fields

**Files:**
- Modify: `app/api/products/route.ts`
- Modify: `app/api/products/[productId]/route.ts`

- [ ] **Step 1: Update `POST /api/products` in `app/api/products/route.ts`**

On the destructure line (currently line 147):
```typescript
const { name, slug, description, summary, image, price, maxQuantity, status, tagIds, productType, sourceUrl, validityHours, allowAccountSwitch, accountSwitchLimit, riskWarningEnabled, riskWarningTitle, riskWarningContent, riskWarningCountdown, riskWarningConfirmText } =
    parsed.data;
```
Change to:
```typescript
const { name, slug, description, summary, image, price, maxQuantity, status, tagIds, productType, sourceUrl, validityHours, allowAccountSwitch, accountSwitchLimit, riskWarningEnabled, riskWarningTitle, riskWarningContent, riskWarningCountdown, riskWarningConfirmText, purchaseLimitEnabled, purchaseLimitQuantity } =
    parsed.data;
```

In the `prisma.product.create` data object, after `riskWarningConfirmText: riskWarningConfirmText ?? null,`:
```typescript
purchaseLimitEnabled: purchaseLimitEnabled ?? false,
purchaseLimitQuantity: purchaseLimitQuantity ?? 1,
```

- [ ] **Step 2: Update `PUT /api/products/[productId]` in `app/api/products/[productId]/route.ts`**

On the destructure line (currently line 85):
```typescript
const { tagIds, productType, sourceUrl, price, pinned, validityHours, allowAccountSwitch, accountSwitchLimit, riskWarningEnabled, riskWarningTitle, riskWarningContent, riskWarningCountdown, riskWarningConfirmText, ...rest } = parsed.data;
```
Change to:
```typescript
const { tagIds, productType, sourceUrl, price, pinned, validityHours, allowAccountSwitch, accountSwitchLimit, riskWarningEnabled, riskWarningTitle, riskWarningContent, riskWarningCountdown, riskWarningConfirmText, purchaseLimitEnabled, purchaseLimitQuantity, ...rest } = parsed.data;
```

After the last `if (riskWarningConfirmText !== undefined)` block, add:
```typescript
if (purchaseLimitEnabled !== undefined) {
    updateData.purchaseLimitEnabled = purchaseLimitEnabled
}
if (purchaseLimitQuantity !== undefined) {
    updateData.purchaseLimitQuantity = purchaseLimitQuantity
}
```

- [ ] **Step 3: Run existing product API tests**

```bash
npx jest __tests__/api/products-route.test.ts __tests__/api/products-productId.test.ts --no-coverage
```

Expected: All existing tests still PASS (new fields are optional; existing tests don't break).

- [ ] **Step 4: Commit**

```bash
git add app/api/products/route.ts app/api/products/[productId]/route.ts
git commit -m "feat(api): propagate purchaseLimitEnabled/Quantity through product create and update"
```

---

## Task 5: Remove AUTO_FETCH time-window check + update affected tests

**Files:**
- Modify: `app/api/orders/route.ts`
- Modify: `__tests__/api/orders-create-auto-fetch-fingerprint.test.ts`

- [ ] **Step 1: Delete time-window check from `createAutoFetchOrder`**

In `app/api/orders/route.ts`, delete the entire block inside `createAutoFetchOrder` (currently lines 72–137):
```typescript
// Delete from:
// 多因素活跃订单检查：邮箱 / 指纹 / IP（辅助信号）三因素，任一命中则拒绝
if (config.nodeEnv !== "development") {
    // ... (the entire if-block including const emailLower, cooldownStart, timeWindowCondition, emailSignal, auxiliarySignals, ownerCondition, activeOrder, and the if(activeOrder) return)
}
```

Also remove the now-unused `formatDateTimeShirt` import on line 7:
```typescript
import { formatDateTimeShort } from "@/lib/utils"
```
(Delete this import line.)

- [ ] **Step 2: Remove obsolete time-window tests from `__tests__/api/orders-create-auto-fetch-fingerprint.test.ts`**

Delete the following complete `describe` blocks from the file:
- `describe("活跃订单查询 WHERE 子句", ...)` — these test the old `findFirst` WHERE clause; now covered by `purchase-limit.test.ts`
- `describe("时间窗口条件", ...)` — tests the old time-window logic; deleted
- `describe("已过期订单不阻断新下单", ...)` — tests old behavior; deleted

Also delete these individual `describe` blocks whose content depends on the old check:
- `describe("免费 AUTO_FETCH — 活跃订单拦截", ...)` — old check no longer runs without `purchaseLimitEnabled`
- `describe("被拦截时的错误文案", ...)` — old error messages no longer emitted
- `describe("开发模式跳过检查", ...)` — old check no longer called in createAutoFetchOrder
- `describe("429 响应 orderNo 安全性", ...)` — old behavior; now in orders-purchase-limit.test.ts

Keep only these describe blocks:
- `describe("fingerprintHash 写入订单", ...)` — still valid, tests storage behavior
- `describe("免费 AUTO_FETCH 成功下单响应", ...)` — still valid, tests success response shape

Also update the `beforeEach` to remove the `prismaMock.order.findFirst` setup that was for the old check (if present), and ensure `prismaMock.order.count.mockResolvedValue(0)` remains for the pending-orders IP check.

Also update `makeFreeAutoFetchProduct` and `makePaidAutoFetchProduct` helper functions to add `purchaseLimitEnabled: false` and `purchaseLimitQuantity: 1` fields:
```typescript
function makeFreeAutoFetchProduct(overrides?: Record<string, unknown>) {
  return {
    // ... existing fields ...
    purchaseLimitEnabled: false,
    purchaseLimitQuantity: 1,
    ...overrides,
  } as any
}
```

- [ ] **Step 3: Run the updated test file**

```bash
npx jest __tests__/api/orders-create-auto-fetch-fingerprint.test.ts --no-coverage
```

Expected: All remaining tests PASS.

- [ ] **Step 4: Run full test suite to catch any regressions**

```bash
npm test -- --no-coverage 2>&1 | tail -20
```

Expected: No new failures.

- [ ] **Step 5: Commit**

```bash
git add app/api/orders/route.ts __tests__/api/orders-create-auto-fetch-fingerprint.test.ts
git commit -m "refactor(orders): remove AUTO_FETCH time-window duplicate check; purchase limit handles this"
```

---

## Task 6: Insert purchase limit check in order creation + integration tests

**Files:**
- Modify: `app/api/orders/route.ts`
- Create: `__tests__/api/orders-purchase-limit.test.ts`

- [ ] **Step 1: Write failing integration tests**

Create `__tests__/api/orders-purchase-limit.test.ts`:

```typescript
/**
 * Integration tests: purchase limit check in POST /api/orders.
 *
 * Covers NORMAL and AUTO_FETCH products with purchaseLimitEnabled=true/false,
 * orderNo security, and development mode bypass.
 */
import { type NextRequest } from "next/server"
import { POST } from "@/app/api/orders/route"
import { prismaMock } from "../../__mocks__/prisma"
import { Prisma } from "@prisma/client"

jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../__mocks__/prisma")
  return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/auth-guard", () => ({
  __esModule: true,
  getAdminSession: jest.fn(),
}))

jest.mock("better-auth/crypto", () => ({
  __esModule: true,
  hashPassword: jest.fn().mockResolvedValue("hashed-pw"),
}))

jest.mock("@/lib/rate-limit", () => ({
  __esModule: true,
  checkOrderCreateRateLimit: jest.fn().mockResolvedValue(null),
  checkTurnstileFallbackRateLimit: jest.fn().mockResolvedValue(true),
  getClientIp: jest.fn().mockReturnValue("1.2.3.4"),
  MAX_PENDING_ORDERS_PER_IP: 3,
}))

jest.mock("@/lib/get-payment-url", () => ({
  getPaymentUrlForOrder: jest.fn().mockReturnValue("https://pay.example.com/pay"),
}))

jest.mock("@/lib/config", () => {
  const mock = {
    turnstileSecretKey: undefined as string | undefined,
    nodeEnv: "test" as string,
    siteUrl: "http://localhost:3000",
    basePromoDiscountPercent: 5,
    autoFetchMaxQuantityPerOrder: 1,
    autoFetchCooldownHours: 24,
    autoFetchSourceUrls: ["https://source.example.com"],
    exitDiscountSecret: undefined as string | undefined,
  }
  ;(global as { __configMockPL?: typeof mock }).__configMockPL = mock
  return { config: mock, getConfig: () => mock }
})

jest.mock("@/lib/turnstile", () => ({ verifyTurnstileToken: jest.fn() }))
jest.mock("@/lib/complete-pending-order", () => ({ completePendingOrder: jest.fn() }))
jest.mock("@/lib/order-success-token", () => ({
  createOrderSuccessToken: jest.fn().mockReturnValue("mock-token"),
}))
jest.mock("@/lib/scrape-shared-accounts", () => ({
  scrapeMultipleUrls: jest.fn().mockResolvedValue([]),
}))
jest.mock("@/lib/payment-channel", () => ({
  selectPaymentChannel: jest.fn().mockResolvedValue(null),
}))
jest.mock("@/lib/turnstile-policy", () => ({
  isStorefrontTurnstileEnforced: jest.fn().mockReturnValue(false),
}))
jest.mock("@/lib/exit-discount", () => ({
  verifyExitDiscountToken: jest.fn().mockReturnValue({ valid: false }),
}))

function getConfig() {
  return (global as { __configMockPL?: Record<string, unknown> }).__configMockPL!
}

function makeNormalProduct(overrides?: Record<string, unknown>) {
  return {
    id: "prod_normal",
    name: "Normal Product",
    slug: "normal-product",
    summary: null,
    description: null,
    image: null,
    price: new Prisma.Decimal("29.90"),
    maxQuantity: 10,
    status: "ACTIVE",
    productType: "NORMAL",
    sourceUrl: null,
    validityHours: null,
    allowAccountSwitch: false,
    accountSwitchLimit: 1,
    couponEnabled: false,
    riskWarningEnabled: false,
    riskWarningTitle: null,
    riskWarningContent: null,
    riskWarningCountdown: null,
    riskWarningConfirmText: null,
    pinnedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    purchaseLimitEnabled: false,
    purchaseLimitQuantity: 1,
    ...overrides,
  } as any
}

function makeAutoFetchProduct(overrides?: Record<string, unknown>) {
  return {
    id: "prod_af",
    name: "AutoFetch Product",
    slug: "autofetch-product",
    summary: null,
    description: null,
    image: null,
    price: new Prisma.Decimal("0"),
    maxQuantity: 1,
    status: "ACTIVE",
    productType: "AUTO_FETCH",
    sourceUrl: "https://source.example.com",
    validityHours: 24,
    allowAccountSwitch: true,
    accountSwitchLimit: 1,
    couponEnabled: false,
    riskWarningEnabled: false,
    riskWarningTitle: null,
    riskWarningContent: null,
    riskWarningCountdown: null,
    riskWarningConfirmText: null,
    pinnedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    purchaseLimitEnabled: false,
    purchaseLimitQuantity: 1,
    ...overrides,
  } as any
}

function makeRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
    cookies: { get: () => undefined },
  } as unknown as NextRequest
}

const BASE_BODY = {
  productId: "prod_normal",
  email: "user@example.com",
  orderPassword: "password123",
  quantity: 1,
  paymentMethod: "alipay",
}

describe("POST /api/orders — purchase limit check", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getConfig().nodeEnv = "test"
    prismaMock.user.findFirst.mockResolvedValue(null)
    ;(prismaMock.paymentChannel?.findMany as jest.Mock | undefined)?.mockResolvedValue([])
  })

  describe("NORMAL product — purchaseLimitEnabled=false", () => {
    it("limit disabled → order.count not called for purchase limit", async () => {
      prismaMock.product.findUnique.mockResolvedValue(makeNormalProduct({ purchaseLimitEnabled: false }))
      prismaMock.order.count.mockResolvedValue(0) // pending IP check returns 0
      prismaMock.card.count.mockResolvedValue(5) // stock check
      prismaMock.$transaction.mockResolvedValue({ id: "o1", orderNo: "uuid-1", amount: new Prisma.Decimal("29.90") })

      const res = await POST(makeRequest(BASE_BODY))

      // Should not return 429
      expect(res.status).not.toBe(429)
    })
  })

  describe("NORMAL product — purchaseLimitEnabled=true, limitQuantity=1", () => {
    it("no previous orders → proceeds (not 429)", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeNormalProduct({ purchaseLimitEnabled: true, purchaseLimitQuantity: 1 }),
      )
      prismaMock.order.count
        .mockResolvedValueOnce(0) // pending IP check
        .mockResolvedValueOnce(0) // purchase limit: no previous COMPLETED orders
      prismaMock.card.count.mockResolvedValue(5)
      prismaMock.$transaction.mockResolvedValue({ id: "o1", orderNo: "uuid-1", amount: new Prisma.Decimal("29.90") })

      const res = await POST(makeRequest(BASE_BODY))

      expect(res.status).not.toBe(429)
    })

    it("1 previous COMPLETED order → 429 with limit message", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeNormalProduct({ purchaseLimitEnabled: true, purchaseLimitQuantity: 1 }),
      )
      prismaMock.order.count
        .mockResolvedValueOnce(0) // pending IP check
        .mockResolvedValueOnce(1) // purchase limit: 1 existing
      prismaMock.order.findFirst.mockResolvedValue({
        orderNo: "prev-order-uuid",
        email: "user@example.com",
      } as any)

      const res = await POST(makeRequest(BASE_BODY))
      const data = await res.json()

      expect(res.status).toBe(429)
      expect(data.error).toContain("限购")
    })

    it("blocked with own email → response includes orderNo", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeNormalProduct({ purchaseLimitEnabled: true, purchaseLimitQuantity: 1 }),
      )
      prismaMock.order.count
        .mockResolvedValueOnce(0) // pending IP check
        .mockResolvedValueOnce(1) // purchase limit blocked
      prismaMock.order.findFirst.mockResolvedValue({
        orderNo: "own-order-uuid",
        email: "user@example.com",
      } as any)

      const res = await POST(makeRequest(BASE_BODY))
      const data = await res.json()

      expect(res.status).toBe(429)
      expect(data.orderNo).toBe("own-order-uuid")
    })

    it("blocked via fingerprint (other user's email) → response hides orderNo", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeNormalProduct({ purchaseLimitEnabled: true, purchaseLimitQuantity: 1 }),
      )
      prismaMock.order.count
        .mockResolvedValueOnce(0) // pending IP check
        .mockResolvedValueOnce(1) // purchase limit blocked
      prismaMock.order.findFirst.mockResolvedValue({
        orderNo: "other-user-uuid",
        email: "other@example.com",
      } as any)

      const res = await POST(makeRequest({ ...BASE_BODY, fingerprintHash: "fp-shared" }))
      const data = await res.json()

      expect(res.status).toBe(429)
      expect(data.orderNo).toBeUndefined()
    })
  })

  describe("NORMAL product — limitQuantity=2", () => {
    it("1 previous order → not blocked", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeNormalProduct({ purchaseLimitEnabled: true, purchaseLimitQuantity: 2 }),
      )
      prismaMock.order.count
        .mockResolvedValueOnce(0) // pending IP check
        .mockResolvedValueOnce(1) // purchase limit: only 1 existing, limit is 2
      prismaMock.card.count.mockResolvedValue(5)
      prismaMock.$transaction.mockResolvedValue({ id: "o1", orderNo: "uuid-1", amount: new Prisma.Decimal("29.90") })

      const res = await POST(makeRequest(BASE_BODY))

      expect(res.status).not.toBe(429)
    })

    it("2 previous orders → blocked", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeNormalProduct({ purchaseLimitEnabled: true, purchaseLimitQuantity: 2 }),
      )
      prismaMock.order.count
        .mockResolvedValueOnce(0) // pending IP check
        .mockResolvedValueOnce(2) // purchase limit: 2 existing = limitQuantity
      prismaMock.order.findFirst.mockResolvedValue({
        orderNo: "prev-uuid",
        email: "user@example.com",
      } as any)

      const res = await POST(makeRequest(BASE_BODY))

      expect(res.status).toBe(429)
    })
  })

  describe("AUTO_FETCH product — purchaseLimitEnabled=true", () => {
    it("1 previous COMPLETED order → 429", async () => {
      const { scrapeMultipleUrls } = require("@/lib/scrape-shared-accounts")
      ;(scrapeMultipleUrls as jest.Mock).mockResolvedValue([])

      prismaMock.product.findUnique.mockResolvedValue(
        makeAutoFetchProduct({ purchaseLimitEnabled: true, purchaseLimitQuantity: 1 }),
      )
      prismaMock.order.count
        .mockResolvedValueOnce(0) // pending IP check
        .mockResolvedValueOnce(1) // purchase limit: 1 existing
      prismaMock.order.findFirst.mockResolvedValue({
        orderNo: "af-prev-uuid",
        email: "user@example.com",
      } as any)

      const res = await POST(makeRequest({ ...BASE_BODY, productId: "prod_af" }))

      expect(res.status).toBe(429)
    })

    it("0 previous orders → proceeds past limit check", async () => {
      const { scrapeMultipleUrls } = require("@/lib/scrape-shared-accounts")
      ;(scrapeMultipleUrls as jest.Mock).mockResolvedValue([
        { account: "shared@apple.com", password: "Pass123!", region: "US", status: "valid" },
      ])

      prismaMock.product.findUnique.mockResolvedValue(
        makeAutoFetchProduct({ purchaseLimitEnabled: true, purchaseLimitQuantity: 1 }),
      )
      prismaMock.order.count
        .mockResolvedValueOnce(0) // pending IP check
        .mockResolvedValueOnce(0) // purchase limit: no previous
      prismaMock.accountBlacklist.findMany.mockResolvedValue([])
      prismaMock.$transaction.mockImplementation(async (fn: Function) => {
        const tx = {
          order: { create: jest.fn().mockResolvedValue({ id: "o1", orderNo: "uuid-1" }) },
          card: { create: jest.fn().mockResolvedValue({ id: "c1" }) },
        }
        await fn(tx)
        return { orderNo: "uuid-1" }
      })

      const res = await POST(makeRequest({ ...BASE_BODY, productId: "prod_af" }))

      expect(res.status).toBe(200)
    })
  })

  describe("development mode", () => {
    it("nodeEnv=development → purchase limit check skipped even if enabled", async () => {
      getConfig().nodeEnv = "development"

      prismaMock.product.findUnique.mockResolvedValue(
        makeNormalProduct({ purchaseLimitEnabled: true, purchaseLimitQuantity: 1 }),
      )
      prismaMock.order.count.mockResolvedValue(0) // only pending IP check
      prismaMock.card.count.mockResolvedValue(5)
      prismaMock.$transaction.mockResolvedValue({ id: "o1", orderNo: "uuid-1", amount: new Prisma.Decimal("29.90") })

      const completePendingOrder = require("@/lib/complete-pending-order").completePendingOrder
      ;(completePendingOrder as jest.Mock).mockResolvedValue({ done: true, orderNo: "uuid-1" })

      const res = await POST(makeRequest(BASE_BODY))

      // In dev mode the check is bypassed — order.count called at most once (IP check)
      const countCalls = prismaMock.order.count.mock.calls.length
      expect(countCalls).toBeLessThanOrEqual(1)
    })
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest __tests__/api/orders-purchase-limit.test.ts --no-coverage
```

Expected: Multiple tests FAIL (purchase limit check not yet implemented).

- [ ] **Step 3: Add purchase limit check to `POST /api/orders`**

In `app/api/orders/route.ts`, add import at top:
```typescript
import { checkPurchaseLimit } from "@/lib/purchase-limit"
```

After the product validation block (after `if (couponCode && !product.couponEnabled) { ... }`) and before the `isAutoFetch` check, add:

```typescript
if (product.purchaseLimitEnabled && config.nodeEnv !== "development") {
    const limitResult = await checkPurchaseLimit({
        productId,
        email,
        fingerprintHash,
        clientIp,
        limitQuantity: product.purchaseLimitQuantity,
    })
    if (limitResult.blocked) {
        return NextResponse.json(
            { error: limitResult.message, ...(limitResult.orderNo ? { orderNo: limitResult.orderNo } : {}) },
            { status: 429 },
        )
    }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest __tests__/api/orders-purchase-limit.test.ts --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npm test -- --no-coverage 2>&1 | tail -20
```

Expected: No failures.

- [ ] **Step 6: Commit**

```bash
git add app/api/orders/route.ts lib/purchase-limit.ts __tests__/api/orders-purchase-limit.test.ts
git commit -m "feat(orders): enforce per-product purchase limit using multi-factor identity check"
```

---

## Task 7: Admin UI — purchase limit form section

**Files:**
- Create: `app/components/product-form-purchase-limit-fields.tsx`
- Modify: `app/components/product-form.tsx`

- [ ] **Step 1: Create `app/components/product-form-purchase-limit-fields.tsx`**

```tsx
"use client"

import { useFormContext } from "react-hook-form"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import type { ProductFormSchema } from "@/lib/validations/product"

export function ProductFormPurchaseLimitFields() {
    const { control, watch } = useFormContext<ProductFormSchema>()
    const purchaseLimitEnabled = watch("purchaseLimitEnabled") ?? false

    return (
        <Card>
            <CardHeader>
                <CardTitle>限购设置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <FormField
                    control={control}
                    name="purchaseLimitEnabled"
                    render={({ field }) => (
                        <FormItem className="flex items-center justify-between gap-4">
                            <div className="space-y-0.5">
                                <FormLabel>启用限购</FormLabel>
                                <FormDescription>
                                    开启后，同一用户（邮箱 / 指纹 / IP 识别）最多购买指定次数
                                </FormDescription>
                            </div>
                            <FormControl>
                                <Switch
                                    checked={field.value ?? false}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />

                {purchaseLimitEnabled && (
                    <div className="border-l-2 border-muted pl-4">
                        <FormField
                            control={control}
                            name="purchaseLimitQuantity"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>限购数量</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min={1}
                                            step={1}
                                            placeholder="1"
                                            {...field}
                                            value={field.value ?? "1"}
                                            onChange={(e) =>
                                                field.onChange(e.target.value.replace(/[^0-9]/g, ""))
                                            }
                                        />
                                    </FormControl>
                                    <FormDescription>每位用户最多可购买的次数</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
```

- [ ] **Step 2: Update `app/components/product-form.tsx`**

**2a. Add import** at the top (after the existing sub-component imports):
```typescript
import { ProductFormPurchaseLimitFields } from "./product-form-purchase-limit-fields"
```

**2b. Extend `ProductData` type** — add after `riskWarningConfirmText`:
```typescript
purchaseLimitEnabled?: boolean
purchaseLimitQuantity?: number
```

**2c. Add to `defaultValues`** in `useForm` — after `riskWarningConfirmText`:
```typescript
purchaseLimitEnabled: product?.purchaseLimitEnabled ?? false,
purchaseLimitQuantity: product?.purchaseLimitQuantity != null ? String(product.purchaseLimitQuantity) : "1",
```

**2d. Add to `onSubmit` body** — after `riskWarningConfirmText`:
```typescript
purchaseLimitEnabled: data.purchaseLimitEnabled ?? false,
purchaseLimitQuantity: data.purchaseLimitEnabled && data.purchaseLimitQuantity && data.purchaseLimitQuantity !== ""
    ? parseInt(data.purchaseLimitQuantity, 10)
    : 1,
```

**2e. Add component to JSX** — in the `<div className="min-w-0 lg:col-span-2 space-y-6">` after `<ProductFormRiskWarningFields />`:
```tsx
<ProductFormPurchaseLimitFields />
```

- [ ] **Step 3: Run full test suite**

```bash
npm test -- --no-coverage 2>&1 | tail -20
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add app/components/product-form-purchase-limit-fields.tsx app/components/product-form.tsx
git commit -m "feat(admin): add purchase limit toggle and quantity input to product form"
```
