# Admin 通知系统重构设计

> 日期：2026-05-21
> 状态：待审阅

## 背景

当前 admin 后台通知能力分散且耦合：

- 顶栏 Bell 图标硬链到 `/admin/withdrawals?status=PENDING`，只反映提现一个维度
- 侧边栏「提现管理」「人工跟进」各自有 badge，由 `usePendingWithdrawals` / `usePendingLeads` 两个独立 hook 驱动
- 每加一类通知要写 3 处：独立 hook、独立 count API、各处 badge 渲染
- 仪表盘已展示的库存预警 / 到货提醒未接入 badge / Bell
- 子管理员的 `allowedMenus` 没作用到 badge

## 目标

1. Bell 改为聚合「通知中心」入口（Popover）：分类列出待办，含总数 + 最近 3 条摘要 + 「查看全部」链接
2. 抽象 NotificationSource 注册表，所有通知类型集中声明，新增类型只改一个文件
3. 一个聚合 API、一个前端 hook，同时驱动顶栏 Popover 与侧边栏 badge
4. 子管理员的 `allowedMenus` 联动过滤通知类型与 badge
5. 接入库存预警 / 到货提醒（合并为 inventoryAlerts 一类）

非目标：

- 已读 / 未读机制
- SSE / WebSocket 实时推送（继续用 30s 轮询 + 窗口聚焦重取）
- 系统告警 / auto-fetch 失败 / PENDING_CONTACT lead（YAGNI，未来按需加 source）

## 架构总览

```
lib/admin-notifications/
  index.ts                    类型 + SOURCES 注册表
  sources/
    withdrawals.ts            提现 source
    agent-leads.ts            客服 lead source
    inventory-alerts.ts       库存预警 source（合并缺货 + 低库存 + 到货提醒）

GET /api/admin/notifications  聚合 API
  ├─ 校验 admin session
  ├─ 拉 allowedMenus，过滤 SOURCES
  ├─ Promise.all 并行执行各 source.fetch()
  └─ 返回 { sources: SourceResult[] }

useAdminNotifications()       前端单一 hook（React Query, 30s, focus refetch）
  返回 { sources, totalCount, byKey }

NotificationCenterPopover     Bell 触发，展示分类列表
AdminSidebar                  通过 byKey[source] 渲染对应菜单项 badge
```

## 数据契约

### NotificationSource

```ts
type NotificationSource = {
  key: SourceKey
  label: string                   // "提现待审核"
  icon: LucideIcon                // 用于 Popover section header
  menuHref: string                // 用于 allowedMenus 过滤的菜单路径
  viewAllHref: string             // "查看全部" 跳转目标（含必要 query）
  fetch(prisma: PrismaClient): Promise<{
    count: number
    items: SummaryItem[]          // ≤3 条，每个 source 自己的强类型
  }>
}

type SourceKey = "withdrawals" | "agentLeads" | "inventoryAlerts"
```

### 各 source 的 item 强类型

```ts
type WithdrawalItem = {
  id: string
  distributorName: string
  amount: number
  createdAt: string  // ISO
}

type AgentLeadItem = {
  id: string
  displayName: string
  status: "NEW" | "CONTACTED"
  urgency: "LOW" | "MED" | "HIGH"
  createdAt: string
}

type InventoryAlertItem = {
  productId: string
  productName: string
  unsoldCount: number
  subscriberCount: number   // 到货提醒登记人数，0 = 没人登记
  subtype: "OUT_OF_STOCK" | "LOW_STOCK" | "RESTOCK_WAITING"
}
```

### SourceResult（API 响应单元）

```ts
type SourceResult =
  | { key: "withdrawals"; count: number; items: WithdrawalItem[] }
  | { key: "agentLeads"; count: number; items: AgentLeadItem[] }
  | {
      key: "inventoryAlerts"
      count: number          // 涉及商品数（去重）
      breakdown: {
        outOfStock: number
        lowStock: number
        restockWaiting: number
      }
      items: InventoryAlertItem[]
    }
```

## Source 实现要点

### withdrawals

- 查询：`Withdrawal.status = PENDING`
- count：总数
- items：`take 3, orderBy createdAt DESC`，include distributor 取 name
- viewAllHref：`/admin/withdrawals?status=PENDING`
- menuHref：`/admin/withdrawals`

### agentLeads

