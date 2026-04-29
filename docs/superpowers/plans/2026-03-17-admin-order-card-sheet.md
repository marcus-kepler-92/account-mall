# Admin 订单详情卡密 Sheet 展示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 改造 admin 后台订单详情页，点击卡密行弹出 Sheet 侧边抽屉，用卡密模版解析内容为结构化字段，支持逐字段复制，兼容移动端。

**Architecture:** 服务端（`page.tsx`）扩展 Prisma 查询获取 `cardTemplates`，调用新增的 `resolveAdminCard` 函数序列化每张卡密；新建客户端组件 `order-cards-table.tsx` 持有 Sheet 状态，表格行 `onClick` 打开 Sheet 展示解析结果；`CardCompactActions` 中的 Eye Tooltip 因被 Sheet 取代而移除。

**Tech Stack:** Next.js 16 App Router, React 19, shadcn/ui Sheet, Prisma 6, `lib/card-format.ts` (`resolveCardFields`, `parseTemplate`), `lib/auto-fetch-card.ts` (`parseAutoFetchCardContent`), Jest + Testing Library

---

## File Map

| 文件 | 变更 |
|------|------|
| `lib/card-format.ts` | 新增导出 `resolveAdminCard` |
| `__tests__/lib/resolve-admin-card.test.ts` | 新建：`resolveAdminCard` 单元测试 |
| `app/admin/(main)/orders/[orderId]/page.tsx` | 改：加 `cardTemplates`，`resolved`，`createdAt.toISOString()`，替换表格 JSX |
| `app/admin/(main)/orders/[orderId]/order-cards-table.tsx` | 新建：Client 组件（表格 + Sheet） |
| `__tests__/components/order-cards-table.test.tsx` | 新建：组件交互测试 |
| `app/admin/(main)/cards/card-row-actions.tsx` | 改：`CardCompactActions` 移除 Eye Tooltip 块 |

---

## Task 1: 新增 `resolveAdminCard` 函数（TDD）

**Files:**
- Create: `__tests__/lib/resolve-admin-card.test.ts`
- Modify: `lib/card-format.ts`

- [ ] **Step 1: 写失败测试**

新建 `__tests__/lib/resolve-admin-card.test.ts`：

```typescript
import { resolveAdminCard } from "@/lib/card-format"
import type { ResolvedCard } from "@/lib/card-format"

describe("resolveAdminCard", () => {
  it("maps AUTO_FETCH JSON to formatted fields (account/password/region)", () => {
    const content = JSON.stringify({
      account: "user@example.com",
      password: "pass123",
      region: "US",
    })
    const result = resolveAdminCard(content, [])
    expect(result).toEqual<ResolvedCard>({
      type: "formatted",
      fields: [
        { label: "账号", value: "user@example.com" },
        { label: "密码", value: "pass123" },
        { label: "地区", value: "US" },
      ],
    })
  })

  it("includes optional AUTO_FETCH fields when present", () => {
    const content = JSON.stringify({
      account: "user@example.com",
      password: "pass123",
      region: "US",
      birthday: "1990-01-01",
      securityAnswerFriend: "buddy",
      securityAnswerWork: "company",
      securityAnswerParents: "hometown",
    })
    const result = resolveAdminCard(content, [])
    expect(result.type).toBe("formatted")
    if (result.type === "formatted") {
      expect(result.fields).toContainEqual({ label: "生日", value: "1990-01-01" })
      expect(result.fields).toContainEqual({ label: "密保朋友", value: "buddy" })
      expect(result.fields).toContainEqual({ label: "工作答案", value: "company" })
      expect(result.fields).toContainEqual({ label: "父母答案", value: "hometown" })
    }
  })

  it("falls back to template matching for regular cards", () => {
    const content = "user@example.com----pass123"
    const templates = [{ template: "{账号}----{密码}" }]
    const result = resolveAdminCard(content, templates)
    expect(result).toEqual<ResolvedCard>({
      type: "formatted",
      fields: [
        { label: "账号", value: "user@example.com" },
        { label: "密码", value: "pass123" },
      ],
    })
  })

  it("returns plain for unstructured content with no matching template", () => {
    const result = resolveAdminCard("XXXX-XXXX-XXXX-XXXX", [])
    expect(result).toEqual<ResolvedCard>({ type: "plain", content: "XXXX-XXXX-XXXX-XXXX" })
  })
})
```

