# 单收款账户 + 资金管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把多 z-pay 渠道轮转简化为单一收款账户：凭据走 env，新增 `/admin/finance` 资金管理页（收入/提现/余额 + 提现流水），删除多渠道全部基础设施。

**Architecture:** 分层推进保证每个 commit 都可构建可测：先把运行时支付代码去渠道化（凭据一律 env），再删旧 admin 渠道功能，再做 schema 迁移（`ChannelWithdrawal`→`Payout`、drop `PaymentChannel`/`Order.paymentChannelId`），最后建新资金管理页与 `Payout` API。

**Tech Stack:** Next.js 16 App Router, Prisma 6 (PostgreSQL), Zod, shadcn/ui + TanStack Table, Jest。

**Spec:** `docs/superpowers/specs/2026-06-16-single-payment-account-design.md`

---

## File Structure

**删除**
- `lib/payment-channel.ts`（轮转）
- `lib/domains/payment-channels.ts`（渠道余额）
- `lib/validations/payment-channel.ts`（渠道 schema；提现 schema 迁到 payout）
- `app/admin/(main)/payment-channels/`（整目录）
- `app/api/admin/payment-channels/`（整目录）

**新增**
- `lib/domains/finance.ts` — `getFinanceSummary()`
- `lib/validations/payout.ts` — payout schema
- `app/api/admin/payouts/route.ts` + `app/api/admin/payouts/[id]/route.ts`
- `app/admin/(main)/finance/` — page + payout 四件套 + loading
- `prisma/migrations/<ts>_single_payment_account/migration.sql`

**修改**
- `lib/zpay.ts`、`lib/get-payment-url.ts`、`lib/zpay-notify-complete.ts`
- `app/api/orders/route.ts`、`app/api/orders/check-payment/route.ts`、`app/api/orders/[orderId]/payment-status/route.ts`
- `app/api/admin/orders/[orderId]/refund/route.ts`、`app/orders/pay-return/page.tsx`
- `prisma/schema.prisma`、`app/components/admin-sidebar.tsx`

---

## Task 1: 提交已完成的 yipay→zpay 重命名

把现有工作区里的重命名改动作为一个独立 commit 落地，与本重设计分离。

**Files:** 工作区现有改动（重命名 + env + 文档）。

- [ ] **Step 1: 确认改动范围**

Run: `git status -s`
Expected: 一批 `M`/`RM` 文件（zpay 重命名、env、docs），无本计划尚未开始的新文件。

- [ ] **Step 2: 暂存除新 spec/plan 外的重命名改动**

```bash
git add -A
git reset docs/superpowers/specs/2026-06-16-single-payment-account-design.md docs/superpowers/plans/2026-06-16-single-payment-account.md
```

- [ ] **Step 3: 提交**

```bash
git commit -m "refactor(payment): rename yipay to zpay across code, env, docs"
```

预期：pre-commit 钩子跑 `npm run build` 通过（Prisma 已锁回 6.19.2）。

- [ ] **Step 4: 单独提交 spec + plan**

```bash
git add docs/superpowers/specs/2026-06-16-single-payment-account-design.md docs/superpowers/plans/2026-06-16-single-payment-account.md
git commit -m "docs(payment): add single-payment-account redesign spec and plan"
```

---

## Task 2: 运行时支付代码去渠道化（凭据一律 env）

去掉所有运行时（非 admin-渠道）代码里的 `channel` 入参，凭据全部取 `config.zpay*`。admin 渠道功能此刻仍直接用 `prisma.paymentChannel`，不受影响，构建保持绿。

**Files:**
- Modify: `lib/zpay.ts`
- Modify: `lib/get-payment-url.ts`
- Modify: `app/api/orders/route.ts`
- Modify: `app/api/admin/orders/[orderId]/refund/route.ts`
- Modify: `lib/zpay-notify-complete.ts`
- Modify: `app/api/orders/check-payment/route.ts`
- Modify: `app/api/orders/[orderId]/payment-status/route.ts`
- Modify: `app/orders/pay-return/page.tsx`
- Delete: `lib/payment-channel.ts`
- Test: `__tests__/lib/zpay.test.ts`, `__tests__/lib/get-payment-url.test.ts`, `__tests__/lib/zpay-notify-complete.test.ts`, `__tests__/api/orders-check-payment.test.ts`, `__tests__/app/api/admin/orders/refund*.test.ts`, `__tests__/api/orders-create-post.test.ts`

- [ ] **Step 1: `lib/zpay.ts` — 去 channel 入参**

