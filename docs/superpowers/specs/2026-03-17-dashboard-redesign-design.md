# Dashboard 重设计：销量 / 利润 / 邀请里程碑三看板

**日期**：2026-03-17  
**状态**：已确认，待实现

---

## 背景与目标

当前 `/admin/dashboard` 将销量、利润、分销数据混在一个长页面，且：

- 「利润」计算缺少采购成本，数字失真
- 邀请里程碑数据完全没有独立呈现（`milestoneBonus` 埋在 sales-report 里）
- 销售里程碑与邀请里程碑逻辑混合，管理员无法独立配置和观察

目标：从产品数据价值出发，清晰分离三个决策视角，并补全成本追踪使利润数据真实可信。

---

## 一、导航与页面结构

**侧边栏**：保留「仪表盘」单入口，URL `/admin/dashboard`，不增加条目。

**页面布局（Option C：全局头 + Tabs）**：

```
/admin/dashboard?view=sales|profit|milestones  （默认 sales）

┌─────────────────────────────────────────────────────┐
│  全局 KPI 头（SSR，今日快照，不随 Tab 时段变化）       │
│  今日营收 | 今日净利润⚠ | 今日订单 | 库存预警         │
├─────────────────────────────────────────────────────┤
│  [📊 销量]  [💰 利润]  [🏅 里程碑]                  │
├─────────────────────────────────────────────────────┤
│  Tab 内容                                            │
└─────────────────────────────────────────────────────┘
```

**Tab URL 状态**：Client Component 用 `useSearchParams` 读 `view` 参数，切换用 `router.replace(pathname + '?view=xxx', { scroll: false })`，不刷新整页，支持直接分享链接。

**废弃**：`DashboardSalesPanel`、`DashboardDistributorPanel` 拆解重组，不再作为独立组件。

---

## 二、成本追踪

### 2.1 Schema

```prisma
model Product {
  // 新增：每张卡密采购成本，null = 未设置
  costPerUnit  Decimal?  @db.Decimal(10, 2)
}

model Order {
  // 新增：完成时从 product.costPerUnit 快照，null = 下单时未设成本
  costSnapshot  Decimal?  @db.Decimal(10, 2)
}
```

**快照必要性**：`costPerUnit` 会随时间变化，若直接用商品当前成本回算历史订单，利润数据失真。`costSnapshot` 与现有 `unitPriceSnapshot` 设计一致。

### 2.2 写入时机

在 `completePendingOrder`（`lib/complete-pending-order.ts`）的事务中，`order.updateMany` 时同时写入 `costSnapshot`：

```typescript
// 在 updateMany data 中补充
costSnapshot: product.costPerUnit ?? null,
```

需要在该函数中预先 select `product.costPerUnit`。

### 2.3 利润计算公式

```
真实利润 = 营收 − Σ(quantity × costSnapshot) − 分销佣金 − 里程碑奖金
```

- 订单 `costSnapshot` 为 null → 该订单不计入成本，利润行显示「未设成本」
- 任意商品成本未设置 → 利润总计旁加 ⚠ 标注「部分成本未录入，利润偏高」

### 2.4 Product 表单

商品创建/编辑页加「采购成本（每张卡密）」可选数字输入框，留空等同 null。

---

## 三、全局 KPI 头

SSR 渲染（`page.tsx` 直接查 Prisma），今日 HKT 范围，不受 Tab 时段影响。

| 指标 | 计算 | 异常状态 |
|------|------|---------|
| 今日营收 | `sum(order.amount)` WHERE paidAt = today, status = COMPLETED | — |
| 今日净利润 | 营收 − 成本 − 佣金 − 里程碑奖金 | 有 null costSnapshot → 加 ⚠ |
| 今日订单数 | `count` WHERE paidAt = today, status = COMPLETED | — |
| 库存预警 | UNSOLD count < 3 的商品数 | > 0 → 红色，点击跳销量 Tab |

---

## 四、销量 Tab

**回答**：我卖出去多少？哪些商品跑量？库存够不够？

### 时段选择器

今日 / 昨日 / 本周 / 本月 / 自定义日期范围（复用 HKT 工具函数）。

### KPI 行（4 卡）

| 指标 | 计算 | 备注 |
|------|------|------|
| 订单数 | COMPLETED count | 含环比 ↑↓% vs 上一同等时段 |
| 卡密销量 | `sum(order.quantity)` | 含环比 |
| 均单价 | revenue ÷ orderCount | 含环比 |
| 作废率 | CLOSED ÷ (COMPLETED + CLOSED) | > 15% 标红；分母排除仍在 PENDING 的订单 |

