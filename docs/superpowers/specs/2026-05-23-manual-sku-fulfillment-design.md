# 手动发货 + SKU + 企微通知 设计

> 日期：2026-05-23
> 状态：待审阅

## 背景

当前商品只支持两种发货方式：

- `NORMAL`：管理员预先导入卡密池，付款时自动从池子里取一张绑定订单
- `AUTO_FETCH`：付款时实时抓取共享号源

这两种都是「一价一库存、自动发货」。现在要承接一类新业务：

- 商品有多个售卖档位（如 1 个月 / 3 个月 / 12 个月，价格和库存各异）
- 每单需要管理员手工填发货内容（账号/卡密/网盘链接等字符）后再放出
- 管理员要能在微信上即时收到「新订单到达」「买家催发货」推送，离开后台也不漏单
- 买家要能清楚看到订单当前所处的阶段；非工作时间下单不被拒，但要被告知"卖家会在工作时间处理"

## 目标

1. 新增 `ProductType.MANUAL`，与 NORMAL/AUTO_FETCH 并列
2. 给 MANUAL 商品引入 SKU 维度（一维 Variant 列表：名称 + 价格 + 库存 + 成本）
3. 订单状态机扩展为 5 态：`PENDING`（待付款）/ `AWAITING_FULFILLMENT`（待发货）/ `PROCESSING`（处理中）/ `COMPLETED` / `CLOSED`
4. 工作时间配置（站点级），仅用于买家端 ETA 文案展示，不拦下单
5. 卖家通过企业微信群机器人 webhook 接收"新订单"和"买家催发货"两类推送
6. 买家通知沿用现有邮件通道

## 非目标

- 不为 NORMAL/AUTO_FETCH 加 SKU
- 不做买家侧微信通知（公众号 / WxPusher / 小程序，本期不接）
- 不做 SLA 超时 cron 自动告警；只在催发货按钮被点时推送
- 不做节假日 / 例外日（工作时间按每周固定窗口）
- 不引入 NotificationChannel 抽象层（企微通道直写，未来要加再抽）
- 不让 MANUAL 复用 Card 表（发货内容存独立表 `OrderFulfillment`）
- 不让 MANUAL 接入 cross-sell / restock-subscription / exit-discount / purchase-limit 等增长功能
- 不支持单订单买多份 SKU（MANUAL 订单 `quantity` 固定为 1，多份要求买家下多单）
- 不做子管理员"工号"分配；单一 admin 收所有企微通知
- 不为已发货订单提供"修改发货内容"功能（要补救只能新增运营手段，超出本期）

## 数据模型

### `ProductType` enum

```
enum ProductType {
  NORMAL
  AUTO_FETCH
  MANUAL    // 新增
}
```

### `OrderStatus` enum

```
enum OrderStatus {
  PENDING                  // 待付款（现有）
  AWAITING_FULFILLMENT     // 已付待发货（新增，仅 MANUAL）
  PROCESSING               // 卖家接单中（新增，仅 MANUAL）
  COMPLETED                // 已完成（现有）
  CLOSED                   // 已关闭/退款（现有）
}
```

NORMAL/AUTO_FETCH 商品永远不会经过中间两态：付款回调一次性 `PENDING → COMPLETED`。

### 新表 `ProductVariant`

```prisma
model ProductVariant {
  id             String   @id @default(cuid())
  productId      String
  name           String                          // 如 "1 个月" / "高级版-季度"；同时承担展示标签和区分作用，本期不引入独立 SKU 编码字段
  price          Decimal  @db.Decimal(10, 2)
  unitCost       Decimal? @db.Decimal(10, 2)     // 可空；空时按 0 算（与 Card.unitCost 一致）
  stockQuantity  Int      @default(0)            // 整数库存计数
  sortOrder      Int      @default(0)
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  product        Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  orders         Order[]

  @@index([productId, isActive, sortOrder])
}
```

约束：
- MANUAL 商品创建时默认 `Product.status=INACTIVE`，必须先添加至少 1 个 `isActive=true` 的 Variant 才能切到 `ACTIVE`
- Product 上架（INACTIVE→ACTIVE）API 加守卫：MANUAL 商品必须至少有 1 个 active Variant，否则 422
- 当 MANUAL 商品的全部 Variant 都被停用 / 删除后，自动把 Product 切回 INACTIVE（在 Variant 改动 API 末尾兜底）

