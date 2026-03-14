# 营销体系升级：二级佣金裂变 + 邀请制注册

## 背景与决策

- 单价 ¥38.9，进货 ¥2.5，支付手续费 2%，月固定成本 ¥400
- 现有 CommissionTier：L1=52%, L2=63%, L3=74%, L4=84%, L5=89%
- **二级佣金**：从现有佣金中分出 8% 给上线，平台总支出不变
- **注册方式**：关闭公开注册，改为邀请制（管理员/分销员通过邮箱邀请）
- CommissionTier 后台管理页已存在，无需新建

## 盈亏平衡（平台支出不变）

- 直接销售：每单净利 ¥35.62，月 12 单回本
- L1 (52%)：每单净利 ¥15.39，月 26 单回本
- L3 (74%)：每单净利 ¥6.79，月 59 单回本
- L5 (89%)：每单净利 ¥1.00，月 400 单回本
- 混合场景（10 直销 + 20 L1 + 10 L2）：月 40 单净利 ¥375

## 佣金拆分规则

- 分销员有上线且上线未停用 → 分销员拿 (阶梯% - 8%)，上线拿 8%
- 分销员无上线 → 分销员拿完整阶梯%，不扣
- 上线已停用 → 8% 回给分销员，分销员拿完整阶梯%
- 安全下限：level2Amount = min(commissionBase × 8%, totalCommission)，防止阶梯比例 < 8% 时一级佣金为负
- 链条可无限延伸，每笔交易只产生 2 层佣金（合规）

---

## Part 1：二级佣金

### 1.1 Schema — prisma/schema.prisma

Commission 新增两个字段：

- `level Int @default(1)` — 1=一级, 2=二级
- `sourceDistributorId String?` — level=2 时记录触发的下线 ID

新增迁移 SQL，历史数据默认 level=1。

### 1.2 配置 — lib/config.ts

新增 `LEVEL2_COMMISSION_RATE_PERCENT`，默认 8。

### 1.3 核心逻辑 — lib/complete-pending-order.ts（第 86-187 行）

算出 totalCommission 后：
- 查 distributor.inviterId + inviter 的 role、disabledAt、email
- 有上线且未停用且 role=DISTRIBUTOR：
  - level2 = min(commissionBase × 8%, totalCommission)
  - level1 = totalCommission - level2
  - 写两条 Commission（level=1 给分销员，level=2 给上线）
- 无上线 / 上线已停用 / 上线是管理员 → 写一条 Commission（level=1，金额=totalCommission 全额）
- 防刷：下单邮箱 = 上线邮箱 → 不拆分，全额给分销员
- 删除 InvitationReward 创建逻辑（第 159-187 行），保留表和历史数据

### 1.4 UI/UX — 分销中心完整改版

> **CLAUDE.md 规范对照说明：**
> - 单文件超 ~200 行按 `{component}-{section}.tsx` 拆分，子组件用 `useFormContext()` 或 props 传值
> - 含 `useState`/事件处理的区块提取为 Client Component（`"use client"`），就近放路由文件夹
> - 凡使用 `useSearchParams()` 的组件，其父 `page.tsx` 必须用 `<Suspense>` 包裹
> - DataTable 三件套：`page.tsx` + `xxx-columns.tsx` + `xxx-data-table.tsx`
> - 所有 Tooltip 使用 shadcn `@/components/ui/tooltip`，不自造

---

#### 侧边栏 — app/components/distributor-sidebar.tsx

新增「我的下线」导航项（图标 `Users`，href `/distributor/invitees`）：

```
仪表盘
入门手册
我的下线        ← 新增
我的订单
我的佣金
提现记录
```

---

#### 仪表盘 — 文件拆分（当前 230 行，改版后预计 400+ 行，必须拆分）

**文件结构：**

```
app/distributor/(main)/
├── page.tsx                        ← 服务端数据获取 + 组合，维持 RSC
├── dashboard-kpi-section.tsx       ← 新增，KPI 卡片行，纯展示 RSC props 驱动
└── dashboard-invite-section.tsx    ← 新增，邀请表单，"use client"
```