- [ ] **Step 2: 运行测试确认 FAIL**

```bash
npx jest __tests__/lib/resolve-admin-card.test.ts -t "resolveAdminCard" --no-coverage
```

Expected: FAIL — `resolveAdminCard is not exported`

- [ ] **Step 3: 实现 `resolveAdminCard`**

修改 `lib/card-format.ts`：

在文件顶部，将现有 import 行：
```typescript
import { parseCardContentWithDelimiter } from "@/lib/auto-fetch-card"
```
改为：
```typescript
import { parseCardContentWithDelimiter, parseAutoFetchCardContent, type AutoFetchCardPayload } from "@/lib/auto-fetch-card"
```

在文件末尾追加（`resolveCardFields` 定义之后）：

```typescript
const AUTO_FETCH_ADMIN_LABELS: Array<[keyof AutoFetchCardPayload, string]> = [
  ["account", "账号"],
  ["password", "密码"],
  ["region", "地区"],
  ["birthday", "生日"],
  ["securityAnswerFriend", "密保朋友"],
  ["securityAnswerWork", "工作答案"],
  ["securityAnswerParents", "父母答案"],
]

/**
 * Resolve card content for admin display: tries AUTO_FETCH JSON first,
 * then falls back to template-based resolveCardFields.
 */
export function resolveAdminCard(
  content: string,
  cardTemplates: Array<{ template: string }>
): ResolvedCard {
  const payload = parseAutoFetchCardContent(content)
  if (payload) {
    const fields = AUTO_FETCH_ADMIN_LABELS
      .filter(([key]) => !!payload[key])
      .map(([key, label]) => ({ label, value: payload[key] as string }))
    if (fields.length >= 1) return { type: "formatted", fields }
  }
  return resolveCardFields(content, cardTemplates)
}
```

- [ ] **Step 4: 运行测试确认 PASS**

```bash
npx jest __tests__/lib/resolve-admin-card.test.ts --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/card-format.ts __tests__/lib/resolve-admin-card.test.ts
git commit -m "feat(card-format): export resolveAdminCard for admin sheet display"
```

---

## Task 2: 扩展 `page.tsx` 数据层

**Files:**
- Modify: `app/admin/(main)/orders/[orderId]/page.tsx`

- [ ] **Step 1: 更新 Prisma include，加 `cardTemplates`**

在 `page.tsx` 的 Prisma 查询中，将：
```typescript
product: {
    select: {
        id: true,
        name: true,
        slug: true,
    },
},
```
改为：
```typescript
product: {
    select: {
        id: true,
        name: true,
        slug: true,
        cardTemplates: {
            orderBy: { sortOrder: "asc" },
            select: { template: true },
        },
    },
},
```

- [ ] **Step 2: 更新 `serializedCards`，加 `resolved` 和 `createdAt` 序列化**

在文件顶部 import 区加：
```typescript
import { resolveAdminCard } from "@/lib/card-format"
```

将现有 `serializedCards` 映射：
```typescript
const serializedCards = order.cards.map((c) => ({
    id: c.id,
    content: c.content,
    maskedContent: maskContent(c.content),
    status: c.status,
    createdAt: c.createdAt,
    productId: order.product.id,
}))
```
改为：
```typescript
const cardTemplates = order.product.cardTemplates
const serializedCards = order.cards.map((c) => ({
    id: c.id,
    content: c.content,
    maskedContent: maskContent(c.content),
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    productId: order.product.id,
    resolved: resolveAdminCard(c.content, cardTemplates),
}))
```