### 内容区

1. **近 30 日订单趋势**：折线图，展示订单数（不含营收，营收在利润 Tab）
2. **商品跑量排行**：按 `sum(quantity)` 降序（非营收），展示销量 + 当前库存，库存 < 3 标红
3. **库存预警 + 催货记录**：并排两列
4. **最近 10 笔订单 feed**：orderNo / 商品 / 金额 / 状态 / 时间

---

## 五、利润 Tab

**回答**：我实际赚了多少？哪里在侵蚀利润？哪个商品最值钱？

### 时段选择器

同销量 Tab。

### KPI 行（6 卡）

| 指标 | 计算 |
|------|------|
| 总营收 | `sum(order.amount)` COMPLETED |
| 采购成本 | `sum(order.quantity × costSnapshot)`，null → 显示「—」 |
| 佣金支出 | 期间 commission 总额（status ≠ CANCELLED） |
| 里程碑奖金 | 期间 `invitationMilestoneBonus.amount` 总额 |
| 净利润 | 营收 − 成本 − 佣金 − 奖金，有 null costSnapshot → 加 ⚠ |
| 利润率 % | 净利润 ÷ 营收 |

### 内容区

1. **利润瀑布**（静态 breakdown）：
   ```
   营收         ¥X
   − 采购成本   −¥X
   − 佣金支出   −¥X
   − 里程碑奖金 −¥X
   ─────────────────
   净利润        ¥X  (利润率 %)
   ```

2. **趋势图**：近 30 日营收柱 + 净利润柱 + 利润率折线（双轴）

3. **商品利润明细表**：商品 / 营收 / 成本 / 佣金 / 净利润 / 利润率%，按净利润降序，未设成本行标注「—」

4. **分销员贡献排行**（从 DistributorPanel 迁入，取 top 10）：分销员 / 贡献营收 / 期间佣金，链接到分销员详情

5. **待处理提现 banner**（从 `DashboardPendingWithdrawals` 迁入）：有待审提现时显示金额 + 笔数 + 跳转链接

### API

`GET /api/admin/sales-report?from=&to=` 扩展，返回新增字段：
- `summary.totalCost`：期间采购成本总额
- `products[].cost`：各商品成本合计
- `products[].margin`：各商品利润率

分销员贡献数据：复用 `GET /api/admin/distributor-report?from=&to=`，仅使用其 `leaderboard` 字段；`summary.unpaidBalance` 挪到利润 Tab 的待处理提现区域。

---

## 六、里程碑 Tab

**回答**：谁在帮我拉人？谁快触发奖金了？我的分销网络在增长吗？

里程碑 Tab 分为两个独立 sub-section，同页展示（无需再切子 Tab）。

### 全局统计（4 卡，累计/当前）

| 指标 | 计算 |
|------|------|
| 总分销员 | 全部 DISTRIBUTOR role 且未禁用 |
| 本月新增 | createdAt >= 本月第一天 |
| 里程碑奖金累计 | 全部 `invitationMilestoneBonus.amount` 总和 |
| 已触发里程碑次数 | `invitationMilestoneBonus` 总行数 |

### 6.1 邀请里程碑（type: INVITATION）

**触发逻辑**：inviter 的 active invitees 数量 ≥ `thresholdCount`（与销售额无关）

**触发时机**：新分销员**注册成功**时调用（非订单完成时），需在注册流程中加调用点。

展示内容：
- 档位总览表：门槛人数 / 奖金 / 已触发人数
- 邀请排行榜（top 20）：已邀人数 / 当前档位 / 距下一档进度条
- ⚡ 即将触发提示：差 ≤ 2 人的邀请人

### 6.2 销售里程碑（type: SALES）

**触发逻辑**：inviter 的全部 active invitees 累计销售额（COMPLETED orders） ≥ `thresholdAmount`

**触发时机**：invitee **订单完成**时调用（保持现有调用点，但逻辑按 type 分支）

展示内容：
- 档位总览表：门槛销售额 / 奖金 / 已触发人数
- 销售排行榜（top 20）：团队销售额 / 当前档位 / 距下一档进度条
- ⚡ 即将触发提示：距门槛 ≤ 20% 的邀请人

### 新增分销员 Feed

时段：本月（固定），展示最近加入的分销员 + 来自谁（inviter）。

### API

新增 `GET /api/admin/milestone-report` 返回：
- 全局统计 4 卡
- `invitation.tiers`：各档位配置 + 触发人数
- `invitation.leaderboard`：邀请人 / invitees count / 当前档 / 下一档差值（top 20）
- `sales.tiers`：各档位配置 + 触发人数
- `sales.leaderboard`：邀请人 / 团队销售额 / 当前档 / 下一档差值（top 20）
- `newDistributors`：本月新增列表