**`page.tsx`（Server Component）职责：**
- 查询数据：orderCount、level1Commission、level2Commission、withdrawableBalance、distributorCode、inviteeCount、tierSummary
- 组合各 Section 子组件，传入 props

**`dashboard-kpi-section.tsx`（Server Component / 纯展示）：**

5 格 KPI 卡片（`sm:grid-cols-2 lg:grid-cols-5`）：

| 卡片 | 标题 | 数字 | 副文字 |
|------|------|------|------|
| 成交订单数 | 不变 | orderCount | 已完成订单 |
| 累计一级佣金 | 原「累计佣金」 | ¥level1Total | 直接推广所得 |
| 累计二级佣金 | 新增 | ¥level2Total | 下线成交所得 |
| 可提现余额 | 不变 | ¥withdrawable | 可申请提现 |
| 推广优惠码 | 不变 | distributorCode | — |

**`dashboard-invite-section.tsx`（Client Component，`"use client"`）：**

props：`{ inviteeCount: number; level2Total: number }`

```
卡片标题：  邀请下线（图标 Users）
卡片说明：  邀请好友成为分销员，好友每笔成交您持续获得 8% 二级佣金，无上限。

内容区：
  [邮箱输入框 — react-hook-form + zodResolver]  [发送邀请] 按钮
  状态提示（useFormState）：发送成功 / 邮箱已注册 / 发送失败

底部统计行（来自 props）：
  已邀请 {inviteeCount} 人下线  ·  累计二级佣金 ¥{level2Total}
```

表单字段：`email: z.string().email()`，schema 放 `lib/validations/` 新增 `distributor-invite.ts`。
提交调用 `POST /api/distributor/invite`，成功 toast「邀请邮件已发送至 xxx@xx.com」。

**其余区块（页面其他卡片）不变，保持在 `page.tsx` 内联：**
- 当周业绩与阶梯卡片
- 整站推广链接卡片

---

#### 佣金列表页 — 文件拆分（当前 240 行，改版后预计 380+ 行，必须拆分）

**文件结构：**

```
app/distributor/(main)/commissions/
├── page.tsx                          ← 服务端数据获取 + 组合
├── commissions-filters.ts            ← 不变
├── commissions-columns.tsx           ← 改版，新增 level/sourceDistributorName 列
├── commissions-data-table.tsx        ← 不变
├── apply-withdrawal-form.tsx         ← 不变
└── commissions-balance-section.tsx   ← 新增，可提现余额卡片，纯展示
```

**`commissions-balance-section.tsx`（Server Component / 纯展示）：**

props：`{ level1Settled: number; level2Settled: number; invitationRewardTotal: number; paidTotal: number; pendingTotal: number; inviteeCount: number; level2Total: number; minAmount: number; withdrawableBalance: number; pendingWithdrawalTotal: number }`

渲染两张卡片：

**② 可提现余额卡片（改版文案）：**

CardDescription 改为：
```
一级佣金（已结算）¥XX + 二级佣金（已结算）¥XX + 历史邀请奖励 ¥XX − 已打款 ¥XX − 提现中 ¥XX
```
（历史邀请奖励仅在 > 0 时展示，向后兼容旧数据）

**③ 二级佣金汇总卡片（新增）：**

```
卡片标题：  二级佣金收益（下线推广所得）
卡片说明：  下线每笔成交，您自动获得对应金额的 8% 作为二级佣金

内容区：
  累计二级佣金    ¥XXX.XX
  参与下线数量    X 人

底部 Link：查看我的下线 →（href=/distributor/invitees）
```

**`commissions-columns.tsx` 改版（已是 `"use client"`）：**

`DistributorCommissionRow` 类型新增：
- `level: 1 | 2`
- `sourceDistributorName?: string`

新增「类型」列（排在订单号之后）：
- level=1 → `<Badge variant="default">一级推广</Badge>`
- level=2 → `<Badge variant="outline">二级推广</Badge>` + shadcn `<Tooltip>` 显示「来自下线：{sourceDistributorName}」

**`page.tsx` 删除「邀请奖励明细」表格区块**（逻辑已被二级佣金替代，历史数据仍可在佣金明细表格中通过 level/sourceDistributorName 字段追溯）

---

#### 新增「我的下线」页 — DataTable 三件套