### 新表 `OrderFulfillment`

```prisma
model OrderFulfillment {
  id           String   @id @default(cuid())
  orderId      String   @unique           // 1-1
  content      String   @db.Text          // 卖家填写的发货文本
  fulfilledBy  String                     // 操作者 admin userId
  fulfilledAt  DateTime @default(now())
  order        Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  operator     User     @relation(fields: [fulfilledBy], references: [id])
}
```

写入即锁死（一旦 row 存在不可改）；admin UI 用 `AlertDialog` 二次确认；后端 `create` 走 unique 约束保证幂等。

### 新表 `NotificationLog`

```prisma
model NotificationLog {
  id         String   @id @default(cuid())
  channel    String                       // "wecom" 等
  event      String                       // "order.awaiting_fulfillment" / "order.dun"
  payload    String   @db.Text            // JSON
  status     String                       // "sent" | "failed"
  error      String?  @db.Text
  orderId    String?
  createdAt  DateTime @default(now())

  @@index([orderId])
  @@index([createdAt])
}
```

留痕用，**不**做"未送达自动重试"。

### `Order` 扩展

```prisma
model Order {
  // 现有字段...
  variantId             String?              // MANUAL 必有，其他类型必无
  variantNameSnapshot   String?  @db.VarChar(200)   // 下单时 variant.name
  // 现有 unitPriceSnapshot 复用：NORMAL/AUTO_FETCH=product.price；MANUAL=variant.price
  //   语义统一为"该订单下单时的单价"，更新字段 doc 注释
  // 现有 productNameSnapshot 不变（始终是 product.name）
  dunCount              Int      @default(0)        // 催发货次数
  lastDunAt             DateTime?                   // 最近一次催发货
  variant               ProductVariant? @relation(fields: [variantId], references: [id], onDelete: Restrict)
  fulfillment           OrderFulfillment?

  @@index([variantId])
}
```

约束（service 层校验，schema 层不强制）：
- `product.productType=MANUAL` → 必有 `variantId`，`quantity=1`
- `product.productType != MANUAL` → `variantId` 必为 null
- `dunCount` / `lastDunAt` 仅 MANUAL 使用

### `SiteSetting` 扩展

`SiteSetting` 是单行 singleton 表（`id = "singleton"`，详见 `prisma/schema.prisma:602-615`），每个配置一个独立 column。已有 `businessHoursStart` / `businessHoursEnd` / `businessHoursTimezone` / `escalateWebhookUrl`（后者是客服 agent 升级用，**不复用**）。

本期在 singleton 表新增列：

| 新增列 | 类型 | 说明 |
|---|---|---|
| `businessHoursWeekdays` | `String?` | JSON 数组 `[0..6]`（0=Sun，与 JS `Date.getDay()` 对齐）；null = 默认每天 |
| `wecomWebhookUrl` | `String?` | 企微群机器人 webhook 完整 URL（含 key）；null/空则关闭推送 |
| `dunCooldownMinutes` | `Int?` | 催发货冷却分钟数；null 时取默认 30 |
| `dunMinAgeMinutes` | `Int?` | 订单需创建多久后才能催；null 时取默认 5 |

工作时间窗口**复用** `businessHoursStart` / `businessHoursEnd`（分钟数，0–1440+）/ `businessHoursTimezone`（IANA 时区字符串，缺省 `Asia/Shanghai`）；不重新建字段。

读取统一走 `lib/site-settings.ts:getSiteSettings()`（已有）；新加字段往该函数加默认值映射。

## 状态机

下图为常用主路径示意，**完整规则以下方表格为准**：

```
PENDING ──(支付回调)──> AWAITING_FULFILLMENT
   │                            │
   │                            │ (admin 接单 / 直接发货)
   │                            ▼
   │                       PROCESSING
   │                            │
   │                            │ (admin 提交发货文本)
   ▼                            ▼
CLOSED                      COMPLETED
                              ▲
                              │ (旧 NORMAL/AUTO_FETCH 一步直达)
                              │
                          PENDING
```

