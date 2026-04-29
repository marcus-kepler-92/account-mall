# Admin 订单详情卡密展示改造设计

**日期**: 2026-03-17  
**状态**: 已批准，待实现  
**作者**: Claude + 用户

---

## 背景

当前 admin 后台订单详情页（`/admin/orders/[orderId]`）的卡密表格存在两个问题：

1. 卡密列只显示掩码（前 8 字符 + `***`），完整内容藏在 Eye 图标的 Tooltip 里，且展示的是未经解析的原始字符串（如 `user@email.com----password123----friend`）
2. 表格布局对移动端不友好，没有适合触摸操作的交互模式

目标：结合卡密模版（CardTemplate）将内容解析为结构化字段，通过 Sheet 侧边抽屉展示，支持逐字段复制，兼容移动端。

---

## 方案选择

选择**方案 A：点击行 → Sheet**，放弃以下备选：
- 方案 B（仅改 Eye 图标为 Sheet）：移动端触摸面积过小
- 方案 C（行内 Accordion 展开）：破坏表格布局，多条展开时混乱

---

## 设计详情

### 1. 数据层（服务端，`page.tsx`）

**Prisma 查询新增字段**：

```typescript
product: {
  select: {
    id: true,
    name: true,
    slug: true,
    cardTemplates: {
      orderBy: { sortOrder: "asc" },
      select: { template: true }
    }
  }
}
```

**卡密序列化新增 `resolved` 字段**，服务端完成解析，逻辑：

1. 先用 `parseAutoFetchCardContent(content)` 判断是否为 AUTO_FETCH JSON 格式
   - 命中 → 将 account/password/region/birthday/密保等字段映射为 `{ type: "formatted", fields: [{label, value}] }`
2. 未命中 → 调用 `resolveCardFields(content, cardTemplates)` 
   - 有模版且匹配 → `{ type: "formatted", fields }`
   - 不匹配或无模版 → `{ type: "plain", content }`

```typescript
type SerializedCard = {
  id: string
  content: string
  maskedContent: string
  status: string
  createdAt: string   // ISO string，不能传 Date 对象给 Client Component
  productId: string
  resolved: ResolvedCard   // 新增
}
```

> **注意**：Next.js 不允许从 Server Component 向 Client Component 传递 `Date` 对象（非 plain object）。`createdAt` 需在 `page.tsx` 序列化为 ISO 字符串：`createdAt: c.createdAt.toISOString()`。`index` 不需存入类型，直接用 `cards.findIndex` 或数组下标即可。

### 2. 组件结构

```
app/admin/(main)/orders/[orderId]/
├── page.tsx                    # 改动：加载 cardTemplates，服务端解析，传入新组件
└── order-cards-table.tsx       # 新建：Client 组件，表格 + Sheet 状态管理
```

**`page.tsx` 改动**：
- Prisma include 加 `cardTemplates`
- `serializedCards` 映射加 `resolved` + `index`
- 卡密 Card 区块的表格 JSX 提取为 `<OrderCardsTable cards={serializedCards} />`

**`order-cards-table.tsx`**（Client Component）：
- 接收 `cards: SerializedCard[]`
- `useState<SerializedCard | null>(null)` 管理 `selectedCard`
- 表格行：`cursor-pointer` + `onClick={() => setSelectedCard(card)}`
- 保留 `CardCompactActions`（复制/停用/外链），移除其中的 Eye 图标按钮（Sheet 已覆盖该功能）
- Sheet：`open={!!selectedCard}`，`onOpenChange={(o) => !o && setSelectedCard(null)}`

### 3. Sheet 内容

**通用 Header**：
```
卡密 #N  [状态 Badge]
```

**格式化卡密（`type === "formatted"`）**：

```
┌──────────────────────────────────────┐
│ 卡密 #1  · 已售                      │
├──────────────────────────────────────┤
│ 账号   user@email.com      [Copy]    │
│ 密码   password123         [Copy]    │
│ 密保   bestfriend          [Copy]    │
├──────────────────────────────────────┤
│        [复制全部]                    │
└──────────────────────────────────────┘
```

- 每行：label（`text-muted-foreground shrink-0 w-20`）+ value（`font-mono break-all`）+ Copy 图标按钮（`size-8`）
- 「复制全部」格式：`账号：xxx\n密码：xxx\n...`

**纯文本卡密（`type === "plain"`）**：

```
┌──────────────────────────────────────┐
│ 卡密 #1  · 已售                      │
├──────────────────────────────────────┤
│ <code>完整原始内容（break-all）</code>│
├──────────────────────────────────────┤
│        [复制]                        │
└──────────────────────────────────────┘
```

**复制反馈**：
- 单字段复制：图标切换为 `Check`（emerald），2 秒后恢复，`toast.success("已复制")`
- 复制全部：`toast.success("已复制全部")`

### 4. 移动端适配

- Sheet `side="right"`，`className="w-full sm:max-w-md"`
- 字段行高度 `py-3`（足够触摸面积）
- value 区域 `break-all`，防长字符串溢出
- 复制按钮 `size-8`（32px），满足最小触摸目标

---

## 文件影响范围

| 文件 | 变更类型 |
|------|---------|
| `app/admin/(main)/orders/[orderId]/page.tsx` | 改动：加 cardTemplates 查询 + resolved 序列化 + 提取组件 |
| `app/admin/(main)/orders/[orderId]/order-cards-table.tsx` | 新建：Client 组件 |
| `app/admin/(main)/cards/card-row-actions.tsx` | 小改：`CardCompactActions` 移除 Eye 图标按钮 |

不涉及 API 路由、数据库 schema 或其他页面。

---

## 不在范围内

- 卡密列表页（`/admin/cards`）的展示改造
- 商品卡密页（`/admin/products/[id]/cards`）的展示改造
- 用户侧订单查询页的改动