```
app/distributor/(main)/invitees/
├── page.tsx               ← Server Component，数据查询 + 组合
├── invitees-columns.tsx   ← "use client"，列定义
└── invitees-data-table.tsx ← "use client"，TanStack Table + 搜索
```

**`page.tsx` 布局：**

```
页面标题：我的下线 / 已邀请的分销员列表

① 汇总卡片行（2 格）：下线总人数 | 下线带来的二级佣金
② InviteesDataTable
```

**`invitees-columns.tsx` 列定义：**

`InviteeRow` 类型：`{ id; name; email; createdAt; level2CommissionTotal }`

| 列 | 展示 |
|----|------|
| 昵称 | name |
| 邮箱 | 脱敏显示（`ab***@gmail.com`，截取 @ 前 2 字符 + *** + @ 后域名） |
| 加入时间 | createdAt，`toLocaleString("zh-CN")` |
| 为我创造二级佣金 | ¥level2CommissionTotal，右对齐 |

数据查询（`page.tsx`）：
```typescript
prisma.user.findMany({
  where: { inviterId: user.id },
  select: { id, name, email, createdAt }
})
// 再 groupBy Commission WHERE sourceDistributorId IN ids AND distributorId = user.id
// 聚合每个下线贡献的二级佣金
```

---

#### 注册页改版 — app/distributor/register/page.tsx

纯 Server Component，移除所有表单代码，替换为提示卡片：

```
居中卡片（max-w-md，居中布局参考现有 register/login 页风格）

图标：UserX（lucide-react）

标题：分销员注册已关闭
说明：目前仅支持受邀加入。如需成为分销员，请联系已有分销员，或联系管理员。

Link 按钮：← 返回登录页（href=/distributor/login，variant="outline"）
```

---

#### 新增接受邀请页 — app/distributor/accept-invite/

**文件结构（必须拆分，因为表单需要 Client Component）：**

```
app/distributor/accept-invite/
├── page.tsx                    ← Server Component，读 searchParams.token，服务端校验
└── accept-invite-form.tsx      ← "use client"，密码设置表单
```

**`page.tsx`（Server Component）：**
- 从 `searchParams` props 读取 `token`（无需 `useSearchParams`，RSC 直接读，无需 Suspense）
- 服务端查询 `DistributorInvitation`，校验 token 有效性
- 无效/过期/已使用 → 渲染错误状态（静态内容，不需要 Client）
- 有效 → 渲染 `<AcceptInviteForm email={invitation.email} token={token} />`

**token 有效时（`AcceptInviteForm`，`"use client"`）：**

使用 `useForm + zodResolver`，表单字段：
- `email`：只读展示（Input `disabled`，不纳入表单提交）
- `password`：`z.string().min(6)`，shadcn FormField
- `confirmPassword`：`.refine(val => val === password)`，shadcn FormField

提交调用 `POST /api/distributor/accept-invite`，body: `{ token, password }`。
成功后 `router.push("/distributor/login")` + toast「注册成功，请登录」。

**token 无效时（Server Component 直接渲染）：**

```
居中卡片

图标：AlertCircle（lucide-react）
标题：邀请链接无效
说明：此邀请链接已过期或已被使用。请联系邀请人重新发送邀请。

Link：← 返回登录页
```

---

#### 管理员端 — 分销员管理 app/admin/(main)/distributors/

> **文件结构（就近放置）：**
> ```
> app/admin/(main)/distributors/
> ├── page.tsx                         ← 改版，新增 3 个 groupBy 查询
> ├── distributors-columns.tsx         ← 改版，新增列 + Tooltip
> ├── distributors-data-table.tsx      ← 不变
> ├── distributors-filters.ts          ← 不变
> ├── edit-discount-dialog.tsx         ← 不变
> └── invite-distributor-dialog.tsx    ← 新增，"use client"
> ```

---

**页面标题区（改版）：**

```
分销员管理                                [邀请分销员] 按钮（Primary）
查看分销员列表、启用/停用、订单与佣金汇总
```

---

**`InviteDistributorDialog` — 邀请新分销员弹窗（新增）：**