删除 `ZpayChannelConfig` 类型导出。四个函数改为只用 env：

```typescript
export function getZpayPagePayUrl(params: {
    orderNo: string
    totalAmount: string
    subject: string
    type?: string
}): string | null {
    const pid = config.zpayPid
    const key = config.zpayKey
    const submitUrl = config.zpaySubmitUrl
    const siteName = config.zpaySiteName

    if (!pid || !key || !submitUrl || !siteName) return null

    const base = config.siteUrl
    const requestParams: Record<string, string> = {
        pid,
        money: params.totalAmount,
        name: params.subject,
        notify_url: `${base}/api/payment/zpay/notify`,
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

export async function queryZpayOrder(orderNo: string): Promise<{ paid: boolean } | null> {
    const pid = config.zpayPid
    const key = config.zpayKey
    const submitUrl = config.zpaySubmitUrl
    if (!pid || !key || !submitUrl) return null
    try {
        const base = new URL(submitUrl)
        base.pathname = "/api.php"
        base.search = ""
        const url = `${base.toString()}?act=order&pid=${encodeURIComponent(pid)}&key=${encodeURIComponent(key)}&out_trade_no=${encodeURIComponent(orderNo)}`
        const res = await fetch(url, { cache: "no-store" })
        if (!res.ok) {
            console.warn("[zpay-query] orderNo=%s http_status=%d", orderNo, res.status)
            return null
        }
        const data = (await res.json()) as Record<string, unknown>
        if (data.code !== 1 && data.code !== "1") return null
        const tradeStatus = data.trade_status as string | undefined
        const numericStatus = data.status
        const paid =
            tradeStatus === "TRADE_SUCCESS" ||
            tradeStatus === "TRADE_FINISHED" ||
            tradeStatus === "success" ||
            numericStatus === 1 ||
            numericStatus === "1"
        return { paid }
    } catch (e) {
        console.error("[zpay-query] orderNo=%s error=%s", orderNo, e instanceof Error ? e.message : String(e))
        return null
    }
}

export async function refundZpayOrder(
    orderNo: string,
    money: string,
): Promise<{ ok: boolean; message?: string } | null> {
    const pid = config.zpayPid
    const key = config.zpayKey
    const submitUrl = config.zpaySubmitUrl
    if (!pid || !key || !submitUrl) return null
    try {
        const base = new URL(submitUrl)
        base.pathname = "/api.php"
        base.search = ""
        const url = `${base.toString()}?act=refund`
        const form = new URLSearchParams({ pid, key, money, out_trade_no: orderNo })
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: form.toString(),
            cache: "no-store",
        })
        if (!res.ok) {
            console.warn("[zpay-refund] orderNo=%s http_status=%d", orderNo, res.status)
            return null
        }
        const data = (await res.json()) as Record<string, unknown>
        const ok = data.code === 1 || data.code === "1"
        const message = typeof data.msg === "string" ? data.msg : undefined
        return { ok, message }
    } catch (e) {
        console.error("[zpay-refund] orderNo=%s error=%s", orderNo, e instanceof Error ? e.message : String(e))
        return null
    }
}

export function verifyZpayNotifySign(postData: Record<string, unknown>): boolean {
    const signingKey = config.zpayKey
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

`getVerifyParams`、`md5`、`buildSubmitUrl`、`isZpayConfigured` 保持不变。

- [ ] **Step 2: `lib/get-payment-url.ts` — 去 channel**

```typescript
import { getAlipayPagePayUrl, getAlipayWapPayUrl } from "@/lib/alipay"
import { isZpayConfigured, getZpayPagePayUrl } from "@/lib/zpay"
import { config } from "@/lib/config"

export type ClientType = "pc" | "wap"

export interface GetPaymentUrlParams {
    orderNo: string
    totalAmount: string
    subject: string
    clientType?: ClientType
    /** 支付渠道: "alipay" | "wxpay" | "qqpay" */
    paymentMethod?: string
}

/**
 * 根据订单信息生成支付跳转 URL（z-pay 或支付宝 PC/Wap）。
 * 未配置支付或生成失败时返回 null。
 */