（图未画出：`AWAITING_FULFILLMENT → COMPLETED`、`AWAITING_FULFILLMENT/PROCESSING → CLOSED` 这几条 admin 干预路径，详见下表。）

非法转移由 `lib/order-state-machine.ts` 集中守卫；任何 API handler 调用前必须经它判定。

允许的转移：
- `PENDING → COMPLETED`（仅 NORMAL/AUTO_FETCH）
- `PENDING → AWAITING_FULFILLMENT`（仅 MANUAL，付款成功）
- `PENDING → CLOSED`（超时/取消）
- `AWAITING_FULFILLMENT → PROCESSING`（admin 接单）
- `AWAITING_FULFILLMENT → COMPLETED`（admin 跳过接单直接发货也允许）
- `AWAITING_FULFILLMENT → CLOSED`（admin 退款关单 → 回滚库存）
- `PROCESSING → COMPLETED`（admin 发货）
- `PROCESSING → CLOSED`（admin 退款关单 → 回滚库存）

### 关单权限边界

| 触发者 | 允许在哪些状态触发关单 |
|---|---|
| 系统 cron（`close-expired-orders.ts`） | 仅 `PENDING` 超时 |
| Admin | `PENDING` / `AWAITING_FULFILLMENT` / `PROCESSING` |
| **买家** | **无任何关单入口** —— 已付款的订单（含 AWAITING_FULFILLMENT / PROCESSING）一律由 admin 处理；前端订单页不渲染"关闭/取消"按钮 |

买家端 UI 规则：
- `PENDING`：展示支付倒计时，超时由 cron 关；不提供主动取消按钮
- `AWAITING_FULFILLMENT` / `PROCESSING`：仅展示状态时间线 + 催发货按钮，**不提供**关闭/退款入口；遇到争议引导到客服
- `COMPLETED` / `CLOSED`：终态，无操作按钮

## 业务流程

### 1. 下单（MANUAL）

1. 买家进商品详情页 → 看到 N 个 Variant 卡片 → 选一个 → 进结算页
2. POST `/api/orders`：
   - **复用现有限流/反爬**：`checkOrderCreateRateLimit` + Turnstile + IP/fingerprint 守卫，与 NORMAL/AUTO_FETCH 一致（[CODE: app/api/orders/route.ts:516]）
   - 校验 variant 属于该 product、active、`stockQuantity >= 1`
   - 校验 quantity=1（强制；MANUAL 单订单只能 1 份）
   - 创建 Order（status=PENDING，写 variantId / variantNameSnapshot / unitPriceSnapshot=variant.price）
   - **暂不**扣 stockQuantity（避免未付款占库存）；改在付款回调里扣
3. 跳转支付页

### 2. 付款回调（MANUAL 分支）

修改 `lib/complete-pending-order.ts` 增加 MANUAL 分支：

```
if product.productType === MANUAL:
  在事务里：
    - Order.status = AWAITING_FULFILLMENT
    - Order.paidAt = now
    - Order.costTotalSnapshot = variant.unitCost ?? 0
    - ProductVariant.stockQuantity -= 1（用 updateMany 的 where 条件做乐观锁：stockQuantity >= 1）
    - 若库存不足 → 整个事务回滚，订单留在 PENDING 状态等买家自行关闭/超时；不自动退款（现有支付通道无自动退款 API，由 admin 手动处理）
  事务外：
    - sendWecomNotification("order.awaiting_fulfillment", order)  // fire-and-forget
    - **不**发买家邮件（发货时才发）
    - **不**调 createOrderCommissions（推迟到 COMPLETED）
else:
  // 走现有逻辑
```

**佣金**：现有 `createOrderCommissions` 在 PENDING→COMPLETED 时调。MANUAL 推迟到真正 COMPLETED 时调用，避免未发货就先记佣金。

### 3. 接单（可选）

POST `/api/admin/orders/[id]/take`：
- 守卫：当前状态必须是 `AWAITING_FULFILLMENT`
- 转 `PROCESSING`
- 不发任何通知

### 4. 发货