```
弹窗标题：邀请新分销员

说明文字：
  输入对方邮箱，系统将发送邀请邮件，对方点击链接后设置密码即可加入。
  ⚠️ 由管理员直接邀请的分销员无上线，享受完整阶梯佣金比例（不被扣除 8%）。

邮箱：[输入框，placeholder: 请输入邮箱地址]

[取消]  [发送邀请]（loading 态：发送中...）

成功后：关闭弹窗，toast「邀请邮件已发送至 xxx@xx.com」
已注册：toast.error「该邮箱已注册为分销员，无需重复邀请」
```

---

**`DistributorRow` 类型改版（distributors-columns.tsx）：**

新增字段：
- `level1CommissionTotal: number` — 累计一级佣金总额
- `level2CommissionTotal: number` — 累计二级佣金总额（下线推广所得）
- `invitationRewardTotal: number` — 历史邀请奖励总额（向后兼容旧数据）
- `inviteeCount: number` — 直接下线数量

---

**列表列定义改版（distributors-columns.tsx）：**

完整列顺序：

```
昵称 | 邮箱 | 推荐码 | 上线 | 下线数 | 优惠码 | 折扣 | 状态 | 成交订单 | 累计佣金（含1+2级） | 可提现余额 | 操作
```

关键列改动：

| 列名 | 现状 | 改后 |
|------|------|------|
| 邀请人 → 上线 | 显示邀请人昵称+推荐码 | 不变，列名由「邀请人」改为「上线」 |
| 新增：下线数 | 无 | 显示该分销员直接邀请的下线人数 |
| 累计佣金 | 显示总佣金（单一数字） | 改为 Tooltip 展开展示组成：主展示总额 ¥XX，Hover 显示「一级 ¥XX + 二级 ¥XX」 |
| 可提现余额 | 显示单一数字 | 改为 Tooltip 展开展示计算公式（见下方详细设计） |

**可提现余额列的 Tooltip 内容：**

```
主展示：¥XX.XX

Hover Tooltip：
  一级佣金（已结算）  ¥XX.XX
  二级佣金（已结算）  ¥XX.XX
  历史邀请奖励       ¥XX.XX   ← 仅在有历史数据时展示
  ─────────────────────────
  已打款             -¥XX.XX
  提现中             -¥XX.XX
  ═════════════════════════
  可提现余额          ¥XX.XX
```

**行操作菜单（DropdownMenu）保持现有选项不变：**

```
操作菜单：
  ✓ 启用 / 停用
  复制推荐码
  优惠码设置
```

> 邀请下线是分销员自己的动作，入口仅在分销中心仪表盘。管理员只通过页面顶部「邀请分销员」按钮邀请一级代理。

---

**后台数据查询改版（page.tsx）：**

现有 6 个 groupBy 查询，拆分原有 `commissionSettled` 为两个，并新增下线数查询，共 9 个：

```typescript
// 原有（保留）
orderCounts, commissionAll, withdrawalPaid, withdrawalPending
// 原有（拆分为两个）
level1Settled = commission.groupBy({ where: { distributorId: { in: ids }, level: 1, status: "SETTLED" }, _sum: amount })
level2Settled = commission.groupBy({ where: { distributorId: { in: ids }, level: 2, status: "SETTLED" }, _sum: amount })
// 原有（保留，向后兼容历史数据）
invitationRewardSettled
// 新增
inviteeCounts = user.groupBy({ by: ["inviterId"], where: { inviterId: { in: ids } }, _count: { id: true } })
```

可提现余额公式由：
```
settled + invitationReward - paid - pending
```
改为：
```
level1Settled + level2Settled + invitationRewardSettled - paid - pending
```

`DistributorRow` 类型同步新增字段供列渲染使用：
- `level1CommissionTotal` — 累计一级佣金（含所有 status）
- `level2CommissionTotal` — 累计二级佣金（含所有 status）
- `level1Settled` — 已结算一级佣金（用于余额公式）
- `level2Settled` — 已结算二级佣金（用于余额公式）
- `invitationRewardTotal` — 历史邀请奖励（向后兼容）
- `paidTotal` — 已打款总额
- `pendingTotal` — 提现中总额
- `inviteeCount` — 直接下线数

---