- [ ] **Step 3: 运行 typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "orders/\[orderId\]"
```

Expected: 无错误输出

- [ ] **Step 4: Commit**

```bash
git add app/admin/\(main\)/orders/\[orderId\]/page.tsx
git commit -m "feat(admin/orders): resolve card fields server-side for sheet display"
```

---

## Task 3: 新建 `order-cards-table.tsx`（TDD）

**Files:**
- Create: `__tests__/components/order-cards-table.test.tsx`
- Create: `app/admin/(main)/orders/[orderId]/order-cards-table.tsx`

- [ ] **Step 1: 写失败组件测试**

新建 `__tests__/components/order-cards-table.test.tsx`：

```tsx
/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { render, screen, fireEvent } from "@testing-library/react"
import { OrderCardsTable } from "@/app/admin/(main)/orders/[orderId]/order-cards-table"

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

const clipboardMock = { writeText: jest.fn().mockResolvedValue(undefined) }
Object.defineProperty(navigator, "clipboard", { value: clipboardMock, writable: true })

const formattedCard = {
  id: "c1",
  content: "user@example.com----pass123",
  maskedContent: "user@exa***",
  status: "SOLD",
  createdAt: "2024-01-01T00:00:00.000Z",
  productId: "p1",
  resolved: {
    type: "formatted" as const,
    fields: [
      { label: "账号", value: "user@example.com" },
      { label: "密码", value: "pass123" },
    ],
  },
}

const plainCard = {
  id: "c2",
  content: "XXXX-YYYY-ZZZZ",
  maskedContent: "XXXX-YYY***",
  status: "UNSOLD",
  createdAt: "2024-01-02T00:00:00.000Z",
  productId: "p1",
  resolved: { type: "plain" as const, content: "XXXX-YYYY-ZZZZ" },
}

describe("OrderCardsTable", () => {
  it("renders masked content in the table", () => {
    render(<OrderCardsTable cards={[formattedCard]} />)
    expect(screen.getByText("user@exa***")).toBeInTheDocument()
  })

  it("opens sheet with parsed fields when row is clicked", () => {
    render(<OrderCardsTable cards={[formattedCard]} />)
    fireEvent.click(screen.getByText("user@exa***"))
    expect(screen.getByText("账号")).toBeInTheDocument()
    expect(screen.getByText("user@example.com")).toBeInTheDocument()
    expect(screen.getByText("密码")).toBeInTheDocument()
    expect(screen.getByText("pass123")).toBeInTheDocument()
  })

  it("shows raw content for plain card in sheet", () => {
    render(<OrderCardsTable cards={[plainCard]} />)
    fireEvent.click(screen.getByText("XXXX-YYY***"))
    expect(screen.getByText("XXXX-YYYY-ZZZZ")).toBeInTheDocument()
  })

  it("calls clipboard.writeText when single field copy button clicked", async () => {
    render(<OrderCardsTable cards={[formattedCard]} />)
    fireEvent.click(screen.getByText("user@exa***"))
    const copyBtns = screen.getAllByLabelText("复制账号")
    fireEvent.click(copyBtns[0])
    expect(clipboardMock.writeText).toHaveBeenCalledWith("user@example.com")
  })
})
```

- [ ] **Step 2: 运行测试确认 FAIL**

```bash
npx jest __tests__/components/order-cards-table.test.tsx --no-coverage
```

Expected: FAIL — `Cannot find module '@/app/admin/(main)/orders/[orderId]/order-cards-table'`

- [ ] **Step 3: 创建 `order-cards-table.tsx`**

新建 `app/admin/(main)/orders/[orderId]/order-cards-table.tsx`：

```tsx
"use client"

import { useState, useCallback, useRef } from "react"
import { Check, Copy, Package } from "lucide-react"
import { toast } from "sonner"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet"
import { formatDateTime } from "@/lib/utils"
import type { ResolvedCard } from "@/lib/card-format"
import { CardCompactActions } from "@/app/admin/(main)/cards/card-row-actions"