export function getPaymentUrlForOrder(params: GetPaymentUrlParams): string | null {
    const { orderNo, totalAmount, clientType = "pc", paymentMethod = "alipay" } = params
    // Always use the compliance label as the payment subject, never expose product names
    const subject = config.paymentSubjectLabel
    return isZpayConfigured()
        ? getZpayPagePayUrl({ orderNo, totalAmount, subject, type: paymentMethod })
        : clientType === "wap"
          ? getAlipayWapPayUrl({ orderNo, totalAmount, subject })
          : getAlipayPagePayUrl({ orderNo, totalAmount, subject })
}
```

- [ ] **Step 3: `app/api/orders/route.ts` — 删轮转 + paymentChannelId**

删除 `import { selectPaymentChannel } from "@/lib/payment-channel"`。三处下单逻辑（约 202/705/804 行附近）：
- 删 `const channel = await selectPaymentChannel(paymentMethod)`
- 删订单 `data` 里的 `...(channel && { paymentChannelId: channel.id }),`
- `getPaymentUrlForOrder({...})` 调用删去 `channel,` 实参（保留 `orderNo/totalAmount/clientType?/paymentMethod`）。

- [ ] **Step 4: `app/api/admin/orders/[orderId]/refund/route.ts` — 退款用 env**

- order 查询的 `include` 删去 `paymentChannel: {...}`。
- 资格判定改为：

```typescript
    // Eligibility: only orders paid through z-pay can be refunded online.
    if (!isZpayConfigured()) {
        return conflict("该订单支付渠道不支持在线退款")
    }

    const money = order.amount.toFixed(2)
    const result = await refundZpayOrder(order.orderNo, money)
```

- [ ] **Step 5: `lib/zpay-notify-complete.ts` — env key 验签**

- `order` 查询 `include` 删 `paymentChannel: { select: { key: true } }`。
- 删 `const channelKey = ...`，验签改为 `if (!verifyZpayNotifySign(postData)) { return { ok: false } }`。
- 删文档注释里关于 channel key 的两句。

- [ ] **Step 6: `check-payment` 与 `payment-status` — 去 channel 查询**

`app/api/orders/check-payment/route.ts`：删 `const ch = order.paymentChannel` + `const channel = ...` 块，调用改 `const zpayResult = await queryZpayOrder(orderNo.trim()).catch(() => null)`；order 查询里删 paymentChannel include（若有）。

`app/api/orders/[orderId]/payment-status/route.ts`：删 `orderWithChannel` 查询，调用改 `const zpayResult = await queryZpayOrder(orderNo).catch(() => null)`。

- [ ] **Step 7: `app/orders/pay-return/page.tsx` — env 验签**

第 61-62 行改为 `signValid = verifyZpayNotifySign(postData)`；order 查询里删 paymentChannel include（若有）。

- [ ] **Step 8: 删除 `lib/payment-channel.ts`**

```bash
git rm lib/payment-channel.ts
```

- [ ] **Step 9: 更新测试**

把以上文件相关测试里所有给 zpay/get-payment-url 传 `channel` 的用例改为无 channel；删 channel-override / 轮转专用用例。grep 定位：

Run: `grep -rnE "channel|ZpayChannelConfig|selectPaymentChannel" __tests__/lib/zpay.test.ts __tests__/lib/get-payment-url.test.ts __tests__/lib/zpay-notify-complete.test.ts __tests__/api/orders-check-payment.test.ts __tests__/api/orders-create-post.test.ts __tests__/app/api/admin/orders/refund.test.ts __tests__/app/api/admin/orders/refund-milestone-integration.test.ts`

逐处删除 channel 入参 / mock。被删函数签名相关的断言改为 env 配置驱动（用例里 set `config.zpayKey` 等，参考现有 `__tests__/lib/zpay.test.ts` 中 `config.zpayPid` 的覆写模式）。

- [ ] **Step 10: 跑测试 + 构建**

Run: `npx jest __tests__/lib __tests__/api __tests__/app/api/admin/orders --no-coverage`
Expected: PASS

Run: `npm run build`
Expected: 退出码 0，`✓ Compiled successfully`

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "refactor(payment): drop per-channel credentials, use env for all z-pay calls"
```

---

## Task 3: 删除旧 admin 收款渠道功能

此刻仅 admin 渠道功能 + schema 引用 `PaymentChannel`/`ChannelWithdrawal`。删掉这些 UI/API/lib，构建仍绿。

**Files:**
- Delete: `app/admin/(main)/payment-channels/`（整目录）
- Delete: `app/api/admin/payment-channels/`（整目录）
- Delete: `lib/domains/payment-channels.ts`
- Delete: `lib/validations/payment-channel.ts`
- Modify: `app/components/admin-sidebar.tsx`（暂时移除「收款渠道」入口，Task 7 重新加「资金管理」）
- Delete: 相关测试