#### 管理员端 — 提现管理 app/admin/(main)/withdrawals/

> **文件结构：**
> ```
> app/admin/(main)/withdrawals/
> ├── page.tsx                  ← 改版，新增余额查询 + 平台总额计算
> ├── withdrawals-columns.tsx   ← 改版，新增余额明细列 + Tooltip
> ├── withdrawals-data-table.tsx ← 不变
> └── withdrawal-row-actions.tsx ← 改版，弹窗增加余额明细展示
> ```

**`WithdrawalRow` 类型新增余额字段**（供列渲染和弹窗使用）：
- `level1Settled: number`
- `level2Settled: number`
- `invitationRewardTotal: number`
- `paidTotal: number`
- `pendingTotal: number`
- `currentBalance: number`（已计算好的可提现余额）

`page.tsx` 需在查询 withdrawals 后，补充查询每个分销员的余额明细（groupBy 同分销员管理页）。

**KPI 汇总卡片改版：**

现有 3 张卡片（待处理数/已打款数/已拒绝数），改为 5 张：

```
待处理（笔数）  |  待处理（金额）  |  已打款（金额）  |  已拒绝（笔数）  |  全部分销员可提现总额
```

重点是新增「全部分销员可提现总额」卡片，让管理员知道平台目前有多少资金待提现：

```
卡片标题：平台待提现总额
数字：    ¥XXX.XX
副文字：  所有分销员可提现余额之和（不含提现中）
```

**提现记录列表（withdrawals-columns.tsx）：**

现有列：分销员 | 金额 | 收款码 | 状态 | 申请时间 | 备注 | 操作

新增「余额明细」列（在金额之后）：

```
分销员 | 申请金额 | 当前可提现余额 | 收款码 | 状态 | 申请时间 | 备注 | 操作
```

「当前可提现余额」列展示该分销员提交申请时的实时可提现余额（鼠标 Hover 展示同样的明细 Tooltip：一级 + 二级 + 历史奖励 - 已打款 - 提现中）。

> 意义：管理员处理提现时，能直接看到该分销员的余额是否足够支付申请金额，避免手动核对。

**处理提现弹窗（WithdrawalRowActions 改版）：**

现有弹窗仅有「备注」输入框，改版后增加余额说明区：

```
弹窗标题：处理提现申请

分销员：xxx（email）
申请金额：¥XX.XX
当前可提现余额：
  一级佣金（已结算）  ¥XX.XX
  二级佣金（已结算）  ¥XX.XX
  历史邀请奖励       ¥XX.XX
  ─────────────────────────
  已打款             -¥XX.XX
  提现中             -¥XX.XX（含本次申请）
  ═════════════════════════
  可提现余额          ¥XX.XX

备注：[输入框]

[拒绝]  [标记已打款]
```

---

#### 管理员端 — 侧边栏 app/components/admin-sidebar.tsx

无需改动，「阶梯佣金配置」已存在。

### 1.6 测试

**修改 `__tests__/lib/complete-pending-order.test.ts`**

mock config 从 `{ invitationRewardAmount: 5 }` 改为 `{ invitationRewardAmount: 5, level2CommissionRatePercent: 8 }`。

删除 `describe("invitation reward")` 整个块（共 4 个用例），新增 `describe("level-2 commission")` 块：

| 用例 | 验证内容 |
|------|---------|
| 有上线且未停用 → 拆分佣金 | commission.create 调用 2 次：level=1 给分销员，level=2 给上线，两者之和 = totalCommission |
| 无上线（inviterId=null）→ 全额给分销员 | commission.create 调用 1 次，level=1，金额=totalCommission |
| 上线已停用（disabledAt 非 null）→ 全额给分销员 | commission.create 调用 1 次，level=1，金额=totalCommission |
| 上线 role=ADMIN → 不拆分，全额给分销员 | commission.create 调用 1 次，level=1 |
| 下单邮箱 = 上线邮箱（防刷）→ 不拆分 | commission.create 调用 1 次，level=1（现有自购防刷逻辑已拦截，上线邮箱校验同级处理） |
| 阶梯比例 < 8%（如 5%）时 level2 不超过 totalCommission | level2Amount = min(commissionBase×8%, totalCommission)，level1Amount = 0（不为负） |
| 折扣场景下二级佣金按原价 8% 计算 | commissionBase 按原价反推，level2 = commissionBase × 8% |
| level2Amount 四舍五入到 2 位小数 | commission.create 的 amount 值精确到 2 位小数 |
| sourceDistributorId 正确记录下线 ID | level=2 的 commission.create 中 sourceDistributorId = 分销员ID |

