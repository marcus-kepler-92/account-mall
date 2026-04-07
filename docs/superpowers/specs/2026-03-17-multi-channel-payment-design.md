# Multi-Channel Payment Design

Date: 2026-03-17

## Background

The platform collects revenue through multiple 易支付 accounts registered under different identities for tax management purposes. Currently, only a single 易支付 config (env vars) is supported, making it impossible to track per-account income or manage withdrawals from each account. The annual tax threshold per account is ¥65,000.

## Goals

1. Support multiple 易支付 payment channels in the database
2. Automatically route orders to the channel with the most remaining annual capacity
3. Track per-channel income (derived from orders) and withdrawals (manually recorded)
4. Admin UI to monitor each channel's annual progress and current balance

## Data Models

### PaymentChannel

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | |
| nickname | String | Display name, e.g. "张三支付宝" |
| pid | String | 易支付 merchant ID |
| key | String | 易支付 signing key |
| submitUrl | String | 易支付 submit endpoint |
| siteName | String | 易支付 site name |
| annualLimit | Decimal(10,2) | Annual income limit, default 65000 |
| sortOrder | Int | Rotation order, lower = higher priority |
| isActive | Boolean | Whether this channel participates in routing |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### ChannelWithdrawal

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | |
| channelId | String | FK to PaymentChannel |
| amount | Decimal(10,2) | Amount withdrawn |
| note | String? | e.g. "提到招商银行 xxx" |
| createdAt | DateTime | |

### Order (additions)

| Field | Type | Notes |
|-------|------|-------|
| paymentChannelId | String? | FK to PaymentChannel, null for historical orders |

## Channel Selection Strategy

`selectPaymentChannel()` is called at order creation time:

1. Fetch all `isActive = true` channels ordered by `sortOrder ASC`
2. For each channel, compute **annual income** = `SUM(order.amount WHERE paymentChannelId = X AND status = COMPLETED AND paidAt in current calendar year)`
3. Return the first channel where `annualIncome < annualLimit`
4. If all channels are over limit → return the channel with the most remaining capacity (soft limit, does not block payments)
5. If no channels exist in DB → fall back to env var config

This is a soft limit: slight overruns are acceptable since the primary goal is tax management, not hard enforcement.

## Payment Flow Changes

### Order creation

- Call `selectPaymentChannel()` to pick a channel
- Write `paymentChannelId` to the order record
- Use that channel's `pid`, `key`, `submitUrl`, `siteName` to build the payment URL

### Async notify callback (`/api/payment/yipay/notify`)

- Extract `out_trade_no` from POST body (this is the `orderNo`)
- Look up `order.paymentChannelId` → fetch `PaymentChannel.key`
- Use that key for signature verification
- Backward compatibility: if `paymentChannelId` is null, fall back to env var key

No changes needed to `notify_url` format — channel lookup happens via order, not URL params.

## Admin UI

### `/admin/payment-channels`

Server-rendered list page. Each row displays:

| Column | Value |
|--------|-------|
| 昵称 | channel.nickname |
| PID | channel.pid |
| 年度收入 / 年限额 | Progress bar — used to sense when rotation is needed. >80% highlighted as warning |
| 当前余额 | Cumulative order income − cumulative ChannelWithdrawals |
| 操作 | Edit · Record withdrawal · Enable/Disable |

**Two metrics are distinct and must be shown separately:**
- **年度收入** — current calendar year only; determines when to rotate to next channel
- **当前余额** — all-time cumulative; determines how much can be withdrawn

### Add / Edit channel

Dialog form: nickname, pid, key, submitUrl, siteName, annualLimit, sortOrder.

### Record withdrawal

Dialog form: amount, note. `createdAt` is set to now (no backdating needed for simplicity).

### Channel deactivation

Channels are disabled (`isActive = false`), never deleted. Channels with associated orders must not be deleted to preserve income history.

## Backward Compatibility

- Existing orders with `paymentChannelId = null` continue to work
- Notify callback falls back to env var key when `paymentChannelId` is null
- If no channels are configured in DB, `selectPaymentChannel()` returns null and the system uses env var config as before
- Env var config (`YIPAY_PID` etc.) remains valid as a fallback

## Known Limitations

- Annual income stats start from when channels are first configured. Pre-existing income from the old single-channel setup is not automatically attributed to any channel. If this causes a channel to appear under-utilized, record a manual `ChannelWithdrawal` for the already-collected amount to bring the balance in sync.
- Concurrent order creation may select the same channel and cause slight overrun of the annual limit. This is acceptable given the soft-limit nature of the constraint.
