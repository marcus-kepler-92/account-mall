# Account Mall — Developer Handbook

> 写任何功能前必读。本手册是本项目的唯一编码标准。

---

## 目录

1. [架构总览](#1-架构总览)
2. [领域模块规范](#2-领域模块规范)
3. [API Route 规范](#3-api-route-规范)
4. [表单规范](#4-表单规范)
5. [后台列表页规范](#5-后台列表页规范)
6. [URL 状态管理](#6-url-状态管理)
7. [认证与授权](#7-认证与授权)
8. [测试规范](#8-测试规范)
9. [常见反模式](#9-常见反模式)

---

## 1. 架构总览

```
account-mall/
├── app/              # 路由 + 页面 + 就近放置的路由专用组件
├── components/ui/    # shadcn/ui 原子组件（CLI 管理，不手改）
├── lib/
│   ├── domains/      # 领域模块（核心业务逻辑全在这里）
│   ├── shared/       # 跨域共享工具（新增时放这里）
│   ├── prisma.ts     # Prisma 单例
│   ├── auth*.ts      # 认证
│   ├── config*.ts    # 环境变量
│   └── api-response.ts
├── prisma/           # Schema + 迁移 + seed
└── __tests__/        # 仅放非领域测试（如 shared 工具）
```

**数据流向（单向）：**

```
HTTP Request
    ↓
API Route Handler          ← 只做：鉴权 + 校验 + 调 service + 返回
    ↓
Domain Service             ← 业务规则、编排、事务
    ↓
Domain Repository          ← 所有 Prisma 操作
    ↓
Database
```

---

## 2. 领域模块规范

> 完整设计见 `docs/superpowers/specs/2026-04-16-domain-architecture-design.md`

### 目录结构

每个领域模块是一个完整的自包含单元：

```
lib/domains/{domain}/
├── types.ts          # 领域类型 + 领域错误
├── validators.ts     # Zod schema（只校验形状）
├── repository.ts     # Prisma 操作（无业务逻辑）
├── service.ts        # 业务逻辑（调 repository）
├── index.ts          # 对外接口白名单
└── __tests__/
    ├── repository.test.ts
    └── service.test.ts
```

### types.ts

```typescript
import type { Prisma } from "@prisma/client"

// 实体类型
export type Card = Prisma.Card
export type CardStatus = "UNSOLD" | "SOLD" | "DISABLED"

// 输入/输出契约
export type CreateCardInput = { productId: string; code: string; password?: string }

// 领域错误
export class InsufficientStockError extends Error {
  constructor() { super("Insufficient card stock") }
}
```

### repository.ts

- 只做数据读写，不做"能不能操作"的判断
- 所有写函数必须接受可选 `tx` 参数

```typescript
import { prisma } from "@/lib/prisma"
import type { PrismaClient } from "@prisma/client"

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

export async function findCardById(id: string, tx?: Tx) {
  return (tx ?? prisma).card.findUnique({ where: { id } })
}

export async function updateCardStatus(id: string, status: CardStatus, tx?: Tx) {
  return (tx ?? prisma).card.update({ where: { id }, data: { status } })
}
```

### service.ts

- 业务规则、条件判断、副作用全在这里
- 多步写操作**必须**用 `prisma.$transaction`

```typescript
import { prisma } from "@/lib/prisma"
import { findUnsoldCard, updateCardStatus, assignCardToOrder } from "./repository"
import { InsufficientStockError } from "./types"

export async function allocateCard(orderId: string, productId: string) {
  return prisma.$transaction(async (tx) => {
    const card = await findUnsoldCard(productId, tx)
    if (!card) throw new InsufficientStockError()
    await updateCardStatus(card.id, "SOLD", tx)
    await assignCardToOrder(card.id, orderId, tx)
    return card
  })
}
```

### index.ts — 必须维护

只 export 允许外部使用的内容。**repository 函数不对外暴露。**

```typescript
export { allocateCard, getCardsByProduct } from "./service"
export { createCardSchema } from "./validators"
export type { Card, CreateCardInput } from "./types"
export { InsufficientStockError } from "./types"
```

### 跨域调用规则

```typescript
// ✅ 正确：通过 index.ts 调用
import { allocateCard } from "@/lib/domains/cards"

// ❌ 禁止：穿透进内部文件
import { findUnsoldCard } from "@/lib/domains/cards/repository"
```

谁拥有数据，谁负责写操作。跨域编排逻辑放在调用方的 service 里，不建第三个编排层。

---

## 3. API Route 规范

### 标准模板（4 步，≤20 行）

```typescript
import { NextRequest } from "next/server"
import { badRequest, unauthorized, validationError } from "@/lib/api-response"
import { getAdminSession } from "@/lib/auth-guard"
import { createCardSchema, createCards } from "@/lib/domains/cards"

export async function POST(req: NextRequest) {
  // 1. 鉴权
  const session = await getAdminSession()
  if (!session) return unauthorized()

  // 2. 解析 + 校验
  const body = await req.json()
  const result = createCardSchema.safeParse(body)
  if (!result.success) return validationError(result.error)

  // 3. 调 service
  const cards = await createCards(result.data)

  // 4. 返回
  return Response.json({ cards })
}
```

### 可用响应函数（来自 `lib/api-response.ts`）

| 函数 | HTTP 状态 |
|------|-----------|
| `unauthorized()` | 401 |
| `badRequest(msg)` | 400 |
| `notFound(msg)` | 404 |
| `conflict(msg)` | 409 |
| `validationError(details)` | 400 + VALIDATION_FAILED code |
| `internalServerError()` | 500 |

### 领域错误处理

```typescript
import { InsufficientStockError } from "@/lib/domains/cards"

try {
  await allocateCard(orderId, productId)
} catch (e) {
  if (e instanceof InsufficientStockError) return badRequest("库存不足")
  throw e  // 未知错误向上抛，不吞掉
}
```

### 批量操作约定

- 路由：`POST /api/{resource}/batch`
- Body：`{ action: "DELETE" | "DISABLE" | "ENABLE", ids: string[] }`
- 响应：`{ success: number, skipped?: number, errors?: string[] }`

---

## 4. 表单规范

### 基本结构

```typescript
// 1. Schema 在 lib/domains/{domain}/validators.ts 定义
// 2. 组件用 useForm + zodResolver
// 3. 服务端校验失败用 applyFieldErrors 映射到表单字段

const form = useForm<z.infer<typeof createProductSchema>>({
  resolver: zodResolver(createProductSchema),
})
```

### 字段渲染（必须用 shadcn FormField）

```tsx
<FormField
  control={form.control}
  name="price"
  render={({ field }) => (
    <FormItem>
      <FormLabel>价格</FormLabel>
      <FormControl>
        <Input type="number" {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### 大型表单拆分

表单超 ~200 行时，按区块拆子组件，用 `useFormContext()` 读 form 状态：

```tsx
// 子组件
export function ProductFormPricingFields() {
  const { control } = useFormContext()
  // ...
}

// 父组件
const form = useForm(...)
return (
  <FormProvider {...form}>
    <ProductFormPricingFields />
  </FormProvider>
)
```

---

## 5. 后台列表页规范

每个列表页的标准文件结构：

```
app/admin/(main)/{resource}/
├── page.tsx                    # 服务端数据获取 + 页面布局
├── {resource}-columns.tsx      # ColumnDef[] + Row 类型导出
├── {resource}-data-table.tsx   # useReactTable + Toolbar + Pagination
├── {resource}-row-actions.tsx  # 行操作（DropdownMenu + 确认弹窗）
├── {resource}-filters.ts       # URL 参数解析（服务端分页时）
└── loading.tsx
```

### 数据模式选择

| 场景 | 模式 | 特征 |
|------|------|------|
| 数据量 <100 | 客户端过滤 | `getFilteredRowModel()` + `getSortedRowModel()` |
| 数据量可增长 | 服务端分页 | `manualPagination: true`, `searchParams` 驱动 |

### Next.js 16 searchParams

`page.tsx` 的 `searchParams` 是 Promise，必须先 await：

```typescript
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  // ...
}
```

### columns.tsx 规范

```typescript
import type { ColumnDef } from "@tanstack/react-table"
import { formatCurrency, formatDateTime } from "@/lib/utils"

export type CardRow = { id: string; code: string; status: CardStatus; createdAt: Date }

export const columns: ColumnDef<CardRow>[] = [
  // ...
]
```

- 只放 `ColumnDef` 定义，不放有状态组件
- 用 `getRowId: (row) => row.id`
- 货币用 `formatCurrency()`，日期用 `formatDateTime()`

### row-actions.tsx 规范

```tsx
// 触发按钮
<Button variant="ghost" size="icon" className="size-8">
  <MoreHorizontal className="size-4" />
</Button>

// 破坏性操作用 AlertDialog
// 非破坏性操作用 Dialog
// 操作后 router.refresh()
```

---

## 6. URL 状态管理

以 URL 为单一数据源，不用 `useState` 复制 URL 参数：

```typescript
// ✅ 正确：从 URL 派生状态
const searchParams = useSearchParams()
const tag = searchParams.get("tag") ?? ""

// ❌ 禁止：用 useState 同步 URL 参数
const [tag, setTag] = useState(searchParams.get("tag") ?? "")
```

更新 URL 只在事件处理函数里做，不用 `useEffect`：

```typescript
function handleTagChange(value: string) {
  const params = new URLSearchParams(searchParams.toString())
  params.set("tag", value)
  router.replace(`${pathname}?${params.toString()}`, { scroll: false })
}
```

`useSearchParams()` 的客户端组件，父级 `page.tsx` 必须用 `<Suspense>` 包裹。

---

## 7. 认证与授权

### 三层防线

| 层 | 文件 | 职责 |
|----|------|------|
| 网络边界 | `proxy.ts` | Cookie 检查，粗粒度路由守卫 |
| 布局守卫 | `admin/(main)/layout.tsx` | 角色校验，未授权则重定向 |
| API 守卫 | 每个受保护的 route handler | session + 角色双重校验 |

### API 中的用法

```typescript
import { getAdminSession, getSuperAdminSession } from "@/lib/auth-guard"

// 普通 admin（SUPER_ADMIN + SYSTEM_OPS）
const session = await getAdminSession()
if (!session) return unauthorized()

// 仅 super admin
const session = await getSuperAdminSession()
if (!session) return unauthorized()
```

---

## 8. 测试规范

### 文件位置

- 领域模块测试：`lib/domains/{domain}/__tests__/`
- 共享工具测试：`__tests__/lib/`
- E2E 测试：`e2e/`

### service 测试模式

```typescript
jest.mock("../repository")
import { findUnsoldCard } from "../repository"
import { allocateCard } from "../service"
import { InsufficientStockError } from "../types"

it("throws InsufficientStockError when no unsold card", async () => {
  (findUnsoldCard as jest.Mock).mockResolvedValue(null)
  await expect(allocateCard("order-1", "product-1")).rejects.toThrow(InsufficientStockError)
})
```

### 约定

- 实现功能时同步交付测试
- 修 bug 前先写能复现的失败测试
- 声称测试通过前必须实际运行

---

## 9. 常见反模式

### ❌ Route Handler 含业务逻辑

```typescript
// 错误：业务判断放在 route handler 里
export async function POST(req: NextRequest) {
  const card = await prisma.card.findFirst({ where: { status: "UNSOLD" } })
  if (!card) return badRequest("无可用卡密")
  await prisma.card.update({ where: { id: card.id }, data: { status: "SOLD" } })
  // ...
}
```

→ 业务逻辑移到 `service.ts`，route handler 只调 service。

---

### ❌ 穿透领域边界

```typescript
// 错误
import { findUnsoldCard } from "@/lib/domains/cards/repository"

// 正确
import { allocateCard } from "@/lib/domains/cards"
```

---

### ❌ 多步写操作不用事务

```typescript
// 错误：非原子
await updateCardStatus(card.id, "SOLD")
await assignCardToOrder(card.id, orderId)

// 正确
await prisma.$transaction(async (tx) => {
  await updateCardStatus(card.id, "SOLD", tx)
  await assignCardToOrder(card.id, orderId, tx)
})
```

---

### ❌ useState 同步 URL 参数

```typescript
// 错误
const [page, setPage] = useState(Number(searchParams.get("page")) || 1)

// 正确：直接从 URL 读
const page = Number(searchParams.get("page")) || 1
```

---

### ❌ 用原生 input 代替 shadcn 组件

```tsx
// 错误
<input type="radio" name="type" value="alipay" />

// 正确
<RadioGroup>
  <RadioGroupItem value="alipay" />
</RadioGroup>
```

---

### ❌ 在 "use client" 文件导入服务端模块

```typescript
// 错误（会导致构建失败）
"use client"
import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"

// 正确：客户端用 config-client.ts
import { clientConfig } from "@/lib/config-client"
```