**新增 `__tests__/api/distributor-commissions.test.ts`**（测试佣金列表 API 返回的数据结构）

| 用例 | 验证内容 |
|------|---------|
| 返回佣金列表含 level 字段 | 每条佣金记录有 level=1 或 level=2 |
| level=2 的记录含 sourceDistributorId | 二级佣金记录正确返回来源下线信息 |
| 可提现余额包含 level=1 和 level=2 的已结算佣金 | aggregate 按 distributorId + status=SETTLED 聚合，不按 level 分 |

---

## Part 2：邀请制注册

### 流程

管理员/分销员输入邮箱 → 系统创建邀请+发邮件 → 被邀请人点链接 → 设置密码页 → 账号创建+绑定上线 → 可登录

### 2.1 Schema — prisma/schema.prisma

新增 DistributorInvitation 模型：
- id, email, token(unique), inviterId, expiresAt, acceptedAt, createdAt
- @@index([token]), @@index([email])

### 2.2 邮件模板 — 新增 app/emails/distributor-invitation.tsx

参考现有 order-completion.tsx + theme.ts 风格。内容：邀请人名称、平台名、「点击设置密码加入」按钮。

### 2.3 邀请 API + 共享逻辑

**共享逻辑提取到 lib/（按 CLAUDE.md：业务逻辑放 lib/）：**

新增 `lib/send-distributor-invitation.ts`，导出：
```typescript
export async function sendDistributorInvitation({
  email, inviterId, ttlDays
}: { email: string; inviterId: string; ttlDays: number }): Promise<{ success: true } | { success: false; reason: "already_registered" | "send_failed" }>
```
逻辑：创建 `DistributorInvitation` 记录 → `render(DistributorInvitation)` → `sendMail()`

**两个 API 入口各自只做鉴权 + 参数校验，共用上述函数：**

| API | 路由文件 | 鉴权 |
|-----|---------|------|
| `POST /api/admin/distributors/invite` | `app/api/admin/distributors/invite/route.ts` | `getAdminSession()` |
| `POST /api/distributor/invite` | `app/api/distributor/invite/route.ts` | `getDistributorSession()` |

**Zod schema（放 `lib/validations/distributor-invite.ts`）：**
```typescript
export const distributorInviteSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
})
```

规则：
- 校验邮箱 → 检查已注册（已注册则返回 400）
- 同一邮箱允许被多人邀请（多条邀请共存），点谁的链接算谁的下线
- 管理员邀请：inviterId = 管理员 ID（记录在 DistributorInvitation 做审计），但接受时 User.inviterId 留 null
- 分销员邀请：inviterId = 分销员 ID，接受时 User.inviterId = 分销员 ID

### 2.4 接受邀请页 — 新增 app/distributor/accept-invite/page.tsx

- 校验 token 有效性 + 未过期 + 未接受
- 设置密码表单（显示邮箱，只需输密码）
- 提交 API 用事务处理（防并发）：
  1. 事务内检查 acceptedAt IS NULL（防止同一 token 被并发接受）
  2. 用 Prisma 直接创建 User + Account（参考 seed.ts，用 hashPassword 处理密码）
  3. inviterId：邀请人是管理员 → null；邀请人是分销员 → 邀请人 ID
  4. 自动生成 distributorCode
  5. 标记邀请 acceptedAt
  6. 跳转登录页

### 2.5 管理员 UI — app/admin/(main)/distributors/

- 页面顶部新增「邀请分销员」按钮 → Dialog（输入邮箱 + 确认）
- 新增 invite-distributor-dialog.tsx

### 2.6 分销员 UI — app/distributor/(main)/page.tsx

- 邀请卡片改为「输入邮箱邀请下线」表单
- 侧边栏可选增加「我的下线」

### 2.7 关闭公开注册

