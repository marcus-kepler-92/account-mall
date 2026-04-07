# Multi-Channel Payment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support multiple 易支付 accounts with type-scoped annual-limit rotation, per-channel balance tracking, and admin UI for channel management and withdrawal recording.

**Architecture:** Add `PaymentChannel` and `ChannelWithdrawal` DB models; order creation calls `selectPaymentChannel(type)` to pick a channel and writes `paymentChannelId` to the order; the notify callback looks up the order to get the channel key for verification; admin UI shows per-channel year income + balance with CRUD operations.

**Tech Stack:** Prisma 6, Next.js App Router, shadcn/ui, TanStack Table, Zod, Jest

**Spec:** `docs/superpowers/specs/2026-03-17-multi-channel-payment-design.md`

---

## File Map

| Action | File |
|--------|------|
| Modify | `prisma/schema.prisma` |
| Create | `lib/payment-channel.ts` |
| Create | `__tests__/lib/payment-channel.test.ts` |
| Modify | `lib/yipay.ts` |
| Modify | `__tests__/lib/yipay.test.ts` |
| Modify | `lib/yipay-notify-complete.ts` |
| Modify | `__tests__/lib/yipay-notify-complete.test.ts` |
| Modify | `lib/get-payment-url.ts` |
| Modify | `__tests__/lib/get-payment-url.test.ts` |
| Modify | `app/api/orders/route.ts` |
| Create | `lib/validations/payment-channel.ts` |
| Create | `app/api/admin/payment-channels/route.ts` |
| Create | `app/api/admin/payment-channels/[id]/route.ts` |
| Create | `app/api/admin/payment-channels/[id]/withdrawals/route.ts` |
| Create | `app/admin/(main)/payment-channels/page.tsx` |
| Create | `app/admin/(main)/payment-channels/payment-channels-columns.tsx` |
| Create | `app/admin/(main)/payment-channels/payment-channels-data-table.tsx` |
| Create | `app/admin/(main)/payment-channels/channel-form-dialog.tsx` |
| Create | `app/admin/(main)/payment-channels/channel-withdrawal-dialog.tsx` |
| Create | `app/admin/(main)/payment-channels/loading.tsx` |
| Modify | `app/components/admin-sidebar.tsx` |

---

## Task 1: DB Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add models to schema.prisma**

Add after the `Withdrawal` model block:

```prisma
model PaymentChannel {
  id          String              @id @default(cuid())
  nickname    String
  pid         String
  key         String
  submitUrl   String
  siteName    String
  type        String              // "alipay" | "wxpay" | "qqpay"
  annualLimit Decimal             @db.Decimal(10, 2) @default(65000)
  sortOrder   Int                 @default(0)
  isActive    Boolean             @default(true)
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt
  orders      Order[]
  withdrawals ChannelWithdrawal[]

  @@index([type, isActive, sortOrder])
}

model ChannelWithdrawal {
  id        String         @id @default(cuid())
  channelId String
  amount    Decimal        @db.Decimal(10, 2)
  note      String?        @db.Text
  createdAt DateTime       @default(now())
  channel   PaymentChannel @relation(fields: [channelId], references: [id])

  @@index([channelId])
}
```

Add to the `Order` model (after `switchAccountCount` field):
```prisma
  paymentChannelId String?
  paymentChannel   PaymentChannel? @relation(fields: [paymentChannelId], references: [id])
```

Add index to `Order` model:
```prisma
  @@index([paymentChannelId])
```

- [ ] **Step 2: Run migration**

```bash
npm run db:migrate
```

When prompted for migration name, enter: `add_payment_channels`

Expected: migration file created and applied successfully.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add PaymentChannel and ChannelWithdrawal models"
```

---

## Task 2: selectPaymentChannel

**Files:**
- Create: `lib/payment-channel.ts`
- Create: `__tests__/lib/payment-channel.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/payment-channel.test.ts`:

```typescript
import { selectPaymentChannel } from "@/lib/payment-channel"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

import { prismaMock } from "../../__mocks__/prisma"

function makeChannel(overrides: Record<string, unknown> = {}) {
    return {
        id: "ch_1",
        nickname: "Test",
        pid: "pid1",
        key: "key1",
        submitUrl: "https://pay.example.com/submit.php",
        siteName: "Test Site",
        type: "alipay",
        annualLimit: 65000,
        sortOrder: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    }
}