- [ ] **Step 1: 删除目录与文件**

```bash
git rm -r "app/admin/(main)/payment-channels"
git rm -r app/api/admin/payment-channels
git rm lib/domains/payment-channels.ts lib/validations/payment-channel.ts
```

- [ ] **Step 2: 移除侧边栏「收款渠道」入口**

`app/components/admin-sidebar.tsx` 第 80 行 `{ title: "收款渠道", href: "/admin/payment-channels", icon: Landmark },` 整行删除（`Landmark` import 若不再使用一并删）。

- [ ] **Step 3: 删除残留测试**

Run: `grep -rlnE "payment-channels|PaymentChannel|ChannelWithdrawal|selectPaymentChannel|getChannelBalance" __tests__`
对命中的渠道专用测试文件执行 `git rm`；混合文件里删掉相关用例。

- [ ] **Step 4: 确认无残留引用**

Run: `grep -rnE "payment-channel|PaymentChannel|ChannelWithdrawal|selectPaymentChannel|getChannelBalance" --include="*.ts" --include="*.tsx" app lib | grep -v node_modules`
Expected: 空（仅 schema.prisma 仍有，下一任务处理）。

- [ ] **Step 5: 构建 + 测试**

Run: `npm run build`
Expected: 退出码 0。

Run: `npx jest --no-coverage`
Expected: PASS（全量）。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(payment): remove multi-channel admin UI and API"
```

---

## Task 4: Schema 迁移 — ChannelWithdrawal→Payout，drop PaymentChannel

REQUIRED SUB-SKILL: 调 `migrate-safe`。环境 `migrate dev` 不可用，手写 migration + `migrate deploy`。绝不编辑已应用迁移文件。

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_single_payment_account/migration.sql`

- [ ] **Step 1: 改 `prisma/schema.prisma`**

删除 `model PaymentChannel { ... }` 整块。删 `model ChannelWithdrawal { ... }`，新增：

```prisma
model Payout {
  id        String   @id @default(cuid())
  amount    Decimal  @db.Decimal(10, 2)
  note      String?  @db.Text
  createdAt DateTime @default(now())

  @@index([createdAt])
}
```

`model Order` 删除三行：`paymentChannelId String?`（312）、`paymentChannel PaymentChannel? @relation(...)`（322）、`@@index([paymentChannelId])`（339）。

- [ ] **Step 2: 手写 migration SQL**

新建 `prisma/migrations/20260616000000_single_payment_account/migration.sql`（时间戳用当前，须晚于最新已应用迁移）：

```sql
-- ChannelWithdrawal -> Payout: 去 channelId 外键/索引/列，重命名
ALTER TABLE "ChannelWithdrawal" DROP CONSTRAINT "ChannelWithdrawal_channelId_fkey";
DROP INDEX "ChannelWithdrawal_channelId_idx";
ALTER TABLE "ChannelWithdrawal" DROP COLUMN "channelId";
ALTER TABLE "ChannelWithdrawal" RENAME TO "Payout";
ALTER TABLE "Payout" RENAME CONSTRAINT "ChannelWithdrawal_pkey" TO "Payout_pkey";
CREATE INDEX "Payout_createdAt_idx" ON "Payout"("createdAt");

-- Order: 去 paymentChannelId
ALTER TABLE "Order" DROP CONSTRAINT "Order_paymentChannelId_fkey";
DROP INDEX "Order_paymentChannelId_idx";
ALTER TABLE "Order" DROP COLUMN "paymentChannelId";

-- drop PaymentChannel
DROP TABLE "PaymentChannel";
```

现有 `ChannelWithdrawal` 行（amount/note/createdAt）原地保留为 `Payout`，零丢失。

- [ ] **Step 3: 应用迁移到本地 DB + 生成 client**

Run: `npx prisma migrate deploy`
Expected: `Applying migration 20260616000000_single_payment_account` 成功。

Run: `npx prisma generate`
Expected: 成功，`prisma.payout` 可用。

（若本地 DB 已有 drift 导致 deploy 失败，按 migrate-safe 处理；不要手动跑 SQL 再 deploy。）

- [ ] **Step 4: 构建**