- app/distributor/register/page.tsx → 改为提示「需要邀请」
- lib/auth.ts → disableSignUp 设为 true（彻底封死公开注册端点）
- 接受邀请时用 Prisma 直接创建用户（不走 better-auth signUp），所以 disableSignUp 不影响邀请流程

### 2.8 邀请配置（lib/config.ts 新增）

```typescript
distributorInviteTtlDays: z.coerce.number().int().min(1).max(30).default(7),
```
环境变量：`DISTRIBUTOR_INVITE_TTL_DAYS`

其他规范：
- token：`crypto.randomUUID()`（Node.js 内置，无需额外依赖）
- 邮箱规范化：Zod `.toLowerCase().trim()` 统一处理，不依赖运行时手动处理

### 2.9 测试

**新增 `__tests__/api/distributor-invite.test.ts`**（管理员邀请 API）

| 用例 | 验证内容 |
|------|---------|
| 管理员发起邀请 → 创建 DistributorInvitation + 发送邮件 | distributorInvitation.create 被调用，sendMail 被调用 |
| 邮箱已注册 → 返回 400 | prisma.user.findUnique 返回非空时，API 返回错误 |
| 非管理员调用 → 返回 401 | getAdminSession() 返回 null 时拒绝 |
| 邮箱格式校验失败 → 返回 400 | 非合法邮箱格式被 Zod 拦截 |
| 管理员邀请的 inviterId 记录在 DistributorInvitation | create 调用中 inviterId = 管理员 ID |

**新增 `__tests__/api/distributor-invite-self.test.ts`**（分销员邀请 API）

| 用例 | 验证内容 |
|------|---------|
| 分销员发起邀请 → 创建记录 + 发邮件 | distributorInvitation.create 中 inviterId = 分销员 ID |
| 同一邮箱可被多人邀请（不检查已有邀请）| 不报错，允许多条记录共存 |
| 非分销员调用 → 返回 401 | getDistributorSession() 返回 null 时拒绝 |
| 停用的分销员无法发邀请 | getDistributorSession() 返回已停用账号时拒绝 |
| 邮箱已注册 → 返回 400 | 已注册用户不可再次邀请 |

**新增 `__tests__/api/distributor-accept-invite.test.ts`**（接受邀请 API）

| 用例 | 验证内容 |
|------|---------|
| 有效 token + 合法密码 → 创建用户并绑定上线 | user.create 被调用，inviterId = 邀请人 ID，acceptedAt 被更新 |
| 管理员邀请的 token → 创建用户 inviterId=null | user.create 中 inviterId 为 null |
| token 不存在 → 返回 404 | distributorInvitation.findUnique 返回 null 时报错 |
| token 已过期（expiresAt < now）→ 返回 410 | expiresAt 在过去时被拒绝 |
| token 已被接受（acceptedAt 非 null）→ 返回 410 | acceptedAt 非空时被拒绝 |
| 密码太短（< 6 位）→ 返回 400 | Zod 校验拦截 |
| 事务内 acceptedAt 已被并发设置 → 返回 409 | updateMany count=0 时返回冲突错误 |
| 邮件发送失败不影响注册成功 | sendMail 抛错时用 catch 吞掉，用户仍创建成功 |

**新增 `__tests__/api/distributor-invite-page.test.ts`**（接受邀请页面 token 校验）

| 用例 | 验证内容 |
|------|---------|
| 有效 token → 展示设置密码表单 | 页面正常渲染，显示被邀请邮箱 |
| 无效/过期 token → 展示错误提示 | 页面渲染错误状态 |

**修改现有测试**

| 文件 | 变更 |
|------|------|
| `__tests__/api/distributor-bind-inviter.test.ts` | 改为测试：路由返回「已改为邀请制，此接口废弃」提示，或直接删除（视最终实现决定） |
| `__tests__/schema/schema.test.ts` | 新增 DistributorInvitation 模型校验 + Commission 的 level/sourceDistributorId 字段 |
| `__tests__/api/admin-distribution.test.ts` | 新增管理员邀请 API 的测试用例 |

---

## 实施顺序

先 Part 1（二级佣金），验证通过后再 Part 2（邀请制）。两部分互不阻塞。