- 查询：`AgentLead.status ∈ {NEW, CONTACTED}`
- count：总数
- items 排序：`urgency = HIGH` 优先，其次 `createdAt DESC`，take 3
- viewAllHref：`/admin/agent/leads`
- menuHref：`/admin/agent/leads`

### inventoryAlerts

最复杂，需要合并三类信号。实现策略（一次查询拿全数据，JS 内合并）：

1. `card.groupBy({ by: productId, where: { status: UNSOLD }, _count: id })` → 各商品可售卡密数
2. `product.findMany({ where: { status: ACTIVE }, select: { id, name } })` → 活跃商品（阈值用全局常量 `LOW_STOCK_THRESHOLD`，与 dashboard 共用）
3. `restockSubscription.groupBy({ by: productId, where: { status: PENDING }, _count: id })` → 各商品待通知人数

JS 合并：

```ts
for product in activeProducts:
  unsold = unsoldMap[product.id] ?? 0
  subscribers = subscriberMap[product.id] ?? 0
  isOutOfStock = unsold === 0
  isLowStock = unsold > 0 && unsold < LOW_STOCK_THRESHOLD
  hasRestockWaiting = subscribers > 0 && unsold === 0

  if isOutOfStock || isLowStock || hasRestockWaiting:
    add to alerts
```

**count**：alerts 长度（去重）

**breakdown**（注意：按状态计，可重叠；total != sum）：

- `outOfStock`：unsold = 0 的商品数
- `lowStock`：0 < unsold < threshold 的商品数
- `restockWaiting`：unsold = 0 且 subscribers > 0 的商品数

**items 排序**（决定 Popover 里前 3 个看到什么）：

1. `OUT_OF_STOCK && subscriberCount > 0`（缺货且有人等，最紧急）
2. `OUT_OF_STOCK`（缺货）
3. `LOW_STOCK`（低库存）

排序键内再按 `subscriberCount DESC, unsoldCount ASC`。

- viewAllHref：`/admin/products?notice=inventory`
- menuHref：`/admin/products`

## API 设计

### `GET /api/admin/notifications`

```ts
// Response
{
  sources: SourceResult[]   // 返回所有 enabled source（含 count=0）
}
```

**为何含 count=0**：sidebar badge 需要明确 count=0 状态（隐藏 badge 而非"未加载"）。无权限的 source 才不出现在数组里。

**handler 流程**：

```ts
export async function GET() {
  const admin = await getAdminSession()
  if (!admin) return unauthorized()

  const perms = await getAdminPermissions()
  const allowed = perms?.allowedMenus  // null = 全部

  const enabled = SOURCES.filter(
    (s) => !allowed || allowed.includes(s.menuHref)
  )

  const results = await Promise.all(
    enabled.map(async (s) => ({
      key: s.key,
      ...(await s.fetch(prisma)),
    }))
  )

  return NextResponse.json({ sources: results })
}

export const runtime = "nodejs"
```

性能预算：聚合 API < 500ms（30s 轮询频率 + 并行 → 单次开销可接受）。

## 前端 Hook

```ts
// app/admin/hooks/use-admin-notifications.ts
export function useAdminNotifications() {
  const { data } = useQuery<{ sources: SourceResult[] }>({
    queryKey: ["admin", "notifications"],
    queryFn: () => fetch("/api/admin/notifications").then((r) => r.json()),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  })

  const sources = data?.sources ?? []
  const byKey = Object.fromEntries(sources.map((s) => [s.key, s])) as Partial<
    Record<SourceKey, SourceResult>
  >
  const totalCount = sources.reduce((sum, s) => sum + s.count, 0)

  return { sources, byKey, totalCount }
}
```

## UI 组件

### NotificationCenterPopover

- 触发器：Bell 图标按钮（保留现有视觉，移除原 `<Link>`，改为 `<PopoverTrigger asChild>`）
- 内容：shadcn `Popover` + `ScrollArea`，宽 ~380px，最大高 `calc(100vh - 6rem)`
- 空态：`totalCount === 0` 时显示「✨ 暂无待办」
- 非空态：按 SOURCES 注册顺序渲染 section，跳过 `count === 0`
- 每 section 结构：
  - Header: `<Icon /> {label} <NotificationBadge inline count={count} />`
  - `inventoryAlerts` 额外一行 breakdown 文案：`2 款缺货 · 1 款低库存 · 3 款等到货提醒`
  - Items：单行 truncate，按 source 类型 switch 渲染（switch 内是强类型）
  - `查看全部 → {viewAllHref}` 链接