Run: `npm run build`
Expected: 退出码 0（无代码引用被删模型）。

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260616000000_single_payment_account/migration.sql
git commit -m "feat(payment): migrate ChannelWithdrawal to Payout, drop PaymentChannel"
```

---

## Task 5: 资金汇总域 + payout 校验 + payout API

**Files:**
- Create: `lib/domains/finance.ts`
- Create: `lib/validations/payout.ts`
- Create: `app/api/admin/payouts/route.ts`
- Create: `app/api/admin/payouts/[id]/route.ts`
- Test: `__tests__/lib/domains/finance.test.ts`, `__tests__/app/api/admin/payouts.test.ts`

- [ ] **Step 1: 写失败测试 `__tests__/lib/domains/finance.test.ts`**

```typescript
import { getFinanceSummary } from "@/lib/domains/finance"
import { prisma } from "@/lib/prisma"

jest.mock("@/lib/prisma", () => ({
    prisma: {
        order: { aggregate: jest.fn() },
        payout: { aggregate: jest.fn() },
    },
}))

const orderAgg = prisma.order.aggregate as jest.Mock
const payoutAgg = prisma.payout.aggregate as jest.Mock

describe("getFinanceSummary", () => {
    it("balance = total completed income - total payouts (in cents)", async () => {
        orderAgg.mockResolvedValue({ _sum: { amount: 100.5 } })
        payoutAgg.mockResolvedValue({ _sum: { amount: 30.25 } })
        const s = await getFinanceSummary()
        expect(s.totalIncomeCents).toBe(10050)
        expect(s.totalWithdrawnCents).toBe(3025)
        expect(s.balanceCents).toBe(7025)
    })

    it("treats null sums as zero", async () => {
        orderAgg.mockResolvedValue({ _sum: { amount: null } })
        payoutAgg.mockResolvedValue({ _sum: { amount: null } })
        const s = await getFinanceSummary()
        expect(s).toEqual({ totalIncomeCents: 0, totalWithdrawnCents: 0, balanceCents: 0 })
    })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx jest __tests__/lib/domains/finance.test.ts --no-coverage`
Expected: FAIL（`getFinanceSummary` 未定义）。

- [ ] **Step 3: 实现 `lib/domains/finance.ts`**

```typescript
import { prisma } from "@/lib/prisma"
import { toCents } from "@/lib/utils"

export type FinanceSummary = {
    totalIncomeCents: number
    totalWithdrawnCents: number
    balanceCents: number
}

/** 平台收款账户资金汇总：全部已完成订单收入 − 全部提现 = 余额（整数分）。 */
export async function getFinanceSummary(): Promise<FinanceSummary> {
    const [incomeAgg, withdrawnAgg] = await Promise.all([
        prisma.order.aggregate({ where: { status: "COMPLETED" }, _sum: { amount: true } }),
        prisma.payout.aggregate({ _sum: { amount: true } }),
    ])
    const totalIncomeCents = toCents(Number(incomeAgg._sum.amount ?? 0))
    const totalWithdrawnCents = toCents(Number(withdrawnAgg._sum.amount ?? 0))
    return {
        totalIncomeCents,
        totalWithdrawnCents,
        balanceCents: totalIncomeCents - totalWithdrawnCents,
    }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx jest __tests__/lib/domains/finance.test.ts --no-coverage`
Expected: PASS。

- [ ] **Step 5: `lib/validations/payout.ts`**

```typescript
import { z } from "zod"

export const createPayoutSchema = z.object({
    amount: z.coerce.number().positive("金额必须大于 0"),
    note: z.string().max(500).optional(),
})

export const updatePayoutSchema = createPayoutSchema.partial()

export type CreatePayoutInput = z.infer<typeof createPayoutSchema>
export type UpdatePayoutInput = z.infer<typeof updatePayoutSchema>
```

- [ ] **Step 6: `app/api/admin/payouts/route.ts`（POST 新建）**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError, badRequest } from "@/lib/api-response"
import { createPayoutSchema } from "@/lib/validations/payout"
import { toCents, formatCurrency } from "@/lib/utils"
import { getFinanceSummary } from "@/lib/domains/finance"

export async function POST(request: NextRequest) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = createPayoutSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { balanceCents } = await getFinanceSummary()
    if (toCents(parsed.data.amount) > balanceCents) {
        return badRequest(`余额不足（当前余额 ${formatCurrency(balanceCents / 100)}）`)
    }

    const payout = await prisma.payout.create({
        data: { amount: parsed.data.amount, note: parsed.data.note },
    })
    return NextResponse.json({ data: payout }, { status: 201 })
}
```

- [ ] **Step 7: `app/api/admin/payouts/[id]/route.ts`（PATCH/DELETE）**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, notFound, invalidJsonBody, validationError, badRequest } from "@/lib/api-response"
import { updatePayoutSchema } from "@/lib/validations/payout"
import { toCents } from "@/lib/utils"
import { getFinanceSummary } from "@/lib/domains/finance"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id } = await context.params
    const payout = await prisma.payout.findUnique({ where: { id } })
    if (!payout) return notFound("提现记录不存在")

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = updatePayoutSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    if (parsed.data.amount !== undefined) {
        const { balanceCents } = await getFinanceSummary()
        const oldAmountCents = toCents(Number(payout.amount))
        const newAmountCents = toCents(parsed.data.amount)
        // balance 已扣旧额；改额后新余额 = 当前余额 + 旧额 − 新额
        if (balanceCents + oldAmountCents - newAmountCents < 0) {
            return badRequest("余额不足（更新后余额将为负）")
        }
    }

    const updated = await prisma.payout.update({ where: { id }, data: parsed.data })
    return NextResponse.json({ data: updated })
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id } = await context.params
    const payout = await prisma.payout.findUnique({ where: { id } })
    if (!payout) return notFound("提现记录不存在")

    await prisma.payout.delete({ where: { id } })
    return NextResponse.json({ data: { id } })
}
```

- [ ] **Step 8: 写 payout API 测试 `__tests__/app/api/admin/payouts.test.ts`**

参考被删的 `__tests__`（如有）渠道提现测试结构与现有 admin API 测试的 `getAdminSession` mock 模式。覆盖：未登录 401；金额超余额 400；正常创建 201；删除 200；改额超余额 400。mock `@/lib/prisma`、`@/lib/auth-guard`、`@/lib/domains/finance`。

```typescript
import { POST } from "@/app/api/admin/payouts/route"
import { getAdminSession } from "@/lib/auth-guard"
import { getFinanceSummary } from "@/lib/domains/finance"
import { prisma } from "@/lib/prisma"