type SerializedCard = {
  id: string
  content: string
  maskedContent: string
  status: string
  createdAt: string
  productId: string
  resolved: ResolvedCard
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  UNSOLD: { label: "未售", className: "border-success/50 bg-success/10 text-success" },
  RESERVED: { label: "预占中", className: "border-warning/50 bg-warning/10 text-warning" },
  DISABLED: { label: "停用", className: "border-muted-foreground/30 bg-muted/50 text-muted-foreground" },
  SOLD: { label: "已售", className: "border-muted-foreground/30 bg-muted text-muted-foreground" },
}

export function OrderCardsTable({ cards }: { cards: SerializedCard[] }) {
  const [selectedCard, setSelectedCard] = useState<SerializedCard | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const selectedIndex = selectedCard
    ? cards.findIndex((c) => c.id === selectedCard.id)
    : -1

  const copy = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      clearTimeout(copiedTimerRef.current)
      setCopiedId(id)
      copiedTimerRef.current = setTimeout(() => setCopiedId(null), 2000)
      toast.success("已复制")
    } catch {
      toast.error("复制失败")
    }
  }, [])

  const copyAll = useCallback(async (card: SerializedCard) => {
    const text =
      card.resolved.type === "formatted"
        ? card.resolved.fields.map((f) => `${f.label}：${f.value}`).join("\n")
        : card.content
    try {
      await navigator.clipboard.writeText(text)
      toast.success("已复制全部")
    } catch {
      toast.error("复制失败")
    }
  }, [])

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Package className="size-10 text-muted-foreground mb-2" />
        <p className="text-sm font-medium">暂无卡密</p>
        <p className="text-xs text-muted-foreground mt-1">该订单尚未关联卡密</p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="pl-4">卡密</TableHead>
              <TableHead className="text-center">状态</TableHead>
              <TableHead className="hidden text-right sm:table-cell">创建时间</TableHead>
              <TableHead className="text-right pr-4 w-[120px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cards.map((card) => {
              const statusInfo = STATUS_MAP[card.status] ?? STATUS_MAP.SOLD
              return (
                <TableRow
                  key={card.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedCard(card)}
                >
                  <TableCell className="pl-4">
                    <span className="font-mono text-xs">{card.maskedContent}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={statusInfo.className}>
                      {statusInfo.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground text-xs sm:table-cell">
                    {formatDateTime(card.createdAt)}
                  </TableCell>
                  <TableCell
                    className="text-right pr-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <CardCompactActions
                      cardId={card.id}
                      content={card.content}
                      status={card.status}
                      productId={card.productId}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!selectedCard} onOpenChange={(open) => !open && setSelectedCard(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {selectedCard && (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle className="flex items-center gap-2">
                  卡密 #{selectedIndex + 1}
                  <Badge
                    variant="outline"
                    className={STATUS_MAP[selectedCard.status]?.className}
                  >
                    {STATUS_MAP[selectedCard.status]?.label}
                  </Badge>
                </SheetTitle>
              </SheetHeader>

              {selectedCard.resolved.type === "formatted" ? (
                <div className="space-y-4">
                  <div className="rounded-lg border divide-y divide-border/60">
                    {selectedCard.resolved.fields.map((field, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-4 px-4 py-3"
                      >
                        <span className="text-xs font-medium text-muted-foreground shrink-0 w-20">
                          {field.label}
                        </span>
                        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                          <code className="min-w-0 break-all font-mono text-sm text-foreground">
                            {field.value}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0"
                            onClick={() => copy(field.value, `field-${i}`)}
                            aria-label={`复制${field.label}`}
                          >
                            {copiedId === `field-${i}` ? (
                              <Check className="size-4 text-emerald-600" />
                            ) : (
                              <Copy className="size-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    className="w-full gap-2"
                    onClick={() => copyAll(selectedCard)}
                  >
                    <Copy className="size-4" />
                    复制全部
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border p-4">
                    <code className="break-all font-mono text-sm text-foreground">
                      {selectedCard.resolved.content}
                    </code>
                  </div>
                  <Button
                    variant="secondary"
                    className="w-full gap-2"
                    onClick={() => copyAll(selectedCard)}
                  >
                    <Copy className="size-4" />
                    复制
                  </Button>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
```

- [ ] **Step 4: 运行测试确认 PASS**

```bash
npx jest __tests__/components/order-cards-table.test.tsx --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/admin/\(main\)/orders/\[orderId\]/order-cards-table.tsx __tests__/components/order-cards-table.test.tsx
git commit -m "feat(admin/orders): add OrderCardsTable with sheet and field copy"
```

---

## Task 4: 替换 `page.tsx` 的内联表格 JSX

**Files:**
- Modify: `app/admin/(main)/orders/[orderId]/page.tsx`

- [ ] **Step 1: 更新 import**

在 `page.tsx` 顶部加：
```typescript
import { OrderCardsTable } from "@/app/admin/(main)/orders/[orderId]/order-cards-table"
```

移除不再需要的 import（若后续 typecheck 提示 unused）：
```typescript
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
```

- [ ] **Step 2: 替换 `<CardContent>` 内的卡密区块**

将 `<CardContent>` 内从 `{serializedCards.length > 0 ? (` 到最后的 `</CardContent>` 这一块，改为：

```tsx
<CardContent>
  <OrderCardsTable cards={serializedCards} />
</CardContent>
```

（`OrderCardsTable` 内部自己处理空状态，不需要外层再判断。）

- [ ] **Step 3: 运行 typecheck + build**

```bash
npx tsc --noEmit 2>&1 | grep -E "error|orders"
npm run build 2>&1 | tail -20
```

Expected: 无 TypeScript 错误，build passed

- [ ] **Step 4: Commit**

```bash
git add app/admin/\(main\)/orders/\[orderId\]/page.tsx
git commit -m "feat(admin/orders): wire OrderCardsTable into order detail page"
```

---

## Task 5: 移除 `CardCompactActions` 的 Eye Tooltip

**Files:**
- Modify: `app/admin/(main)/cards/card-row-actions.tsx`

- [ ] **Step 1: 删除 Eye Tooltip 块**

在 `card-row-actions.tsx` 中，找到以下代码块（约 317–327 行）并删除整块：

```tsx
<Tooltip>
    <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="查看完整卡密">
            <Eye className="size-4" />
        </Button>
    </TooltipTrigger>
    <TooltipContent side="left" className="max-w-sm break-all font-mono text-xs whitespace-pre-wrap">
        <span className="block text-muted-foreground mb-1">完整卡密</span>
        {textToCopy}
    </TooltipContent>
</Tooltip>
```

- [ ] **Step 2: 检查 `Eye` import 是否仍被使用**

`CardRowActions`（上方的 dropdown 版）在"查看完整内容"菜单项中用到了 `Eye`（第 121 行），因此 **保留** `Eye` 在 import 中。

- [ ] **Step 3: 运行 typecheck 和测试**

```bash
npx tsc --noEmit 2>&1 | grep "card-row-actions"
npm test -- --testPathPattern="order-cards-table|card" --no-coverage
```

Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add app/admin/\(main\)/cards/card-row-actions.tsx
git commit -m "refactor(admin/cards): remove Eye tooltip from CardCompactActions (replaced by sheet)"
```

---

## 验收检查

全部 Task 完成后运行：

```bash
npm test -- --no-coverage
npm run build
```

Expected:
- 所有测试通过（包括新增的 `resolve-admin-card` + `order-cards-table` 两个测试文件）
- Build passed，无 TypeScript 错误

手动验收：启动 dev server（`npm run dev`），进入任意有卡密的订单详情页（`/admin/orders/:id`），点击卡密行验证：
1. Sheet 从右侧弹出
2. 卡密字段按模版解析展示（账号/密码/etc.）
3. 单字段复制按钮正常工作，图标短暂变绿 ✓
4. 「复制全部」按钮复制所有字段
5. 操作列按钮点击不触发 Sheet
6. 移动端（375px 宽）Sheet 全宽展示，字段可读
