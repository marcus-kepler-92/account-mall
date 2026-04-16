# 销售看板 — 设计文档

**日期**：2026-03-17  
**状态**：已确认，待实现

---

## 目标

在 Admin Dashboard 顶部新增"销售看板"区块，支持按指定日期或日期区间查看每个商品的销量、营收和利润，方便快速了解当日/当期销售情况。

---

## 布局位置

`app/admin/(main)/dashboard/page.tsx` 第一个 `<section>` 之前，新增 `<DashboardSalesPanel />` Client Component。

---

## UI 结构

```
┌─────────────────────────────────────────────────────────┐
│ 销售看板                [今日][昨日][本周][本月]          │
│                         [开始日期] 至 [结束日期]          │
├──────────────┬──────────────┬──────────────┬────────────┤
│  总订单数    │   总营收     │   总利润     │ 已完成订单 │
│     42       │  ¥4,320      │  ¥3,956      │    38      │
├──────────────┴──────────────┴──────────────┴────────────┤
│ 商品名      销量   均价      营收     已结算佣金   利润  │
│ 王者荣耀…   34    ¥64.8    ¥2,203    ¥220       ¥1,983  │
│ 网易云…     28    ¥38      ¥1,064    ¥0         ¥1,064  │
│ ─────────────────────────────────────────────────────── │
│ 合计         78    —        ¥4,336    ¥380       ¥3,956  │
└─────────────────────────────────────────────────────────┘
```

### 日期选择器
- 快捷按钮：今日 / 昨日 / 本周（周一至今）/ 本月
- 自定义区间：两个日期 input（shadcn `<Input type="date">`）
- 默认值：今日（HKT）

### 汇总 KPI 行（4 个卡片）
| 指标 | 数据来源 |
|------|---------|
| 总订单数 | count(COMPLETED orders in range) |
| 总营收 | sum(order.amount) |
| 总利润 | 总营收 - 总已结算佣金 |
| 客单价 | 总营收 / 总订单数（无订单时显示 —） |

> 注：此看板仅统计 `status = COMPLETED` 的订单（已付款，`paidAt` 落在区间内）。

### 商品明细表（列定义）
| 列 | 说明 |
|----|------|
| 商品名 | `order.productNameSnapshot` fallback `product.name` |
| 销量 | `sum(order.quantity)`（卡密数量，非订单数） |
| 均价 | `sum(amount) / sum(quantity)`（实际成交均价） |
| 营收 | `sum(order.amount)` |
| 已结算佣金 | `sum(commission.amount)` where commission linked to orders in range |
| 利润 | 营收 - 已结算佣金 |

表格按**利润降序**排列，末行为合计行。

---

## 数据流

### API Route
**路径**：`GET /api/admin/sales-report`  
**参数**：`?from=YYYY-MM-DD&to=YYYY-MM-DD`（HKT 日期字符串）

**鉴权**：`getAdminSession()` — 仅管理员可访问

**查询逻辑**：
1. 将 `from` / `to` 转换为 UTC 时间范围（HKT = UTC+8）：
   - `startUTC = parseHKTDate(from)` → `from 00:00:00 HKT` 转 UTC
   - `endUTC = parseHKTDate(to) + 1 day` → `to 23:59:59 HKT` 的 UTC 上界（exclusive）
2. 查询 COMPLETED 订单：`paidAt >= startUTC AND paidAt < endUTC`
3. 通过 `orderId` join Commission，筛选 `status = SETTLED`（佣金日期不单独过滤，跟随关联订单的 `paidAt` 范围）
4. 按 `productId` 分组聚合

**响应结构**：
```ts
type SalesReportResponse = {
  summary: {
    orderCount: number
    revenue: number
    profit: number
    completedCount: number
  }
  products: Array<{
    productId: string
    productName: string
    quantity: number
    avgPrice: number
    revenue: number
    commission: number
    profit: number
  }>
}
```

### Client Component
**路径**：`app/admin/(main)/dashboard/dashboard-sales-panel.tsx`

- `"use client"`
- 用 `useState` 管理 `from` / `to`（默认今日 HKT）
- 用 `useQuery`（TanStack Query）fetch `/api/admin/sales-report?from=&to=`，key 包含日期
- 快捷按钮点击 → 更新 `from` / `to` → query 自动重新 fetch
- 加载中显示骨架，空数据显示"暂无数据"

---

## 利润定义

**利润 = 营收 - 已结算佣金**

- 只扣除 `Commission.status = SETTLED` 的佣金
- 通过 `Commission.orderId → Order.productId` 关联到商品
- 不涉及"成本价"，无需改动 Prisma schema

---

## 文件清单

### 新建
| 文件 | 说明 |
|------|------|
| `app/api/admin/sales-report/route.ts` | 销售报表 API |
| `app/admin/(main)/dashboard/dashboard-sales-panel.tsx` | 看板 Client Component |

### 修改
| 文件 | 修改内容 |
|------|---------|
| `app/admin/(main)/dashboard/page.tsx` | 在第一个 section 前引入 `<DashboardSalesPanel />` |

### 不改动
- Prisma schema（无需新增字段）
- `dashboard-data.ts`（现有 KPI 数据不受影响）
- 现有图表组件

---

## 边界条件

- `from > to`：API 返回 400；前端快捷按钮保证不会出现此情况，自定义输入需校验
- 日期区间内无订单：返回空 products 数组，summary 全为 0
- 商品已删除：使用 `productNameSnapshot` 展示历史名称
- 佣金为 0（无分销员）：利润 = 营收，正常显示