jest.mock("@/lib/auth-guard", () => ({ getAdminSession: jest.fn() }))
jest.mock("@/lib/domains/finance", () => ({ getFinanceSummary: jest.fn() }))
jest.mock("@/lib/prisma", () => ({ prisma: { payout: { create: jest.fn() } } }))

const sess = getAdminSession as jest.Mock
const summary = getFinanceSummary as jest.Mock
const create = prisma.payout.create as jest.Mock

function req(body: unknown) {
    return new Request("http://t/api/admin/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    }) as unknown as import("next/server").NextRequest
}

describe("POST /api/admin/payouts", () => {
    beforeEach(() => jest.clearAllMocks())

    it("401 when not admin", async () => {
        sess.mockResolvedValue(null)
        const res = await POST(req({ amount: 10 }))
        expect(res.status).toBe(401)
    })

    it("400 when amount exceeds balance", async () => {
        sess.mockResolvedValue({ user: { id: "a" } })
        summary.mockResolvedValue({ balanceCents: 500 })
        const res = await POST(req({ amount: 10 }))
        expect(res.status).toBe(400)
    })

    it("201 on success", async () => {
        sess.mockResolvedValue({ user: { id: "a" } })
        summary.mockResolvedValue({ balanceCents: 5000 })
        create.mockResolvedValue({ id: "p1", amount: 10, note: null })
        const res = await POST(req({ amount: 10, note: "招行" }))
        expect(res.status).toBe(201)
        expect(create).toHaveBeenCalledWith({ data: { amount: 10, note: "招行" } })
    })
})
```

- [ ] **Step 9: 跑测试**

Run: `npx jest __tests__/lib/domains/finance.test.ts __tests__/app/api/admin/payouts.test.ts --no-coverage`
Expected: PASS。

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(payment): add finance summary domain and payout API"
```

---

## Task 6: 资金管理页 + payout 四件套 + 侧边栏

**Files:**
- Create: `app/admin/(main)/finance/page.tsx`
- Create: `app/admin/(main)/finance/payout-columns.tsx`
- Create: `app/admin/(main)/finance/payout-data-table.tsx`
- Create: `app/admin/(main)/finance/payout-row-actions.tsx`
- Create: `app/admin/(main)/finance/payout-form-dialog.tsx`
- Create: `app/admin/(main)/finance/loading.tsx`
- Modify: `app/components/admin-sidebar.tsx`

- [ ] **Step 1: `payout-columns.tsx`**

```tsx
"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { formatCurrency, formatDateTime } from "@/lib/utils"
import { DataTableColumnHeader } from "@/app/admin/components"
import { PayoutRowActions } from "./payout-row-actions"

export type PayoutRow = {
    id: string
    amount: number
    note: string
    createdAt: string
}

export const payoutColumns: ColumnDef<PayoutRow>[] = [
    {
        accessorKey: "amount",
        header: ({ column }) => <DataTableColumnHeader column={column} title="金额" className="justify-end" />,
        cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.amount)}</span>,
    },
    {
        accessorKey: "note",
        header: "备注",
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.note || "—"}</span>,
    },
    {
        accessorKey: "createdAt",
        header: ({ column }) => <DataTableColumnHeader column={column} title="记录时间" />,
        cell: ({ row }) => <span className="text-sm">{formatDateTime(row.original.createdAt)}</span>,
    },
    {
        id: "actions",
        cell: ({ row }) => <PayoutRowActions row={row.original} />,
    },
]
```

- [ ] **Step 2: `payout-form-dialog.tsx`**

由 `withdrawal-form-dialog.tsx` 改写：去 `channelId` prop，schema 换 `createPayoutSchema`，API URL 改 `/api/admin/payouts`（新建）与 `/api/admin/payouts/{id}`（编辑）。

```tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createPayoutSchema } from "@/lib/validations/payout"
import type { PayoutRow } from "./payout-columns"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    payout?: PayoutRow // present = edit mode
}

export function PayoutFormDialog({ open, onOpenChange, payout }: Props) {
    const router = useRouter()
    const isEdit = !!payout
    const [error, setError] = useState<string | null>(null)

    const form = useForm({
        resolver: zodResolver(createPayoutSchema),
        defaultValues: { amount: 0, note: "" },
    })

    useEffect(() => {
        if (open) {
            form.reset(payout ? { amount: payout.amount, note: payout.note } : { amount: 0, note: "" })
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setError(null)
        }
    }, [open, payout, form])

    const onSubmit = async (values: { amount: number; note?: string }) => {
        setError(null)
        try {
            const url = isEdit ? `/api/admin/payouts/${payout!.id}` : `/api/admin/payouts`
            const res = await fetch(url, {
                method: isEdit ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                setError(data.error ?? "操作失败")
                return
            }
            toast.success(isEdit ? "提现记录已更新" : "提现记录已保存")
            onOpenChange(false)
            router.refresh()
        } catch {
            setError("操作失败")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
                <DialogHeader>
                    <DialogTitle>{isEdit ? "编辑提现记录" : "记录提现"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field: { onChange, value, ...rest } }) => (
                                <FormItem>
                                    <FormLabel>提现金额 (元)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="0.00"
                                            value={value === 0 ? "" : String(value)}
                                            onChange={(e) => onChange(e.target.value)}
                                            {...rest}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="note"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>备注（可选）</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="如：提到招商银行 xxx" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {error && <p className="text-sm text-destructive">{error}</p>}
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? "保存中..." : "确认"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
```

- [ ] **Step 3: `payout-row-actions.tsx`**

由 `withdrawal-row-actions.tsx` 改写：去 `channelId`，DELETE URL 改 `/api/admin/payouts/{id}`，编辑用 `PayoutFormDialog`。

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2, Pencil, Trash2 } from "lucide-react"
import { PayoutFormDialog } from "./payout-form-dialog"
import type { PayoutRow } from "./payout-columns"