describe("selectPaymentChannel", () => {
    beforeEach(() => {
        prismaMock.paymentChannel.findMany.mockReset()
        prismaMock.order.groupBy.mockReset()
    })

    it("returns null when no active channels of that type", async () => {
        prismaMock.paymentChannel.findMany.mockResolvedValue([])
        const result = await selectPaymentChannel("alipay")
        expect(result).toBeNull()
    })

    it("returns first channel under annual limit", async () => {
        const ch1 = makeChannel({ id: "ch_1", sortOrder: 0 })
        const ch2 = makeChannel({ id: "ch_2", sortOrder: 1 })
        prismaMock.paymentChannel.findMany.mockResolvedValue([ch1, ch2])
        prismaMock.order.groupBy.mockResolvedValue([
            { paymentChannelId: "ch_1", _sum: { amount: 10000 } },
        ])
        const result = await selectPaymentChannel("alipay")
        expect(result?.id).toBe("ch_1")
    })

    it("skips channel at limit and returns next one", async () => {
        const ch1 = makeChannel({ id: "ch_1", sortOrder: 0, annualLimit: 65000 })
        const ch2 = makeChannel({ id: "ch_2", sortOrder: 1, annualLimit: 65000 })
        prismaMock.paymentChannel.findMany.mockResolvedValue([ch1, ch2])
        prismaMock.order.groupBy.mockResolvedValue([
            { paymentChannelId: "ch_1", _sum: { amount: 65000 } },
        ])
        const result = await selectPaymentChannel("alipay")
        expect(result?.id).toBe("ch_2")
    })

    it("returns channel with most remaining capacity when all are over limit", async () => {
        const ch1 = makeChannel({ id: "ch_1", sortOrder: 0, annualLimit: 65000 })
        const ch2 = makeChannel({ id: "ch_2", sortOrder: 1, annualLimit: 65000 })
        prismaMock.paymentChannel.findMany.mockResolvedValue([ch1, ch2])
        prismaMock.order.groupBy.mockResolvedValue([
            { paymentChannelId: "ch_1", _sum: { amount: 70000 } },
            { paymentChannelId: "ch_2", _sum: { amount: 66000 } },
        ])
        // ch_2 has more remaining capacity (65000-66000=-1000 vs 65000-70000=-5000)
        const result = await selectPaymentChannel("alipay")
        expect(result?.id).toBe("ch_2")
    })

    it("only queries channels of the requested type", async () => {
        prismaMock.paymentChannel.findMany.mockResolvedValue([])
        await selectPaymentChannel("wxpay")
        expect(prismaMock.paymentChannel.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ type: "wxpay" }),
            })
        )
    })

    it("treats channel with no orders as income=0", async () => {
        const ch1 = makeChannel({ id: "ch_1" })
        prismaMock.paymentChannel.findMany.mockResolvedValue([ch1])
        prismaMock.order.groupBy.mockResolvedValue([]) // no income rows
        const result = await selectPaymentChannel("alipay")
        expect(result?.id).toBe("ch_1")
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/lib/payment-channel.test.ts -t "selectPaymentChannel" --no-coverage
```

Expected: FAIL — "Cannot find module '@/lib/payment-channel'"

- [ ] **Step 3: Implement `lib/payment-channel.ts`**

```typescript
import { prisma } from "@/lib/prisma"
import type { PaymentChannel } from "@prisma/client"

function getYearBounds(): { start: Date; end: Date } {
    const year = new Date().getFullYear()
    return {
        start: new Date(year, 0, 1),
        end: new Date(year + 1, 0, 1),
    }
}

export async function selectPaymentChannel(type: string): Promise<PaymentChannel | null> {
    const channels = await prisma.paymentChannel.findMany({
        where: { isActive: true, type },
        orderBy: { sortOrder: "asc" },
    })

    if (channels.length === 0) return null

    const { start, end } = getYearBounds()

    const incomeRows = await prisma.order.groupBy({
        by: ["paymentChannelId"],
        where: {
            paymentChannelId: { in: channels.map((c) => c.id) },
            status: "COMPLETED",
            paidAt: { gte: start, lt: end },
        },
        _sum: { amount: true },
    })

    const incomeMap = new Map(
        incomeRows.map((r) => [r.paymentChannelId, Number(r._sum.amount ?? 0)])
    )

    for (const channel of channels) {
        const income = incomeMap.get(channel.id) ?? 0
        if (income < Number(channel.annualLimit)) {
            return channel
        }
    }

    // All over limit: return the one with the most remaining capacity (least exceeded)
    return channels.reduce((best, ch) => {
        const bestRemaining = Number(best.annualLimit) - (incomeMap.get(best.id) ?? 0)
        const chRemaining = Number(ch.annualLimit) - (incomeMap.get(ch.id) ?? 0)
        return chRemaining > bestRemaining ? ch : best
    })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/lib/payment-channel.test.ts --no-coverage
```

Expected: PASS — 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/payment-channel.ts __tests__/lib/payment-channel.test.ts
git commit -m "feat(lib): add selectPaymentChannel with type-scoped annual limit rotation"
```

---

## Task 3: Update yipay.ts

**Files:**
- Modify: `lib/yipay.ts`
- Modify: `__tests__/lib/yipay.test.ts`

- [ ] **Step 1: Update `buildSubmitUrl` to accept optional submitUrl**

In `lib/yipay.ts`, change `buildSubmitUrl`:

```typescript
export function buildSubmitUrl(params: Record<string, string>, key: string, submitUrl?: string): string {
    const prestr = getVerifyParams(params)
    const sign = md5(prestr + key)
    const base = submitUrl ?? config.yipaySubmitUrl ?? ""
    return `${base}?${prestr}&sign=${sign}&sign_type=MD5`
}
```

- [ ] **Step 2: Update `getYipayPagePayUrl` to accept optional channel config**

Replace the function signature and body:

```typescript
export type YipayChannelConfig = {
    pid: string
    key: string
    submitUrl: string
    siteName: string
}

export function getYipayPagePayUrl(params: {
    orderNo: string
    totalAmount: string
    subject: string
    type?: string
    channel?: YipayChannelConfig
}): string | null {
    const channel = params.channel
    const pid = channel?.pid ?? config.yipayPid
    const key = channel?.key ?? config.yipayKey
    const submitUrl = channel?.submitUrl ?? config.yipaySubmitUrl
    const siteName = channel?.siteName ?? config.yipaySiteName

    if (!pid || !key || !submitUrl || !siteName) return null

    const base = config.siteUrl
    const requestParams: Record<string, string> = {
        pid,
        money: params.totalAmount,
        name: params.subject,
        notify_url: `${base}/api/payment/yipay/notify`,
        return_url: `${base}/orders/pay-return`,
        out_trade_no: params.orderNo,
        sitename: siteName,
        type: params.type ?? "alipay",
    }
    try {
        return buildSubmitUrl(requestParams, key, submitUrl)
    } catch {
        return null
    }
}
```

- [ ] **Step 3: Update `verifyYipayNotifySign` to accept optional key**

```typescript
export function verifyYipayNotifySign(postData: Record<string, unknown>, key?: string): boolean {
    const signingKey = key ?? config.yipayKey
    if (!signingKey) return false
    const signReceived = postData.sign
    if (typeof signReceived !== "string" || !signReceived) return false
    const stringParams: Record<string, string> = {}
    for (const [k, v] of Object.entries(postData)) {
        if (v !== undefined && v !== null && String(v).trim() !== "") {
            stringParams[k] = String(v).trim()
        }
    }
    const prestr = getVerifyParams(stringParams)
    const mysign = md5(prestr + signingKey)
    return mysign === signReceived.toLowerCase()
}
```

Also remove the `isYipayConfigured()` call from this function (no longer relevant — key fallback handles it).

- [ ] **Step 4: Remove `isYipayConfigured()` from the function and also update `isYipayConfigured` to check DB channels OR env vars**

Note: `isYipayConfigured()` is still used in `get-payment-url.ts`. Keep it for env-var fallback detection but it stays as-is. The multi-channel path bypasses it.

- [ ] **Step 5: Run existing yipay tests**

```bash
npx jest __tests__/lib/yipay.test.ts --no-coverage
```

Expected: PASS — all existing tests still pass (backward compatible: calling without `channel` falls back to config).

- [ ] **Step 6: Add test for channel override in `__tests__/lib/yipay.test.ts`**

Add to the end of the file:

```typescript
describe("getYipayPagePayUrl with channel override", () => {
    it("uses channel config instead of global config when provided", () => {
        const url = getYipayPagePayUrl({
            orderNo: "ord_1",
            totalAmount: "99.00",
            subject: "Test Product",
            type: "alipay",
            channel: {
                pid: "channel_pid",
                key: "channel_key",
                submitUrl: "https://other-pay.com/submit.php",
                siteName: "Other Site",
            },
        })
        expect(url).not.toBeNull()
        expect(url).toContain("https://other-pay.com/submit.php")
        expect(url).toContain("pid=channel_pid")
        expect(url).toContain("sitename=Other+Site")
    })
})

describe("verifyYipayNotifySign with explicit key", () => {
    it("verifies with provided key instead of config key", () => {
        const params = { pid: "1", money: "10.00", out_trade_no: "ord_1" }
        const key = "channel_signing_key"
        // Build a valid URL first, then extract sign
        const url = buildSubmitUrl(params, key, "https://pay.com/submit.php")
        const urlParams = new URLSearchParams(url.split("?")[1])
        const sign = urlParams.get("sign")!
        const postData = { ...params, sign, sign_type: "MD5" }
        expect(verifyYipayNotifySign(postData, key)).toBe(true)
        // Wrong key should fail
        expect(verifyYipayNotifySign(postData, "wrong_key")).toBe(false)
    })
})
```

- [ ] **Step 7: Run yipay tests again**

```bash
npx jest __tests__/lib/yipay.test.ts --no-coverage
```

Expected: PASS — all tests including the new ones.

- [ ] **Step 8: Commit**

```bash
git add lib/yipay.ts __tests__/lib/yipay.test.ts
git commit -m "feat(lib): make yipay functions accept per-channel config overrides"
```

---

## Task 4: Update yipay-notify-complete.ts

**Files:**
- Modify: `lib/yipay-notify-complete.ts`
- Modify: `__tests__/lib/yipay-notify-complete.test.ts`

The key change: look up the order by `out_trade_no` first (to get the channel key), then verify signature.

- [ ] **Step 1: Rewrite `lib/yipay-notify-complete.ts`**

```typescript
import { prisma } from "@/lib/prisma"
import { verifyYipayNotifySign } from "@/lib/yipay"
import { completePendingOrder } from "@/lib/complete-pending-order"

export async function processYipayNotifyAndComplete(
    postData: Record<string, unknown>,
): Promise<{ ok: boolean }> {
    const outTradeNo = postData.out_trade_no as string | undefined
    const totalAmount =
        (postData.money as string | undefined) ?? (postData.total_fee as string | undefined)
    const tradeStatus = (postData.trade_status as string | undefined) ?? (postData.status as string | undefined)

    if (!outTradeNo || !totalAmount) {
        return { ok: false }
    }

    // Look up order first to get the channel key for signature verification
    const order = await prisma.order.findFirst({
        where: { orderNo: outTradeNo },
        include: {
            paymentChannel: { select: { key: true } },
            product: { select: { name: true } },
            cards: { select: { id: true, status: true } },
        },
    })

    // Use channel key when available, otherwise fall back to env var key
    const channelKey = order?.paymentChannel?.key ?? undefined

    if (!verifyYipayNotifySign(postData, channelKey)) {
        return { ok: false }
    }

    const isSuccess =
        tradeStatus === "TRADE_SUCCESS" ||
        tradeStatus === "TRADE_FINISHED" ||
        tradeStatus === "success"
    if (!isSuccess) {
        return { ok: true }
    }

    if (!order) {
        return { ok: false }
    }

    const orderAmountStr = (Math.round(Number(order.amount) * 100) / 100).toFixed(2)
    const notifyAmountStr = Number(totalAmount).toFixed(2)
    if (orderAmountStr !== notifyAmountStr) {
        return { ok: false }
    }

    if (order.status === "COMPLETED") {
        console.info("[payment-notify] yipay orderNo=%s amount=%s status=already_completed", outTradeNo, orderAmountStr)
        return { ok: true }
    }
    if (order.status !== "PENDING") {
        return { ok: true }
    }

    console.info("[payment-notify] yipay orderNo=%s amount=%s status=completing", outTradeNo, orderAmountStr)
    await completePendingOrder(outTradeNo)
    return { ok: true }
}
```

- [ ] **Step 2: Run existing notify-complete tests to see which break**

```bash
npx jest __tests__/lib/yipay-notify-complete.test.ts --no-coverage
```

Expected: Some tests fail because the flow changed (order lookup now happens before verify).

- [ ] **Step 3: Read and update the test file**

Read `__tests__/lib/yipay-notify-complete.test.ts` to understand what needs updating.

The main change: the test `"returns { ok: false } when sign verification fails"` previously asserted `prismaMock.order.findFirst` was NOT called. With the new flow it IS called. Update that test:

```typescript
it("returns { ok: false } when sign verification fails", async () => {
    prismaMock.order.findFirst.mockResolvedValue(makePendingOrder())
    verifyMock.mockReturnValue(false)
    const result = await processYipayNotifyAndComplete({
        out_trade_no: "order-1",
        money: "99.00",
        trade_status: "TRADE_SUCCESS",
        sign: "bad",
    })
    expect(result).toEqual({ ok: false })
    // order lookup happens before verify now (to get channel key)
    expect(prismaMock.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orderNo: "order-1" } })
    )
})
```

Also update the `makePendingOrder` factory to include `paymentChannel: null` for existing tests:

```typescript
function makePendingOrder(overrides?: Record<string, unknown>) {
    return {
        id: "ord_1",
        orderNo: "order-1",
        status: "PENDING",
        amount: 99,
        product: { name: "Test" },
        cards: [{ id: "c1", status: "RESERVED" }],
        paymentChannel: null,
        ...overrides,
    } as any
}
```

Add a new test for channel key usage:

```typescript
it("uses channel key for verification when order has a channel", async () => {
    prismaMock.order.findFirst.mockResolvedValue(
        makePendingOrder({ paymentChannel: { key: "channel_key" } })
    )
    verifyMock.mockReturnValue(true)
    prismaMock.$transaction.mockResolvedValue(undefined)
    await processYipayNotifyAndComplete({
        out_trade_no: "order-1",
        money: "99.00",
        trade_status: "TRADE_SUCCESS",
        sign: "any",
    })
    expect(verifyMock).toHaveBeenCalledWith(expect.any(Object), "channel_key")
})

it("falls back to env var key when order has no channel", async () => {
    prismaMock.order.findFirst.mockResolvedValue(makePendingOrder({ paymentChannel: null }))
    verifyMock.mockReturnValue(true)
    prismaMock.$transaction.mockResolvedValue(undefined)
    await processYipayNotifyAndComplete({
        out_trade_no: "order-1",
        money: "99.00",
        trade_status: "TRADE_SUCCESS",
        sign: "any",
    })
    expect(verifyMock).toHaveBeenCalledWith(expect.any(Object), undefined)
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/lib/yipay-notify-complete.test.ts --no-coverage
```

Expected: PASS — all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/yipay-notify-complete.ts __tests__/lib/yipay-notify-complete.test.ts
git commit -m "feat(lib): use channel key for yipay notify verification"
```

---

## Task 5: Wire channel selection into order creation

**Files:**
- Modify: `lib/get-payment-url.ts`
- Modify: `__tests__/lib/get-payment-url.test.ts`
- Modify: `app/api/orders/route.ts`

- [ ] **Step 1: Update `lib/get-payment-url.ts`**

```typescript
import { getAlipayPagePayUrl, getAlipayWapPayUrl } from "@/lib/alipay"
import { isYipayConfigured, getYipayPagePayUrl, type YipayChannelConfig } from "@/lib/yipay"

export type ClientType = "pc" | "wap"

export interface GetPaymentUrlParams {
    orderNo: string
    totalAmount: string
    subject: string
    clientType?: ClientType
    /** 支付渠道: "alipay" | "wxpay" | "qqpay"，仅在使用易支付时生效 */
    paymentMethod?: string
    /** DB 渠道配置，有则优先使用；null/undefined 时 fallback 到 env var */
    channel?: YipayChannelConfig | null
}

export function getPaymentUrlForOrder(params: GetPaymentUrlParams): string | null {
    const { orderNo, totalAmount, subject, clientType = "pc", paymentMethod = "alipay", channel } = params
    const useYipay = channel != null || isYipayConfigured()
    return useYipay
        ? getYipayPagePayUrl({
              orderNo,
              totalAmount,
              subject,
              type: paymentMethod,
              channel: channel ?? undefined,
          })
        : clientType === "wap"
          ? getAlipayWapPayUrl({ orderNo, totalAmount, subject })
          : getAlipayPagePayUrl({ orderNo, totalAmount, subject })
}
```

- [ ] **Step 2: Run existing get-payment-url tests**

```bash
npx jest __tests__/lib/get-payment-url.test.ts --no-coverage
```

Expected: PASS — existing tests unchanged.

- [ ] **Step 3: Update `app/api/orders/route.ts` — normal order path**

Add import at the top:
```typescript
import { selectPaymentChannel } from "@/lib/payment-channel"
```

In the `POST` handler, before the retry loop where the PENDING order is created, add channel selection. Find the line:

```typescript
const amountStr = Number(order.amount).toFixed(2)
const subject = product.name ?? `订单 ${order.orderNo}`
const paymentUrl = getPaymentUrlForOrder({
    orderNo: order.orderNo,
    totalAmount: amountStr,
    subject,
    paymentMethod,
})
```

Replace with:

```typescript
const channel = await selectPaymentChannel(paymentMethod)

const amountStr = Number(order.amount).toFixed(2)
const subject = product.name ?? `订单 ${order.orderNo}`
const paymentUrl = getPaymentUrlForOrder({
    orderNo: order.orderNo,
    totalAmount: amountStr,
    subject,
    paymentMethod,
    channel,
})
```

Also add `paymentChannelId` to the order create data inside the transaction. Find:

```typescript
const newOrder = await tx.order.create({
    data: {
        orderNo,
        productId,
        productNameSnapshot: product.name,
        unitPriceSnapshot: Number(product.price),
        ...(distributorId && { distributorId }),
        email: email.trim().toLowerCase(),
        passwordHash,
        quantity,
        amount: amountRounded,
        ...(discountPercentApplied != null && { discountPercentApplied }),
        status: "PENDING",
        paymentMethod,
        ...(clientIp !== "unknown" && { clientIp }),
        ...(fingerprintHash && { fingerprintHash }),
        ...(exitDiscountMeta && { exitDiscountMeta }),
    },
})
```

The `channel` variable is from outer scope and available via closure. Add it:

```typescript
        ...(channel && { paymentChannelId: channel.id }),
```

- [ ] **Step 4: Update AUTO_FETCH paid order path**

In `createAutoFetchOrder`, add the same `selectPaymentChannel` call before the payment URL generation.

Find in the `else` branch (收费流程) after `paidOrder` is created:

```typescript
// 获取支付链接
const paymentUrl = getPaymentUrlForOrder({
    orderNo: paidOrder.orderNo,
    totalAmount: String(amount),
    subject: product.name,
    paymentMethod,
})
```

Replace with:

```typescript
const channel = await selectPaymentChannel(paymentMethod)

const paymentUrl = getPaymentUrlForOrder({
    orderNo: paidOrder.orderNo,
    totalAmount: String(amount),
    subject: product.name,
    paymentMethod,
    channel,
})
```

Also add `paymentChannelId` to the AUTO_FETCH order create data:

```typescript
const newOrder = await tx.order.create({
    data: {
        // ... existing fields ...
        ...(channel && { paymentChannelId: channel.id }),
    },
})
```

Note: the `channel` variable for AUTO_FETCH needs to be resolved before the transaction. Move `selectPaymentChannel` call before `prisma.$transaction` in the paid AUTO_FETCH path.

- [ ] **Step 5: Run the full test suite to check nothing broke**

```bash
npm test -- --testPathPattern="orders" --no-coverage
```

Expected: PASS — all order-related tests pass (channel selection is mocked via prisma mock).

- [ ] **Step 6: Commit**

```bash
git add lib/get-payment-url.ts __tests__/lib/get-payment-url.test.ts app/api/orders/route.ts
git commit -m "feat(orders): wire selectPaymentChannel into order creation"
```

---

## Task 6: Validation schema

**Files:**
- Create: `lib/validations/payment-channel.ts`

- [ ] **Step 1: Create validation schemas**

```typescript
import { z } from "zod"

export const createPaymentChannelSchema = z.object({
    nickname: z.string().min(1, "请填写备注名").max(100),
    pid: z.string().min(1, "请填写商户号").max(50),
    key: z.string().min(1, "请填写密钥").max(200),
    submitUrl: z.string().url("请填写有效的接口地址"),
    siteName: z.string().min(1, "请填写站点名称").max(100),
    type: z.enum(["alipay", "wxpay", "qqpay"], { message: "请选择支付类型" }),
    annualLimit: z.coerce.number().positive("年限额必须大于 0").default(65000),
    sortOrder: z.coerce.number().int().default(0),
    isActive: z.boolean().default(true),
})

export const updatePaymentChannelSchema = createPaymentChannelSchema.partial()

export const createChannelWithdrawalSchema = z.object({
    amount: z.coerce.number().positive("金额必须大于 0"),
    note: z.string().max(500).optional(),
})

export type CreatePaymentChannelInput = z.infer<typeof createPaymentChannelSchema>
export type UpdatePaymentChannelInput = z.infer<typeof updatePaymentChannelSchema>
export type CreateChannelWithdrawalInput = z.infer<typeof createChannelWithdrawalSchema>
```

- [ ] **Step 2: Commit**

```bash
git add lib/validations/payment-channel.ts
git commit -m "feat(validations): add payment channel and channel withdrawal schemas"
```

---

## Task 7: Admin API

**Files:**
- Create: `app/api/admin/payment-channels/route.ts`
- Create: `app/api/admin/payment-channels/[id]/route.ts`
- Create: `app/api/admin/payment-channels/[id]/withdrawals/route.ts`

- [ ] **Step 1: Create `app/api/admin/payment-channels/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, validationError } from "@/lib/api-response"
import { createPaymentChannelSchema } from "@/lib/validations/payment-channel"

function getYearBounds() {
    const year = new Date().getFullYear()
    return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) }
}