POST `/api/admin/orders/[id]/fulfill` body `{ content: string }`：
- 守卫：当前状态 ∈ `{ AWAITING_FULFILLMENT, PROCESSING }`
- 校验 content 非空，长度 ≤ 5000
- 事务：创建 OrderFulfillment（unique on orderId 保证幂等）→ Order.status=COMPLETED → 调 `createOrderCommissions` + `checkAndIssueMilestoneBonuses`
- 事务外：调 `sendOrderCompletionEmail`，详见下方"邮件改造"

**邮件改造**：现有 `OrderCompletion` 模板签名为 `{ cards: Array<{ content }>, ... }` ([CODE: lib/order-completion-email.ts:34-43])。本期改造模板入参为更通用的 `accountContent: string`（多张卡时用 `\n\n` 拼接），调用方按 productType 组装：
- NORMAL/AUTO_FETCH：`cards.map(c => c.content).join("\n\n")`
- MANUAL：`fulfillment.content`

模板内部不再感知"卡密 vs 手动"差异。

### 5. 关单（退款回滚）

POST `/api/admin/orders/[id]/close`（沿用现有，扩展行为）：
- 守卫：状态 ∈ `{ PENDING, AWAITING_FULFILLMENT, PROCESSING }`
- 若 MANUAL 且状态 ∈ `{ AWAITING_FULFILLMENT, PROCESSING }` → `variant.stockQuantity += 1`
- 转 CLOSED

### 6. 催发货

POST `/api/orders/[id]/dun` body `{ orderNo, email, password }`：
- **鉴权**：复用 `/api/orders/lookup` 的凭证语义 —— 必须同时传 `orderNo + email + password`（订单创建时设置的 password），后端校验 `bcrypt.verify(password, order.passwordHash)`，校验失败返回 401；不提供"按 session 走"路径（买家可能未登录）
- 守卫：订单状态 ∈ `{ AWAITING_FULFILLMENT, PROCESSING }`、订单年龄 ≥ `dunMinAgeMinutes`、距 `lastDunAt` ≥ `dunCooldownMinutes`
- 复用 `/api/orders` 的 IP 限流配置防 abuse
- 更新 `dunCount += 1`、`lastDunAt = now`
- 调 `sendWecomNotification("order.dun", order)`
- 返回剩余 cooldown 秒数

## 现有 lookup API 兼容

现有 `/api/orders/lookup` 和 `/api/orders/lookup-by-email` 返回结构硬挂 `cards: Array<{ content, ... }>`（[CODE: app/api/orders/lookup/route.ts:156-168]，类似在 lookup-by-email）。MANUAL 订单本期改造：

- response 增加 `fulfillment: { content } | null` 字段
- `cards` 字段对 MANUAL 订单返回 `[]`（不强行硬塞 fulfillment.content 进 cards 数组，避免类型语义被污染）
- 前端 `app/orders/lookup/` 和 `app/orders/[orderNo]/` 渲染时按 `productType`/`fulfillment` 分支

类型定义在 `app/orders/lookup/types.ts` / `lib/order-history-storage.ts` 也要更新 `LookupResponseCompleted` 等 union 型。

## 工作时间

`lib/business-hours.ts` 暴露：

```ts
isWithinBusinessHours(now: Date, cfg: BusinessHoursConfig): boolean
nextWindowStart(now: Date, cfg: BusinessHoursConfig): Date   // 当前在窗口里返回 now；否则返回最近一个窗口起点
formatEtaText(now: Date, cfg: BusinessHoursConfig): string
  // 在窗口内："卖家通常在 15 分钟内发货"
  // 不在窗口内："非工作时间，卖家将在 {next} 后处理"
```

`BusinessHoursConfig` 取自 `getSiteSettings()`：`{ start, end, weekdays, timezone }`。

边界：
- `end > 1440` 表示跨日窗口（如 22:00-次日 06:00）
- weekdays 用 JS 周（0=Sun, 6=Sat），与 `Date.getDay()` 对齐；null/缺省=每天
- 服务端按 `SiteSetting.businessHoursTimezone` 计算（缺省 `Asia/Shanghai`）；不读用户浏览器时区

## 通知机制

### `lib/wecom-notify.ts`