### AdminTopbarActions（修改）

- 现 `<Link href="/admin/withdrawals?...">` Bell → 改为 `<PopoverTrigger>` 包 Bell
- Bell 角标：`totalCount > 0` 时显示 `NotificationBadge variant="dot"`

### AdminSidebar（修改）

- 删除 `usePendingWithdrawals` / `usePendingLeads` 引用
- 改用 `useAdminNotifications()`
- 新增对 `/admin/products` 菜单的 badge 渲染（消费 `byKey.inventoryAlerts.count`）
- 折叠 / 展开两种形态保留现有逻辑（`dot` vs `inline`）

### Products 页面（修改）

- `app/admin/(main)/products/page.tsx` 接收 `searchParams: Promise<{ notice?: string }>`
- `notice === "inventory"` 时把默认筛选条件传给 `ProductsTableWrapper`
- `ProductsTableWrapper` 接受 `defaultFilters` prop，初始化 TanStack Table state 时应用
- 筛选条件：`stock = 0`（缺货）OR `stock < LOW_STOCK_THRESHOLD`（低库存）OR 有 pending restock subscription
  - 简化方案：新增一列虚拟字段 `hasAlert: boolean`（page.tsx 计算并传给 row），筛选用此字段

## 权限联动

每个 source 的 `menuHref` 必须与 `lib/admin-permissions` 里的 menu list 一致：

- `withdrawals.menuHref = "/admin/withdrawals"`
- `agentLeads.menuHref = "/admin/agent/leads"`
- `inventoryAlerts.menuHref = "/admin/products"`

聚合 API 在 fetch 前根据 admin 的 `allowedMenus` 过滤 SOURCES，无权限的 source 完全不查 SQL、不出现在响应里 → 前端 `byKey[key]` 为 undefined → sidebar badge 自然不渲染。

## 弃用清单

直接删除：

- `app/admin/hooks/use-pending-withdrawals.ts`
- `app/admin/hooks/use-pending-leads.ts`
- `app/api/admin/withdrawals/count/route.ts`
- `app/api/admin/agent/leads/count/route.ts`

## 测试策略

### 单元测试

- `__tests__/lib/admin-notifications/sources.test.ts`
  - withdrawals: PENDING 计数正确、items take 3 排序、distributorName 注入正确
  - agentLeads: NEW + CONTACTED 计数、HIGH urgency 优先、items take 3
  - inventoryAlerts: 三种 subtype 识别、count 去重、breakdown 数值、排序顺序

### 集成测试

- `__tests__/api/admin-notifications.test.ts`
  - 未登录 → 401
  - allowedMenus = null → 返回全部 source
  - allowedMenus 不含 withdrawals → 响应不包含 withdrawals source
  - 并发请求多个 source 不互相阻塞（覆盖 Promise.all 行为）

### 视觉 / 交互验证

- 浏览器手动验证：Bell 点击 → Popover 弹出 → section 显示 → 「查看全部」跳转
- 空态：在 seed/test DB 把 4 类全清零，确认 Popover 显示「暂无待办」
- 子管理员账号登录 → Bell 只显示其 allowedMenus 内的类型

## 性能与新鲜度

- 轮询 30s（保持现状）
- `refetchOnWindowFocus: true`：切回 tab 重取
- `refetchOnMount: "always"`：导航刷新
- 聚合 API 内部 `Promise.all` 并行，每个 source 用 Prisma `groupBy` / `findMany` + take 3
- inventoryAlerts 最重，但仍为 3 个 query；预计冷启动 < 200ms

## 迁移与回退

- 本次改动是纯前端 + API + 抽象层重组，**不涉及 schema 变更，不产生 migration**
- 回退策略：单一 PR，回滚即恢复
- 不影响线上数据，无需数据迁移脚本

## 风险与缓解

| 风险 | 概率 | 缓解 |
|---|---|---|
| 聚合 API 单点失败导致所有 badge 消失 | 低 | source 内部 try/catch，单 source 失败不影响其他 |
| inventoryAlerts SQL 在商品多时慢 | 中 | 复用 `Card.status` 现有索引；商品数 < 1k 量级，groupBy 在毫秒级 |
| 子管理员能从 Popover 看到无权限页面的 badge | 已规避 | menuHref 与 allowedMenus 严格对齐 + 后端过滤 |
| Popover 在 mobile 屏窄被裁切 | 低 | 设宽度 max-w 与响应式适配 |
