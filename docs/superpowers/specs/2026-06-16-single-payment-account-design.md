# 单收款账户 + 资金管理 重新设计

**日期：** 2026-06-16
**状态：** 待评审
**取代：** `docs/superpowers/specs/2026-03-17-multi-channel-payment-design.md`（多渠道轮转方案）

## 背景与问题

当前收款渠道功能为**多 z-pay 账号**设计：`PaymentChannel` 存每个账号的凭据（pid/key/submitUrl/siteName）+ 类型（alipay/wxpay/qqpay）+ 年限额，下单时按 `selectPaymentChannel(type)` 在多账号间按 ¥65k 年限额轮转，目的是分散税务。每个渠道单独记提现（`ChannelWithdrawal`）与余额。

实际运营只用**一个 z-pay 账号**。多账号轮转、类型分渠道、年限额、backfill 全是不必要的复杂度。本设计将其简化为：单一收款账户 + 资金管理页（收入/提现/余额）。

## 目标

1. 凭据收敛为单一来源：环境变量 `ZPAY_*`（不再存 DB）。
2. 新增 `/admin/finance`「资金管理」页：累计收入 − 已提现 = 余额 + 提现流水 + 记一笔提现。
3. 提现 = 手动记账（金额 + 备注），与现有 `ChannelWithdrawal` 行为一致。
4. **保留现有提现记录**（跨渠道平移为全局流水，零丢失）。
5. 删除多渠道全部基础设施：表、轮转、类型分渠道、年限额、backfill、渠道 CRUD。

## 非目标

- 不动**分销员提现**（`Withdrawal` 模型、`/admin/withdrawals`）——与本功能无关。
- 不动 z-pay 网关协议（`lib/zpay.ts` 的签名/回调算法不变，只去掉按渠道传凭据的入参）。
- 不动买家支付方式选择器（`NEXT_PUBLIC_ZPAY_PAYMENT_TYPES` 等照旧）。
- 不引入 z-pay 出金 API（手动记账即可）。

## 数据模型

### 删除

- `model PaymentChannel`（整表 drop）。
- `Order.paymentChannelId` 列 + 关系（全局收入统计不再需要按渠道归属）。

### 新增/重命名

`ChannelWithdrawal` → `Payout`，去掉 `channelId`：

```prisma
model Payout {
  id        String   @id @default(cuid())
  amount    Decimal  @db.Decimal(10, 2)
  note      String?  @db.Text
  createdAt DateTime @default(now())

  @@index([createdAt])
}
```

现有 `ChannelWithdrawal` 行（amount/note/createdAt）原样保留——多渠道折叠为单账户后，所有提现求和即全局提现总额，去掉 `channelId` 不丢任何流水。

### 余额定义

- 累计收入 `totalIncome` = `SUM(Order.amount where status = COMPLETED)`（全部已完成订单，不再按渠道）。
- 已提现 `totalWithdrawn` = `SUM(Payout.amount)`。
- 余额 `balance` = `totalIncome − totalWithdrawn`。

比旧的"仅渠道归属订单"口径更完整（旧口径漏掉 env 兜底支付、`paymentChannelId = null` 的订单）。

## 迁移（手写 migration，不动已应用迁移文件）

新建 `prisma/migrations/<timestamp>_single_payment_account/migration.sql`，按 Prisma 6 命名约定手写（环境 `migrate dev` 不可用，走 `migrate deploy`）。精确的约束/索引名以上一份 migration 为准，实现阶段核对：

```sql
-- 1. ChannelWithdrawal: 去 FK/索引/列，重命名为 Payout
ALTER TABLE "ChannelWithdrawal" DROP CONSTRAINT IF EXISTS "ChannelWithdrawal_channelId_fkey";
DROP INDEX IF EXISTS "ChannelWithdrawal_channelId_idx";
ALTER TABLE "ChannelWithdrawal" DROP COLUMN "channelId";
ALTER TABLE "ChannelWithdrawal" RENAME TO "Payout";
CREATE INDEX "Payout_createdAt_idx" ON "Payout"("createdAt");

-- 2. Order: 去 paymentChannelId
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_paymentChannelId_fkey";
ALTER TABLE "Order" DROP COLUMN "paymentChannelId";

-- 3. drop PaymentChannel
DROP TABLE "PaymentChannel";
```

（PK 约束名 `ChannelWithdrawal_pkey` → 是否随表重命名取决于 PG 版本；实现阶段确认是否需 `ALTER TABLE "Payout" RENAME CONSTRAINT`。）

## 业务逻辑改动

### 凭据：env 唯一来源