export async function GET() {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const channels = await prisma.paymentChannel.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    })

    if (channels.length === 0) {
        return NextResponse.json({ data: [] })
    }

    const channelIds = channels.map((c) => c.id)
    const { start, end } = getYearBounds()

    const [yearIncomeRows, totalIncomeRows, withdrawalRows] = await Promise.all([
        prisma.order.groupBy({
            by: ["paymentChannelId"],
            where: { paymentChannelId: { in: channelIds }, status: "COMPLETED", paidAt: { gte: start, lt: end } },
            _sum: { amount: true },
        }),
        prisma.order.groupBy({
            by: ["paymentChannelId"],
            where: { paymentChannelId: { in: channelIds }, status: "COMPLETED" },
            _sum: { amount: true },
        }),
        prisma.channelWithdrawal.groupBy({
            by: ["channelId"],
            where: { channelId: { in: channelIds } },
            _sum: { amount: true },
        }),
    ])

    const yearMap = new Map(yearIncomeRows.map((r) => [r.paymentChannelId, Number(r._sum.amount ?? 0)]))
    const totalMap = new Map(totalIncomeRows.map((r) => [r.paymentChannelId, Number(r._sum.amount ?? 0)]))
    const withdrawnMap = new Map(withdrawalRows.map((r) => [r.channelId, Number(r._sum.amount ?? 0)]))

    const data = channels.map((c) => {
        const yearIncome = yearMap.get(c.id) ?? 0
        const totalIncome = totalMap.get(c.id) ?? 0
        const totalWithdrawn = withdrawnMap.get(c.id) ?? 0
        return {
            id: c.id,
            nickname: c.nickname,
            pid: c.pid,
            key: c.key,
            submitUrl: c.submitUrl,
            siteName: c.siteName,
            type: c.type,
            annualLimit: Number(c.annualLimit),
            sortOrder: c.sortOrder,
            isActive: c.isActive,
            createdAt: c.createdAt.toISOString(),
            yearIncome,
            totalIncome,
            totalWithdrawn,
            balance: totalIncome - totalWithdrawn,
        }
    })

    return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    let body: unknown
    try { body = await request.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const parsed = createPaymentChannelSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const channel = await prisma.paymentChannel.create({ data: parsed.data })
    return NextResponse.json({ data: channel }, { status: 201 })
}
```

- [ ] **Step 2: Create `app/api/admin/payment-channels/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, validationError, notFound } from "@/lib/api-response"
import { updatePaymentChannelSchema } from "@/lib/validations/payment-channel"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id } = await params

    let body: unknown
    try { body = await request.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const parsed = updatePaymentChannelSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const existing = await prisma.paymentChannel.findUnique({ where: { id } })
    if (!existing) return notFound("渠道不存在")

    const updated = await prisma.paymentChannel.update({
        where: { id },
        data: parsed.data,
    })
    return NextResponse.json({ data: updated })
}
```

Note: No DELETE endpoint — channels are disabled via `isActive: false` in PATCH, not deleted.

- [ ] **Step 3: Create `app/api/admin/payment-channels/[id]/withdrawals/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, validationError, notFound } from "@/lib/api-response"
import { createChannelWithdrawalSchema } from "@/lib/validations/payment-channel"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id } = await params

    const channel = await prisma.paymentChannel.findUnique({ where: { id } })
    if (!channel) return notFound("渠道不存在")

    let body: unknown
    try { body = await request.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const parsed = createChannelWithdrawalSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const withdrawal = await prisma.channelWithdrawal.create({
        data: {
            channelId: id,
            amount: parsed.data.amount,
            note: parsed.data.note,
        },
    })
    return NextResponse.json({ data: withdrawal }, { status: 201 })
}
```

- [ ] **Step 4: Verify the build compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds with no TypeScript errors in the new files.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/payment-channels/
git commit -m "feat(api): add admin payment channel CRUD and withdrawal recording endpoints"
```

