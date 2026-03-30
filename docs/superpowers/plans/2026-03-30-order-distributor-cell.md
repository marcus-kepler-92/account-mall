# Order Distributor Inline Cell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 订单列表「分销员」列变为可内联编辑的 Popover+Command 选择器，支持搜索和清除，选中后二次确认再提交。

**Architecture:** 新增独立 API endpoint 处理 distributorId 更新；`ordersColumns` 改为接受 distributors 列表的工厂函数；新建 `OrderDistributorCell` 客户端组件实现两步式 Popover（选择 → 确认）。

**Tech Stack:** Next.js 16 App Router, shadcn/ui (Popover + Command), TanStack Table, Prisma, Zod, react-hook-form (无), router.refresh()

---

## File Map

| 文件 | 操作 | 职责 |
|------|------|------|
| `app/api/admin/orders/[orderId]/distributor/route.ts` | **新建** | PATCH 更新订单 distributorId（可 null） |
| `app/admin/(main)/orders/order-distributor-cell.tsx` | **新建** | 内联 Popover+Command 选择器，两步式确认 |
| `app/admin/(main)/orders/orders-columns.tsx` | **修改** | `ordersColumns` → `createOrdersColumns(distributors)` 工厂函数 |
| `app/admin/(main)/orders/orders-data-table.tsx` | **修改** | 接收 `distributors` prop，调用工厂函数 |
| `app/admin/(main)/orders/page.tsx` | **修改** | 查询所有分销员，传给 `OrdersDataTable` |

---

## Task 1: API endpoint — PATCH distributor

**Files:**
- Create: `app/api/admin/orders/[orderId]/distributor/route.ts`

- [ ] **Step 1: 写失败测试**

创建 `__tests__/api/admin/orders/distributor.test.ts`：

```typescript
import { PATCH } from "@/app/api/admin/orders/[orderId]/distributor/route"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { NextRequest } from "next/server"

jest.mock("@/lib/prisma", () => ({ prisma: { order: { findUnique: jest.fn(), update: jest.fn() }, user: { findUnique: jest.fn() } } }))
jest.mock("@/lib/auth-guard", () => ({ getAdminSession: jest.fn() }))

const mockSession = { user: { id: "admin-1" } }
const mockOrder = { id: "order-1", distributorId: null }
const mockDistributor = { id: "dist-1", role: "DISTRIBUTOR" }

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/orders/order-1/distributor", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
  ;(prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder)
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockDistributor)
  ;(prisma.order.update as jest.Mock).mockResolvedValue({ ...mockOrder, distributorId: "dist-1" })
})

describe("PATCH /api/admin/orders/[orderId]/distributor", () => {
  it("returns 401 when not admin", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const res = await PATCH(makeRequest({ distributorId: "dist-1" }), { params: Promise.resolve({ orderId: "order-1" }) })
    expect(res.status).toBe(401)
  })

  it("sets distributorId on order", async () => {
    const res = await PATCH(makeRequest({ distributorId: "dist-1" }), { params: Promise.resolve({ orderId: "order-1" }) })
    expect(res.status).toBe(200)
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { distributorId: "dist-1" },
    })
  })

  it("clears distributorId when null", async () => {
    const res = await PATCH(makeRequest({ distributorId: null }), { params: Promise.resolve({ orderId: "order-1" }) })
    expect(res.status).toBe(200)
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { distributorId: null },
    })
  })

  it("returns 404 when order not found", async () => {
    ;(prisma.order.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await PATCH(makeRequest({ distributorId: "dist-1" }), { params: Promise.resolve({ orderId: "order-1" }) })
    expect(res.status).toBe(404)
  })

  it("returns 400 when distributorId references non-distributor user", async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "dist-1", role: "ADMIN" })
    const res = await PATCH(makeRequest({ distributorId: "dist-1" }), { params: Promise.resolve({ orderId: "order-1" }) })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx jest __tests__/api/admin/orders/distributor.test.ts -v
```

Expected: FAIL — Cannot find module `@/app/api/admin/orders/[orderId]/distributor/route`

- [ ] **Step 3: 实现 API endpoint**

```typescript
// app/api/admin/orders/[orderId]/distributor/route.ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import {
  unauthorized,
  notFound,
  invalidJsonBody,
  validationError,
  badRequest,
} from "@/lib/api-response"

const schema = z.object({
  distributorId: z.string().nullable(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { orderId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalidJsonBody()
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const { distributorId } = parsed.data

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) return notFound("Order not found")

  if (distributorId !== null) {
    const user = await prisma.user.findUnique({ where: { id: distributorId } })
    if (!user || user.role !== "DISTRIBUTOR") {
      return badRequest("Invalid distributor")
    }
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { distributorId },
  })

  return NextResponse.json({ ok: true })
}

export const runtime = "nodejs"
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx jest __tests__/api/admin/orders/distributor.test.ts -v
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/orders/[orderId]/distributor/route.ts __tests__/api/admin/orders/distributor.test.ts
git commit -m "feat: add PATCH /api/admin/orders/[orderId]/distributor endpoint"
```