```ts
type WecomEvent = "order.awaiting_fulfillment" | "order.dun"

sendWecomNotification(event: WecomEvent, order: OrderWithRelations): Promise<void>
  // 1. 读 SiteSetting.wecomWebhookUrl；空则直接 return（不留日志）
  // 2. 渲染 markdown：订单号 / SKU 名 / 金额 / 买家邮箱 / 当前状态 / 后台链接
  // 3. POST https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx
  //    body: { msgtype: "markdown", markdown: { content } }
  // 4. 写 NotificationLog（status=sent/failed + error）
  // 5. 失败不抛（fire-and-forget 语义）
```

调用点：付款回调（MANUAL 分支）、催发货 API handler。

**频率与去重**：本期不做。企微 webhook 单 key 20 条/分钟够用；超限由 webhook 直接返回错误并被写入 NotificationLog。

## UI 概要

### Admin 端

- `app/admin/(main)/products/` 商品编辑表单
  - ProductType 选项加 MANUAL；选中后展开 "SKU 管理" 区块
  - SKU 区块：表格 + 行操作（编辑/停用/删除）+ 新建按钮；列：名称 / 价格 / 成本 / 库存 / 启用 / 排序
  - MANUAL 商品不显示 Card 池 tab、不显示 `maxQuantity` 字段、不显示 sourceUrl

- `app/admin/(main)/orders/` 订单列表
  - 新增 status 筛选项 `AWAITING_FULFILLMENT` / `PROCESSING`
  - 表格新增 "SKU" 列（取 variantNameSnapshot）

- `app/admin/(main)/orders/[id]/` 订单详情
  - 头部状态徽章按 5 态着色
  - MANUAL 且状态 = AWAITING_FULFILLMENT → 显示 "接单" 按钮
  - MANUAL 且状态 ∈ { AWAITING_FULFILLMENT, PROCESSING } → 显示 "发货" 按钮 + 文本输入区
  - 点"发货" → `AlertDialog` 二次确认 "发货内容提交后不可修改，确认？"
  - 已 COMPLETED 的 MANUAL 订单显示已发内容（只读）
  - 显示 dunCount / lastDunAt（如有）

- `app/admin/(main)/settings/` 新增"通知配置"卡片
  - `wecomWebhookUrl` 输入 + "发送测试消息" 按钮
  - `businessHours` 编辑器（每周勾选 + 起止时间）
  - `dunCooldownMinutes` / `dunMinAgeMinutes` 数字输入

### 买家端

- `app/products/[productIdSlug]/` 商品详情页
  - MANUAL 商品：渲染 Variant 列表（卡片选择器，类似 ABTest 套餐选择 UX）
  - 选中 variant 后才能进入"购买"流程；价格按 variant 显示
  - 商品页底部展示 "工作时间 X:00-Y:00"（取自 SiteSetting）

- `app/orders/[orderNo]/` 订单详情页
  - 时间线组件：5 态进度条（已经过的态高亮）
  - 状态文案：
    - `PENDING`：等你完成支付
    - `AWAITING_FULFILLMENT`：根据 `isWithinBusinessHours(now)` 走两套 ETA 文案
    - `PROCESSING`：卖家正在为你处理
    - `COMPLETED`：发货内容展示（取自 OrderFulfillment.content）
    - `CLOSED`：订单已关闭，如有疑问联系客服（不暗示自动退款）
  - 状态 ∈ { AWAITING_FULFILLMENT, PROCESSING } 且订单年龄 ≥ `dunMinAgeMinutes` 且距 `lastDunAt` ≥ `dunCooldownMinutes` → 显示 "催发货" 按钮，否则灰显倒计时
  - 点催发货 → toast 提示"提醒已发出"（不暗示已到达；推送链路异步，失败也不告知买家）

## Edge cases & 守卫