---

## Task 8: Admin UI

**Files:**
- Create: `app/admin/(main)/payment-channels/page.tsx`
- Create: `app/admin/(main)/payment-channels/payment-channels-columns.tsx`
- Create: `app/admin/(main)/payment-channels/payment-channels-data-table.tsx`
- Create: `app/admin/(main)/payment-channels/channel-form-dialog.tsx`
- Create: `app/admin/(main)/payment-channels/channel-withdrawal-dialog.tsx`
- Create: `app/admin/(main)/payment-channels/loading.tsx`

- [ ] **Step 1: Create columns file**

Create `app/admin/(main)/payment-channels/payment-channels-columns.tsx`:

```typescript
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { formatCurrency } from "@/lib/utils"

export type ChannelRow = {
    id: string
    nickname: string
    pid: string
    key: string
    submitUrl: string
    siteName: string
    type: string
    annualLimit: number
    sortOrder: number
    isActive: boolean
    createdAt: string
    yearIncome: number
    totalIncome: number
    totalWithdrawn: number
    balance: number
}

const TYPE_LABELS: Record<string, string> = {
    alipay: "支付宝",
    wxpay: "微信支付",
    qqpay: "QQ支付",
}

export const paymentChannelsColumns: ColumnDef<ChannelRow>[] = [
    {
        accessorKey: "nickname",
        header: "渠道",
        cell: ({ row }) => (
            <div className="space-y-1">
                <div className="font-medium">{row.original.nickname}</div>
                <div className="text-xs text-muted-foreground">{row.original.pid}</div>
            </div>
        ),
    },
    {
        accessorKey: "type",
        header: "类型",
        cell: ({ row }) => <Badge variant="outline">{TYPE_LABELS[row.original.type] ?? row.original.type}</Badge>,
    },
    {
        accessorKey: "yearIncome",
        header: "年度进度",
        cell: ({ row }) => {
            const { yearIncome, annualLimit } = row.original
            const pct = Math.min(100, Math.round((yearIncome / annualLimit) * 100))
            const isWarning = pct >= 80
            return (
                <div className="space-y-1 min-w-32">
                    <div className="flex justify-between text-xs">
                        <span className={isWarning ? "text-warning font-medium" : "text-muted-foreground"}>
                            {formatCurrency(yearIncome)}
                        </span>
                        <span className="text-muted-foreground">/ {formatCurrency(annualLimit)}</span>
                    </div>
                    <Progress value={pct} className={isWarning ? "[&>div]:bg-warning" : ""} />
                </div>
            )
        },
    },
    {
        accessorKey: "balance",
        header: "当前余额",
        cell: ({ row }) => (
            <div className="space-y-0.5">
                <div className="font-medium">{formatCurrency(row.original.balance)}</div>
                <div className="text-xs text-muted-foreground">
                    累计收入 {formatCurrency(row.original.totalIncome)} · 已提现 {formatCurrency(row.original.totalWithdrawn)}
                </div>
            </div>
        ),
    },
    {
        accessorKey: "isActive",
        header: "状态",
        cell: ({ row }) => (
            <Badge variant={row.original.isActive ? "default" : "secondary"}>
                {row.original.isActive ? "启用" : "停用"}
            </Badge>
        ),
    },
]
```