- `lib/zpay.ts`：`getZpayPagePayUrl` / `queryZpayOrder` / `refundZpayOrder` / `verifyZpayNotifySign` 去掉可选 `channel` 入参，凭据一律 `config.zpay*`。`isZpayConfigured()` 保留。
- `lib/get-payment-url.ts`：`GetPaymentUrlParams` 去掉 `channel`，`getPaymentUrlForOrder` 去掉 channel 分支——`isZpayConfigured()` ? z-pay : Alipay 兜底。
- `lib/zpay-notify-complete.ts`：去掉按渠道取 key 的逻辑，回调验签用 env key。

### 删除

- `lib/payment-channel.ts`（`selectPaymentChannel` 轮转）。
- `lib/validations/payment-channel.ts`（渠道 schema；提现 schema 迁到 `lib/validations/payout.ts`）。

### 改写

- `lib/domains/payment-channels.ts` → `lib/domains/finance.ts`：`getFinanceSummary()` 返回 `{ totalIncome, totalWithdrawn, balance }`（整数分）。
- `app/api/orders/route.ts`：删 `selectPaymentChannel` 调用（3 处）+ 写 `paymentChannelId`（3 处）。
- `app/api/admin/orders/[orderId]/refund/route.ts`：删 channel 加载，退款一律 env 凭据；资格判定改为 `isZpayConfigured()`。
- `app/api/orders/check-payment/route.ts`、`app/api/orders/[orderId]/payment-status/route.ts`：去 channel 入参。
- `app/orders/pay-return/page.tsx`：去 channel 引用。

## Admin UI

新建 `app/admin/(main)/finance/`（DataTable 四件套，客户端过滤——提现流水量小）：

```
finance/
├── page.tsx              # getFinanceSummary + 拉 Payout 列表 → StatCards + 表
├── payout-columns.tsx    # 金额 / 备注 / 时间
├── payout-data-table.tsx # 客户端过滤 + 工具栏
├── payout-row-actions.tsx# 编辑 / 删除（AlertDialog）
├── payout-form-dialog.tsx# 记一笔提现（amount + note）
└── loading.tsx
```

- 三个 StatCard：累计收入 / 已提现 / 当前余额。
- 主操作按钮：「记一笔提现」。
- 侧边栏导航把「收款渠道」改为「资金管理」，路由 `/admin/finance`。

### 删除

- `app/admin/(main)/payment-channels/` 整个目录（含 `[id]/` 详情、channel-form、列表 columns/data-table、withdrawal 子树、backfill-button）。
- `app/api/admin/payment-channels/` 整个目录（渠道 CRUD、`[id]`、backfill、`[id]/withdrawals`）。

### 新增 API

```
app/api/admin/payouts/
├── route.ts        # POST 新建
└── [id]/route.ts   # PATCH 改 / DELETE 删
```

列表不走 API——`finance/page.tsx` 作为 RSC 直接 `prisma.payout.findMany` 拉取（沿用现渠道详情页的 RSC 模式），mutation 后 `router.refresh()`。

与分销员提现 API（`/api/admin/withdrawals` 或 distributor 命名）隔离，不复用、不冲突。

## 边界与风险

- **历史订单退款**：旧订单的 `paymentChannelId` 删除后，退款一律用 env 凭据调 z-pay。前提：历史所有渠道用的就是 env 这同一个 z-pay 账号（用户确认「只用一个账号」成立）。若历史上真存在过不同 pid 的账号，那些订单的在线退款会失败——按用户确认，不存在此情况。
- **年度税务追踪（年限额 KPI）**：随多渠道移除，不再展示。用户已确认单账号无分税需求。
- **收入口径变化**：余额从"渠道归属收入"变为"全部已完成订单"，金额会变大（纳入了原 `paymentChannelId = null` 的订单）。这是预期的修正，不是 bug。
- **在途支付**：notify_url 早已走 env 路径，本改动不影响在途单。

## 测试

- `lib/domains/finance.ts`：余额计算（收入 − 提现，含零提现、零订单）。
- `app/api/admin/payouts`：新建/改/删 + 鉴权。
- 改写 `lib/zpay.ts` 相关测试：去 channel 入参后签名/URL/退款仍正确。
- 退款 route：env 凭据路径。
- 删除多渠道相关测试文件（channel CRUD、轮转、backfill）。
- 迁移后跑全量 Jest + `npm run build` 类型检查。

## 实施顺序提示

先把已完成的 `yipay → zpay` 重命名单独提交（一个干净 commit），再开始本重设计——本设计会删除/改写其中部分文件，分两个 commit 历史更清晰。