| 场景 | 行为 |
|---|---|
| 同一 variant 并发下单导致超卖 | 付款回调里 `updateMany where stockQuantity >= 1` 的乐观锁；失败则订单留在 PENDING，由 admin 手工沟通处理（与第 2 节"付款回调"语义一致；现有支付通道无自动退款 API） |
| Variant 在订单存在期间被停用 | `isActive=false` 仅影响下单可选；不影响已下单订单的关单回滚库存 |
| Variant 在订单存在期间被删除 | `Order.variant` 关系 `onDelete: Restrict`（DB 层阻止）；admin UI 有关联订单时禁用"删除"按钮，仅显示"停用" |
| 工作时间跨午夜 | 用 `end > 1440` 表示跨日；判定 `inWindow` 时：非跨日 `now ∈ [start, end)`；跨日 `now >= start \|\| now < end - 1440`。需对应日的 weekday 也在 weekdays 集合中（跨日时使用窗口起点那天的 weekday） |
| 催发货被 abuse | 后端按 dunCooldownMinutes 拦下；前端按钮跟着倒计时 |
| 企微 webhook 配置缺失 | sendWecomNotification 直接 return，不报错；admin 在订单详情仍可正常操作 |
| 企微推送失败（网络/限流） | 写 NotificationLog；不阻塞订单流程；本期不为失败日志做 UI（NotificationLog 留作排查时直接查库） |
| 老 NORMAL 订单的状态机 | 永远不经新增中间态；现有流程一字不动 |
| MANUAL 商品的 `excludeFromAttribution` / `purchaseLimitEnabled` 等 | 现有字段保留，行为透明（佣金/限购照常工作） |
| 现有 cross-sell / restock / exit-discount 入口 | 在源头判定 `productType !== MANUAL`，跳过 |

## 不在范围内（再次明确）

- 不为 NORMAL/AUTO_FETCH 加 SKU；不为它们引入新状态
- 不做买家侧微信通知
- 不做 SLA 自动告警 cron
- 不做"发货内容修改"功能（发货即锁死）
- 不做单订单多 SKU / 多份
- 不做节假日例外
- 不做 NotificationChannel 抽象
- **不扩展 batch CLOSE 到新状态**：现有 `app/api/orders/batch/route.ts` 的 CLOSE 仅允许 `PENDING → CLOSED`（[CODE: app/api/orders/batch/route.ts:64-76]）；MANUAL 引入后 admin 列表对 `AWAITING_FULFILLMENT/PROCESSING` 仅支持单笔关单（避免库存回滚的批量并发问题）

## 实施注意

- **命名易混淆提示**：现有 `lib/auto-fetch-card.ts` 有常量 `MANUAL_BLACKLIST_REASON`（AUTO_FETCH 黑名单的"人工拉黑"原因），与本期新增 `ProductType.MANUAL` **没有语义关系**。code review 时如遇 `MANUAL` 字样请按上下文区分；新引入 ProductType.MANUAL 时不要复用 / 重命名该常量
- **企微 webhook 调用参考**：`lib/agent-cs.ts:921-922` 已有相似的 `escalateWebhookUrl` POST 模式（客服 lead 升级用），实施 `wecom-notify.ts` 可参考其 fire-and-forget 写法

## 实施路径概要（顺序）

1. **Schema 迁移**：单个 Prisma 迁移文件加 enum 值、加表、加字段、加索引；按 `migrate-safe` 原则提交，不改动既有迁移文件
2. **域层**：`lib/domains/variants/`（CRUD + active 校验）、`lib/order-state-machine.ts`、`lib/business-hours.ts`、`lib/wecom-notify.ts`
3. **下单 / 支付 / 关单**：改造 `app/api/orders/route.ts`、`lib/complete-pending-order.ts`、关单 handler，按 MANUAL 分支
4. **发货 API**：新建 `/api/admin/orders/[id]/take` `/api/admin/orders/[id]/fulfill`
5. **催发货 API**：新建 `/api/orders/[id]/dun`
6. **邮件改造**：`sendOrderCompletionEmail` 支持 MANUAL（读 OrderFulfillment 而非 cards）
7. **Admin UI**：商品表单 SKU 区、订单详情 MANUAL 控件、通知配置页
8. **买家 UI**：商品详情 Variant 选择器、订单详情 5 态时间线 + ETA + 催发货按钮
9. **守卫**：cross-sell / restock / purchase-limit 等入口加 `productType !== MANUAL` 判定
10. **测试**：状态机单测、wecom-notify 失败容灾测、business-hours 边界用例、并发下单 stock 测试

每步独立可合 PR；中间状态对老 NORMAL/AUTO_FETCH 用户透明。