- [ ] **Step 2: Create channel form dialog**

Create `app/admin/(main)/payment-channels/channel-form-dialog.tsx`:

```typescript
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { createPaymentChannelSchema, type CreatePaymentChannelInput } from "@/lib/validations/payment-channel"
import type { ChannelRow } from "./payment-channels-columns"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    channel?: ChannelRow | null
}

export function ChannelFormDialog({ open, onOpenChange, channel }: Props) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const isEdit = !!channel

    const form = useForm<CreatePaymentChannelInput>({
        resolver: zodResolver(createPaymentChannelSchema),
        defaultValues: channel
            ? {
                  nickname: channel.nickname,
                  pid: channel.pid,
                  key: channel.key,
                  submitUrl: channel.submitUrl,
                  siteName: channel.siteName,
                  type: channel.type as "alipay" | "wxpay" | "qqpay",
                  annualLimit: channel.annualLimit,
                  sortOrder: channel.sortOrder,
                  isActive: channel.isActive,
              }
            : {
                  nickname: "",
                  pid: "",
                  key: "",
                  submitUrl: "",
                  siteName: "",
                  type: "alipay",
                  annualLimit: 65000,
                  sortOrder: 0,
                  isActive: true,
              },
    })

    const onSubmit = async (data: CreatePaymentChannelInput) => {
        setLoading(true)
        try {
            const url = isEdit
                ? `/api/admin/payment-channels/${channel!.id}`
                : "/api/admin/payment-channels"
            const res = await fetch(url, {
                method: isEdit ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })
            if (!res.ok) {
                const err = await res.json()
                toast.error(err.error || "操作失败")
                return
            }
            toast.success(isEdit ? "已更新渠道" : "已添加渠道")
            onOpenChange(false)
            router.refresh()
        } catch {
            toast.error("操作失败")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "编辑渠道" : "添加渠道"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="nickname"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>备注名</FormLabel>
                                        <FormControl><Input placeholder="张三支付宝" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>支付类型</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="alipay">支付宝</SelectItem>
                                                <SelectItem value="wxpay">微信支付</SelectItem>
                                                <SelectItem value="qqpay">QQ支付</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="pid"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>商户号 (pid)</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="key"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>密钥 (key)</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="submitUrl"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>接口地址</FormLabel>
                                    <FormControl><Input placeholder="https://z-pay.cn/submit.php" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="siteName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>站点名称</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="annualLimit"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>年限额 (元)</FormLabel>
                                        <FormControl><Input type="number" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="sortOrder"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>排序（越小越优先）</FormLabel>
                                        <FormControl><Input type="number" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="isActive"
                            render={({ field }) => (
                                <FormItem className="flex items-center gap-3">
                                    <FormControl>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                    <FormLabel className="!mt-0">参与轮转</FormLabel>
                                </FormItem>
                            )}
                        />
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? "保存中..." : "保存"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
```