export function PayoutRowActions({ row }: { row: PayoutRow }) {
    const router = useRouter()
    const [editOpen, setEditOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const handleDelete = async () => {
        setDeleting(true)
        try {
            const res = await fetch(`/api/admin/payouts/${row.id}`, { method: "DELETE" })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                toast.error(err?.error ?? "删除失败")
                return
            }
            setDeleteOpen(false)
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
                <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditOpen(true)}>
                    <Pencil className="size-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteOpen(true)}
                >
                    <Trash2 className="size-4" />
                </Button>
            </div>

            <PayoutFormDialog open={editOpen} onOpenChange={setEditOpen} payout={row} />

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>删除提现记录</AlertDialogTitle>
                        <AlertDialogDescription>
                            确认删除该提现记录？删除后余额将相应恢复。
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

- [ ] **Step 4: `payout-data-table.tsx`**

由 `withdrawal-data-table.tsx` 改写：去 `channelId` prop，用 `payoutColumns`/`PayoutFormDialog`。

```tsx
"use client"

import { useState } from "react"
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    flexRender,
    type SortingState,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PlusCircle } from "lucide-react"
import { payoutColumns, type PayoutRow } from "./payout-columns"
import { PayoutFormDialog } from "./payout-form-dialog"

export function PayoutDataTable({ initialData }: { initialData: PayoutRow[] }) {
    const [dialogOpen, setDialogOpen] = useState(false)
    const [sorting, setSorting] = useState<SortingState>([])

    const table = useReactTable({
        data: initialData,
        columns: payoutColumns,
        getRowId: (row) => row.id,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        state: { sorting },
        onSortingChange: setSorting,
    })

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">提现记录</h2>
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                    <PlusCircle className="size-4" />
                    记一笔提现
                </Button>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((hg) => (
                            <TableRow key={hg.id}>
                                {hg.headers.map((h) => (
                                    <TableHead key={h.id}>
                                        {flexRender(h.column.columnDef.header, h.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={payoutColumns.length} className="h-24 text-center text-muted-foreground">
                                    暂无提现记录
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
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <PayoutFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
        </div>
    )
}
```

- [ ] **Step 5: `page.tsx`（RSC）**

```tsx
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { formatCurrency } from "@/lib/utils"
import { Wallet, TrendingUp, ArrowDownCircle } from "lucide-react"
import { PageHeader, StatCard } from "@/app/admin/components"
import { getFinanceSummary } from "@/lib/domains/finance"
import { PayoutDataTable } from "./payout-data-table"
import type { PayoutRow } from "./payout-columns"

export const dynamic = "force-dynamic"

export default async function AdminFinancePage() {
    const session = await getAdminSession()
    if (!session) redirect("/admin/login")

    const [summary, payouts] = await Promise.all([
        getFinanceSummary(),
        prisma.payout.findMany({ orderBy: { createdAt: "desc" } }),
    ])

    const rows: PayoutRow[] = payouts.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        note: p.note ?? "",
        createdAt: p.createdAt.toISOString(),
    }))

    return (
        <div className="space-y-6">
            <PageHeader title="资金管理" description="收款账户的累计收入、提现与余额" />

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                <StatCard label="累计收入" value={formatCurrency(summary.totalIncomeCents / 100)} icon={TrendingUp} borderColor="border-l-muted-foreground" iconColor="text-muted-foreground" />
                <StatCard label="已提现" value={formatCurrency(summary.totalWithdrawnCents / 100)} icon={ArrowDownCircle} borderColor="border-l-primary" iconColor="text-primary" />
                <StatCard label="当前余额" value={formatCurrency(summary.balanceCents / 100)} icon={Wallet} borderColor="border-l-success" iconColor="text-success" />
            </div>

            <PayoutDataTable initialData={rows} />
        </div>
    )
}
```

- [ ] **Step 6: `loading.tsx`**

复制 `app/admin/(main)/payment-channels/loading.tsx` 的骨架（已被删，参照其它列表页 `loading.tsx`，如 `app/admin/(main)/distributors/loading.tsx` 的结构）：渲染 PageHeader 占位 + 3 个骨架卡 + 表格骨架。沿用项目现有 `Skeleton` 组件。

- [ ] **Step 7: 侧边栏加「资金管理」**

`app/components/admin-sidebar.tsx` 在原「收款渠道」位置加：

```tsx
    { title: "资金管理", href: "/admin/finance", icon: Wallet },
```

`Wallet` 已在 import（第 15 行）。注意「提现管理」（分销员，第 71 行）也用 `Wallet`——两者并存，图标重复可接受；若想区分，资金管理改用 `Landmark`（若上一任务未删该 import 则复用，否则新加 import）。

- [ ] **Step 8: 构建 + 全量测试**

Run: `npm run build`
Expected: 退出码 0。

Run: `npx jest --no-coverage`
Expected: PASS（全量）。

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(payment): add finance management page with payout ledger"
```

---

## Self-Review 已执行

- **Spec 覆盖**：凭据 env 化（T2）；删多渠道 UI/API（T3）；schema 迁移保留提现记录（T4）；资金汇总+payout API（T5）；资金管理页+侧边栏（T6）。全覆盖。
- **类型一致**：`PayoutRow`（id/amount/note/createdAt）在 columns/form/row-actions/data-table/page 一致；`getFinanceSummary` 返回 `{totalIncomeCents,totalWithdrawnCents,balanceCents}` 在 API 与 page 一致；`createPayoutSchema`/`updatePayoutSchema` 在 API 与 form 一致。
- **占位符**：loading.tsx（T6 S6）指向参照实现而非贴代码——因依赖项目现有骨架组件，执行时照搬同级 `loading.tsx`；其余步骤均含完整代码。
- **边界**：余额口径变化、历史退款前提、在途单见 spec「边界与风险」。