---

## Task 2: OrderDistributorCell 组件

**Files:**
- Create: `app/admin/(main)/orders/order-distributor-cell.tsx`

- [ ] **Step 1: 确认 shadcn Command + Popover 已安装**

```bash
ls components/ui/command.tsx components/ui/popover.tsx
```

Expected: 两个文件都存在（已确认）

- [ ] **Step 2: 新建组件文件**

```typescript
// app/admin/(main)/orders/order-distributor-cell.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, ChevronsUpDown, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"

export type DistributorOption = {
  id: string
  name: string
  distributorCode: string | null
}

interface OrderDistributorCellProps {
  orderId: string
  distributor: { id: string; name: string; distributorCode: string | null } | null
  distributors: DistributorOption[]
}

type Step = "select" | "confirm"

export function OrderDistributorCell({
  orderId,
  distributor,
  distributors,
}: OrderDistributorCellProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("select")
  const [pending, setPending] = useState<DistributorOption | null | "clear">(null)
  const [loading, setLoading] = useState(false)

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setStep("select")
      setPending(null)
    }
  }

  const handleSelect = (selected: DistributorOption | "clear") => {
    setPending(selected)
    setStep("confirm")
  }

  const handleConfirm = async () => {
    const distributorId = pending === "clear" ? null : (pending as DistributorOption).id
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/distributor`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ distributorId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? "操作失败")
        return
      }
      toast.success(pending === "clear" ? "已清除分销员" : "已更新分销员")
      setOpen(false)
      router.refresh()
    } catch {
      toast.error("操作失败")
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    setStep("select")
    setPending(null)
  }

  const displayName =
    distributor ? (
      <div className="flex flex-col text-xs">
        <span>{distributor.name}</span>
        {distributor.distributorCode && (
          <span className="text-muted-foreground font-mono">{distributor.distributorCode}</span>
        )}
      </div>
    ) : (
      <span className="text-muted-foreground">—</span>
    )

  const confirmLabel =
    pending === "clear"
      ? "清除分销员"
      : pending
        ? (pending as DistributorOption).name
        : ""

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center justify-between gap-1 rounded px-1 py-0.5 text-left text-sm",
            "hover:bg-accent hover:text-accent-foreground transition-colors",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          )}
        >
          {displayName}
          <ChevronsUpDown className="size-3 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-56 p-0" align="start">
        {step === "select" ? (
          <Command>
            <CommandInput placeholder="搜索分销员..." />
            <CommandList>
              <CommandEmpty>无匹配结果</CommandEmpty>
              {distributor && (
                <>
                  <CommandGroup>
                    <CommandItem
                      value="__clear__"
                      onSelect={() => handleSelect("clear")}
                      className="text-muted-foreground"
                    >
                      <X className="size-4" />
                      清除分销员
                    </CommandItem>
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}
              <CommandGroup heading="分销员">
                {distributors.map((d) => (
                  <CommandItem
                    key={d.id}
                    value={`${d.name} ${d.distributorCode ?? ""}`}
                    onSelect={() => handleSelect(d)}
                  >
                    <Check
                      className={cn(
                        "size-4 shrink-0",
                        distributor?.id === d.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{d.name}</span>
                      {d.distributorCode && (
                        <span className="text-xs text-muted-foreground font-mono">
                          {d.distributorCode}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <div className="p-3 space-y-3">
            <p className="text-sm">
              确认将分销员改为{" "}
              <span className="font-medium">
                {pending === "clear" ? "（无）" : confirmLabel}
              </span>
              ？
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBack}
                disabled={loading}
              >
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={loading}
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                确认
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/(main)/orders/order-distributor-cell.tsx
git commit -m "feat: add OrderDistributorCell inline editor component"
```

---

## Task 3: 修改 orders-columns.tsx

**Files:**
- Modify: `app/admin/(main)/orders/orders-columns.tsx`

- [ ] **Step 1: 将 `ordersColumns` 改为工厂函数**

将文件中：
```typescript
import { OrderRowActions } from "./order-row-actions"
```
改为：
```typescript
import { OrderRowActions } from "./order-row-actions"
import { OrderDistributorCell, type DistributorOption } from "./order-distributor-cell"
```

将 `export const ordersColumns: ColumnDef<OrderRow>[] = [` 替换为：
```typescript
export function createOrdersColumns(distributors: DistributorOption[]): ColumnDef<OrderRow>[] {
  return [
```

在文件末尾 `]` 改为 `] }` （关闭数组和函数体）。

将 distributor 列的 `cell` 由当前静态渲染：
```typescript
cell: ({ row }) => {
    const d = row.original.distributor
    if (!d) return <span className="text-muted-foreground">—</span>
    return (
        <div className="flex flex-col text-xs">
            <span>{d.name}</span>
            {d.distributorCode && (
                <span className="text-muted-foreground font-mono">{d.distributorCode}</span>
            )}
        </div>
    )
},
```
改为：
```typescript
cell: ({ row }) => (
    <OrderDistributorCell
        orderId={row.original.id}
        distributor={row.original.distributor}
        distributors={distributors}
    />
),
```

- [ ] **Step 2: 运行 lint 确认无类型错误**

```bash
npm run lint
```

Expected: no errors in orders-columns.tsx（会有其他文件报错，因为 orders-data-table.tsx 还未更新——下一步修复）

- [ ] **Step 3: Commit（等 Task 4 一起 commit）**

先不 commit，等下一步一起提交。

---

## Task 4: 修改 orders-data-table.tsx

**Files:**
- Modify: `app/admin/(main)/orders/orders-data-table.tsx`

- [ ] **Step 1: 更新 import 和 props**

将：
```typescript
import { ordersColumns, type OrderRow } from "./orders-columns"
```
改为：
```typescript
import { createOrdersColumns, type OrderRow } from "./orders-columns"
import type { DistributorOption } from "./order-distributor-cell"
```

将 `OrdersDataTableProps` 接口添加 `distributors` 字段：
```typescript
interface OrdersDataTableProps {
    data: OrderRow[]
    total: number
    statusCounts: {
        PENDING: number
        COMPLETED: number
        CLOSED: number
    }
    distributors: DistributorOption[]
}
```

将函数签名：
```typescript
export function OrdersDataTable({ data, total, statusCounts }: OrdersDataTableProps) {
```
改为：
```typescript
export function OrdersDataTable({ data, total, statusCounts, distributors }: OrdersDataTableProps) {
```

将 `useReactTable` 的 `columns: ordersColumns` 改为：
```typescript
columns: createOrdersColumns(distributors),
```

将 `<DataTable table={table} columns={ordersColumns}` 改为：
```typescript
<DataTable table={table} columns={createOrdersColumns(distributors)}
```

- [ ] **Step 2: Commit（和 Task 3 一起）**

```bash
git add app/admin/(main)/orders/orders-columns.tsx app/admin/(main)/orders/orders-data-table.tsx
git commit -m "refactor: convert ordersColumns to factory function, wire distributor cell"
```

---

## Task 5: 修改 page.tsx — 查询分销员列表

**Files:**
- Modify: `app/admin/(main)/orders/page.tsx`

- [ ] **Step 1: 在 page.tsx 中添加 distributors 查询**

在现有 `Promise.all` 中增加第 5 个查询：

将：
```typescript
const [orders, total, statusCounts, revenueAgg] = await Promise.all([
    prisma.order.findMany({ ... }),
    prisma.order.count({ where }),
    prisma.order.groupBy({ ... }),
    prisma.order.aggregate({ ... }),
])
```
改为：
```typescript
const [orders, total, statusCounts, revenueAgg, distributors] = await Promise.all([
    prisma.order.findMany({ ... }),
    prisma.order.count({ where }),
    prisma.order.groupBy({ ... }),
    prisma.order.aggregate({ ... }),
    prisma.user.findMany({
        where: { role: "DISTRIBUTOR" },
        select: { id: true, name: true, distributorCode: true },
        orderBy: { name: "asc" },
    }),
])
```

- [ ] **Step 2: 将 distributors 传给 OrdersDataTable**

将：
```typescript
<OrdersDataTable
    data={serializedOrders}
    total={total}
    statusCounts={orderStats}
/>
```
改为：
```typescript
<OrdersDataTable
    data={serializedOrders}
    total={total}
    statusCounts={orderStats}
    distributors={distributors.map((d) => ({
        id: d.id,
        name: d.name ?? "",
        distributorCode: d.distributorCode,
    }))}
/>
```

- [ ] **Step 3: 运行 lint 确认全部类型正确**

```bash
npm run lint
```

Expected: no errors

- [ ] **Step 4: 本地启动验证**

```bash
npm run dev
```

访问 `http://localhost:3000/admin/orders`，点击分销员列任意行：
- 弹出 Popover，有搜索框
- 选择分销员后进入二次确认界面
- 点击「确认」后 toast 成功，表格刷新

- [ ] **Step 5: Commit**

```bash
git add app/admin/(main)/orders/page.tsx
git commit -m "feat: pass distributors list to orders table for inline distributor editor"
```

---

## 自我检查

- [x] Task 1 覆盖 API 的鉴权、设值、清除、404、非法 distributorId 共 5 个测试场景
- [x] Task 2 组件含两步 UI（select → confirm），loading 状态，取消回退逻辑，toast 反馈
- [x] Task 3/4 工厂函数模式保持 columns 文件职责单一，不引入 context
- [x] Task 5 distributors 在服务端一次查询，不增加客户端请求
- [x] 二次确认在 Popover 内部完成，无 AlertDialog 嵌套
- [x] 无 placeholder，所有代码块完整