- [ ] **Step 3: Create withdrawal dialog**

Create `app/admin/(main)/payment-channels/channel-withdrawal-dialog.tsx`:

```typescript
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    channelId: string
    channelNickname: string
}

export function ChannelWithdrawalDialog({ open, onOpenChange, channelId, channelNickname }: Props) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [amount, setAmount] = useState("")
    const [note, setNote] = useState("")

    const handleSubmit = async () => {
        const amountNum = parseFloat(amount)
        if (Number.isNaN(amountNum) || amountNum <= 0) {
            toast.error("请填写有效金额")
            return
        }
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/payment-channels/${channelId}/withdrawals`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount: amountNum, note: note || undefined }),
            })
            if (!res.ok) {
                const err = await res.json()
                toast.error(err.error || "操作失败")
                return
            }
            toast.success("提现记录已保存")
            setAmount("")
            setNote("")
            onOpenChange(false)
            router.refresh()
        } catch {
            toast.error("操作失败")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>记录提现</DialogTitle>
                    <DialogDescription>{channelNickname}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>提现金额 (元)</Label>
                        <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>备注（可选）</Label>
                        <Input
                            placeholder="如：提到招商银行 xxx"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading ? "保存中..." : "确认"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
```

- [ ] **Step 4: Create data table**

Create `app/admin/(main)/payment-channels/payment-channels-data-table.tsx`:

```typescript
"use client"

import { useState } from "react"
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
} from "@tanstack/react-table"
import { Plus, Pencil, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { paymentChannelsColumns, type ChannelRow } from "./payment-channels-columns"
import { ChannelFormDialog } from "./channel-form-dialog"
import { ChannelWithdrawalDialog } from "./channel-withdrawal-dialog"

export function PaymentChannelsDataTable({ data }: { data: ChannelRow[] }) {
    const [formDialog, setFormDialog] = useState<{ open: boolean; channel?: ChannelRow | null }>({
        open: false,
        channel: null,
    })
    const [withdrawalDialog, setWithdrawalDialog] = useState<{
        open: boolean
        channelId: string
        channelNickname: string
    } | null>(null)

    const table = useReactTable({
        data,
        columns: paymentChannelsColumns,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => row.id,
    })

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button size="sm" onClick={() => setFormDialog({ open: true, channel: null })}>
                    <Plus className="size-4" />
                    添加渠道
                </Button>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((hg) => (
                            <TableRow key={hg.id}>
                                {hg.headers.map((header) => (
                                    <TableHead key={header.id}>
                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                                <TableHead>操作</TableHead>
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={paymentChannelsColumns.length + 1} className="text-center text-muted-foreground py-8">
                                    暂无收款渠道，点击右上角添加
                                </TableCell>
                            </TableRow>
                        ) : (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="size-8"
                                                onClick={() => setFormDialog({ open: true, channel: row.original })}
                                            >
                                                <Pencil className="size-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="size-8"
                                                onClick={() => setWithdrawalDialog({
                                                    open: true,
                                                    channelId: row.original.id,
                                                    channelNickname: row.original.nickname,
                                                })}
                                            >
                                                <Wallet className="size-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <ChannelFormDialog
                open={formDialog.open}
                onOpenChange={(open) => setFormDialog((s) => ({ ...s, open }))}
                channel={formDialog.channel}
            />

            {withdrawalDialog && (
                <ChannelWithdrawalDialog
                    open={withdrawalDialog.open}
                    onOpenChange={(open) => {
                        if (!open) setWithdrawalDialog(null)
                    }}
                    channelId={withdrawalDialog.channelId}
                    channelNickname={withdrawalDialog.channelNickname}
                />
            )}
        </div>
    )
}
```

- [ ] **Step 5: Create server page**

Create `app/admin/(main)/payment-channels/page.tsx`:

```typescript
import { prisma } from "@/lib/prisma"
import { formatCurrency } from "@/lib/utils"
import { Wallet, TrendingUp, ArrowDownToLine } from "lucide-react"
import { PaymentChannelsDataTable } from "./payment-channels-data-table"
import type { ChannelRow } from "./payment-channels-columns"
import { PageHeader, StatCard } from "@/app/admin/components"

export const dynamic = "force-dynamic"

function getYearBounds() {
    const year = new Date().getFullYear()
    return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) }
}

export default async function AdminPaymentChannelsPage() {
    const channels = await prisma.paymentChannel.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    })

    const channelIds = channels.map((c) => c.id)
    const { start, end } = getYearBounds()

    const [yearIncomeRows, totalIncomeRows, withdrawalRows] =
        channelIds.length > 0
            ? await Promise.all([
                  prisma.order.groupBy({
                      by: ["paymentChannelId"],
                      where: { paymentChannelId: { in: channelIds }, status: "COMPLETED", paidAt: { gte: start, lt: end } },
                      _sum: { amount: true },
                  }),
                  prisma.order.groupBy({
                      by: ["paymentChannelId"],
                      where: { paymentChannelId: { in: channelIds }, status: "COMPLETED" },
                      _sum: { amount: true },
                  }),
                  prisma.channelWithdrawal.groupBy({
                      by: ["channelId"],
                      where: { channelId: { in: channelIds } },
                      _sum: { amount: true },
                  }),
              ])
            : [[], [], []]

    const yearMap = new Map(yearIncomeRows.map((r) => [r.paymentChannelId, Number(r._sum.amount ?? 0)]))
    const totalMap = new Map(totalIncomeRows.map((r) => [r.paymentChannelId, Number(r._sum.amount ?? 0)]))
    const withdrawnMap = new Map(withdrawalRows.map((r) => [r.channelId, Number(r._sum.amount ?? 0)]))

    const data: ChannelRow[] = channels.map((c) => {
        const yearIncome = yearMap.get(c.id) ?? 0
        const totalIncome = totalMap.get(c.id) ?? 0
        const totalWithdrawn = withdrawnMap.get(c.id) ?? 0
        return {
            id: c.id,
            nickname: c.nickname,
            pid: c.pid,
            key: c.key,
            submitUrl: c.submitUrl,
            siteName: c.siteName,
            type: c.type,
            annualLimit: Number(c.annualLimit),
            sortOrder: c.sortOrder,
            isActive: c.isActive,
            createdAt: c.createdAt.toISOString(),
            yearIncome,
            totalIncome,
            totalWithdrawn,
            balance: totalIncome - totalWithdrawn,
        }
    })

    const totalYearIncome = data.reduce((s, c) => s + c.yearIncome, 0)
    const totalBalance = data.reduce((s, c) => s + c.balance, 0)
    const totalWithdrawn = data.reduce((s, c) => s + c.totalWithdrawn, 0)

    return (
        <div className="space-y-6">
            <PageHeader
                title="收款渠道"
                description="管理易支付收款渠道，记录提现，追踪年度进度与余额"
            />

            <div className="grid gap-4 grid-cols-3">
                <StatCard label="今年总收入" value={formatCurrency(totalYearIncome)} icon={TrendingUp} borderColor="border-l-primary" iconColor="text-primary" />
                <StatCard label="累计已提现" value={formatCurrency(totalWithdrawn)} icon={ArrowDownToLine} borderColor="border-l-muted-foreground" iconColor="text-muted-foreground" />
                <StatCard label="总余额" value={formatCurrency(totalBalance)} icon={Wallet} borderColor="border-l-success" iconColor="text-success" />
            </div>

            <PaymentChannelsDataTable data={data} />
        </div>
    )
}
```

- [ ] **Step 6: Create loading skeleton**

Create `app/admin/(main)/payment-channels/loading.tsx`:

```typescript
import { Skeleton } from "@/components/ui/skeleton"

export default function LoadingPaymentChannels() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-16 w-64" />
            <div className="grid gap-4 grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-24" />
                ))}
            </div>
            <Skeleton className="h-64" />
        </div>
    )
}
```

- [ ] **Step 7: Build check**

```bash
npm run build 2>&1 | tail -30
```

Expected: no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add app/admin/(main)/payment-channels/
git commit -m "feat(admin): add payment channels management page"
```