**性能**：两个排行榜均限 top 20；`Order` 表 `distributorId` 索引已存在，查询可走索引。

---

## 七、Schema 变更汇总

```prisma
// 1. Product 加采购成本
model Product {
  costPerUnit  Decimal?  @db.Decimal(10, 2)
}

// 2. Order 加成本快照
model Order {
  costSnapshot  Decimal?  @db.Decimal(10, 2)
}

// 3. 里程碑类型枚举
enum MilestoneType {
  INVITATION   // 以邀请人数为门槛
  SALES        // 以团队累计销售额为门槛
}

model InvitationMilestone {
  type  MilestoneType  @default(INVITATION)
}
```

**迁移策略**：
- 现有 `InvitationMilestone` 数据默认 `type = INVITATION`（`@default`，无需 backfill）
- `Order.costSnapshot` 默认 null，历史订单不追溯（显示「—」或标注「历史数据无成本」）

---

## 八、触发逻辑重构（milestone-service.ts）

`checkAndIssueMilestoneBonuses` 按 `type` 分支：

```typescript
// INVITATION 类型
// 条件：count(active invitees) >= milestone.thresholdCount
const inviteeCount = await tx.user.count({
  where: { inviterId, role: "DISTRIBUTOR", disabledAt: null }
})
if (inviteeCount >= milestone.thresholdCount) { /* issue bonus */ }

// SALES 类型
// 条件：sum(invitees 的 COMPLETED order amount) >= milestone.thresholdAmount
const result = await tx.order.aggregate({
  where: { distributorId: { in: inviteeIds }, status: "COMPLETED" },
  _sum: { amount: true }
})
if (result._sum.amount >= milestone.thresholdAmount) { /* issue bonus */ }
```

**新增调用点**（INVITATION 专用）：分销员注册成功后，调用 `checkAndIssueInvitationMilestoneBonuses(tx, newUserId)`，仅处理 `type = INVITATION` 的里程碑。

---

## 九、文件改动列表

### 新建
| 文件 | 说明 |
|------|------|
| `app/admin/(main)/dashboard/dashboard-global-kpi.tsx` | 全局 KPI 头，SSR props 注入 |
| `app/admin/(main)/dashboard/dashboard-sales-tab.tsx` | 销量 Tab |
| `app/admin/(main)/dashboard/dashboard-profit-tab.tsx` | 利润 Tab |
| `app/admin/(main)/dashboard/dashboard-milestone-tab.tsx` | 里程碑 Tab |
| `app/api/admin/milestone-report/route.ts` | 里程碑 Tab 数据 API |

### 修改
| 文件 | 改动内容 |
|------|---------|
| `app/admin/(main)/dashboard/page.tsx` | 重组为全局 KPI + Tab 框架 |
| `app/admin/(main)/dashboard/dashboard-data.ts` | 加全局 KPI 查询，成本计算 |
| `app/api/admin/sales-report/route.ts` | 返回 totalCost / cost / margin 字段 |
| `app/components/product-form.tsx` | 加 costPerUnit 字段 |
| `app/admin/(main)/invitation-milestones/` | CRUD 表单加 type 选择器；列表加 type 列 |
| `lib/complete-pending-order.ts` | 写入 `costSnapshot`；调用 SALES 里程碑触发 |
| `lib/domains/distributors/milestone-service.ts` | 分支触发逻辑；新增 INVITATION 专用触发函数 |
| `lib/domains/distributors/validators.ts` | `createMilestoneSchema` / `updateMilestoneSchema` 加 `type` 字段 |
| `prisma/schema.prisma` | 4 处变更（见 Section 七） |
| `lib/domains/distributors/service.ts` → `acceptInvite` | 注册成功后调用 INVITATION 里程碑检查 |

### 删除
| 文件 | 原因 |
|------|------|
| `app/admin/(main)/dashboard/dashboard-sales-panel.tsx` | 拆入 sales-tab + profit-tab |
| `app/admin/(main)/dashboard/dashboard-distributor-panel.tsx` | 拆入 profit-tab + milestone-tab |

---

## 十、已知限制

- **历史订单无成本数据**：`costSnapshot` 仅从现在起记录，历史订单利润计算不含成本，利润看板对历史时段会标注「历史数据无采购成本」
- **成本粒度**：按商品 SKU 维度，不支持同一商品不同批次的成本差异
- **排行榜实时性**：`milestone-report` 不做缓存，数据量大时查询耗时可能增加，后续可按需加缓存