---

## Task 9: Sidebar nav entry

**Files:**
- Modify: `app/components/admin-sidebar.tsx`

- [ ] **Step 1: Add import and nav item**

Add `Landmark` to the lucide-react import line:
```typescript
import {
    // ... existing icons ...
    Landmark,
} from "lucide-react"
```

Add to `navItems` array, after the `"提现管理"` entry:

```typescript
{
    title: "收款渠道",
    href: "/admin/payment-channels",
    icon: Landmark,
},
```

- [ ] **Step 2: Run all tests**

```bash
npm test -- --no-coverage
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add app/components/admin-sidebar.tsx
git commit -m "feat(admin): add 收款渠道 nav item to sidebar"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| PaymentChannel model | Task 1 |
| ChannelWithdrawal model | Task 1 |
| Order.paymentChannelId | Task 1 |
| selectPaymentChannel(type) — type-scoped rotation | Task 2 |
| Annual limit threshold selection | Task 2 |
| Graceful degradation when all over limit | Task 2 |
| Env var fallback when no DB channels | Task 2 + Task 5 |
| getYipayPagePayUrl accepts channel config | Task 3 |
| verifyYipayNotifySign accepts key param | Task 3 |
| Notify callback: order → channel → key | Task 4 |
| Order creation writes paymentChannelId | Task 5 |
| AUTO_FETCH paid orders also get channel | Task 5 |
| Admin API: CRUD + withdrawal | Task 6 + Task 7 |
| Admin UI: year income progress + balance | Task 8 |
| Admin UI: add/edit/disable channels | Task 8 |
| Admin UI: record withdrawal dialog | Task 8 |
| Sidebar nav | Task 9 |

All spec requirements are covered.
