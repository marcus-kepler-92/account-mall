# 全局卡密模版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将每商品独立的卡密格式（`ProductCardFormat`）改为全局 `CardTemplate` 实体，通过多对多关联挂到商品，商品编辑页提供类 Tag 选择器。

**Architecture:** 新建 `CardTemplate` Prisma 模型（无 productId），`Product ↔ CardTemplate` 用 Prisma 隐式多对多。Admin 提供独立的模版管理页 + 商品编辑页内联选择器。数据迁移分两步 schema migration，中间由用户手跑一段 SQL。

**Tech Stack:** Prisma 6、Next.js 16 App Router、shadcn/ui、TanStack Table、react-hook-form + Zod、TanStack Query（此处无）

---

## 文件地图

| 动作 | 路径 |
|------|------|
| MODIFY | `prisma/schema.prisma` （Phase 1 + Phase 2 各改一次）|
| CREATE | `lib/validations/card-template.ts` |
| DELETE | `lib/validations/card-format.ts` |
| MODIFY | `lib/validations/product.ts` |
| CREATE | `app/api/admin/card-templates/route.ts` |
| CREATE | `app/api/admin/card-templates/[id]/route.ts` |
| MODIFY | `app/api/products/[productId]/route.ts` |
| DELETE | `app/api/products/[productId]/card-formats/route.ts` |
| DELETE | `app/api/products/[productId]/card-formats/[formatId]/route.ts` |
| CREATE | `app/admin/(main)/card-templates/page.tsx` |
| CREATE | `app/admin/(main)/card-templates/card-templates-columns.tsx` |
| CREATE | `app/admin/(main)/card-templates/card-templates-data-table.tsx` |
| CREATE | `app/admin/(main)/card-templates/card-templates-row-actions.tsx` |
| CREATE | `app/components/product-form-card-template-select.tsx` |
| MODIFY | `app/components/product-form.tsx` |
| MODIFY | `app/admin/(main)/products/[productId]/page.tsx` |
| DELETE | `app/admin/(main)/products/[productId]/product-card-formats.tsx` |
| MODIFY | `app/orders/[orderNo]/success/page.tsx` |
| MODIFY | `app/components/admin-sidebar.tsx` |
| RENAME | `__tests__/lib/card-format.test.ts` → `__tests__/lib/card-template.test.ts` |
| CREATE | `__tests__/api/admin/card-templates/route.test.ts` |

---

## Task 1: Phase 1 — Schema：新增 CardTemplate，保留 ProductCardFormat

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 编辑 `prisma/schema.prisma`**

在 `model ProductCardFormat` 之前插入新模型，并在 `Product` 上添加关联字段：

```prisma
// 在 Product 模型内，替换：
//   cardFormats          ProductCardFormat[]
// 改为：
  cardFormats          ProductCardFormat[]
  cardTemplates        CardTemplate[]
```

在 `model ProductCardFormat { ... }` 后面新增：

```prisma
model CardTemplate {
  id        String    @id @default(cuid())
  name      String
  template  String
  sortOrder Int       @default(0)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  products  Product[]

  @@index([sortOrder])
}
```

- [ ] **Step 2: 生成并运行 Phase 1 迁移**

```bash
npm run db:migrate
```

当提示输入迁移名称时输入：`add_card_template_global`

预期：迁移成功，新增 `CardTemplate` 表和 `_CardTemplateToProduct` join 表，`ProductCardFormat` 表保留不变。

- [ ] **Step 3: 验证 Phase 1 迁移**

```bash
npx prisma studio
```

确认 `CardTemplate` 表和 `_CardTemplateToProduct` 表出现在列表中。

---

## Task 2: 数据迁移 SQL（用户手动执行）

- [ ] **Step 1: 执行数据迁移 SQL**

在数据库控制台（或 Prisma Studio 的 SQL 编辑器）运行：

```sql
-- 1. 将现有 ProductCardFormat 去重后写入 CardTemplate
INSERT INTO "CardTemplate" (id, name, template, "sortOrder", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  name,
  template,
  MIN("sortOrder"),
  NOW(),
  NOW()
FROM "ProductCardFormat"
GROUP BY name, template;

-- 2. 重建商品与模版的关联
INSERT INTO "_CardTemplateToProduct" ("A", "B")
SELECT DISTINCT ct.id, pcf."productId"
FROM "ProductCardFormat" pcf
JOIN "CardTemplate" ct
  ON ct.name = pcf.name AND ct.template = pcf.template;
```

- [ ] **Step 2: 验证迁移结果**

```sql
-- CardTemplate 行数应等于 ProductCardFormat 去重后行数
SELECT COUNT(*) FROM "CardTemplate";
SELECT COUNT(*) FROM (SELECT DISTINCT name, template FROM "ProductCardFormat") sub;

-- 关联数量应合理
SELECT COUNT(*) FROM "_CardTemplateToProduct";
```

两组数字第一行应相等。

---

## Task 3: 重命名 Validation 文件

**Files:**
- Create: `lib/validations/card-template.ts`
- Delete: `lib/validations/card-format.ts`
- Rename: `__tests__/lib/card-format.test.ts` → `__tests__/lib/card-template.test.ts`

- [ ] **Step 1: 创建 `lib/validations/card-template.ts`**

```typescript
import { z } from "zod"
import { parseTemplate } from "@/lib/card-format"

export const cardTemplateSchema = z.object({
  name: z.string().min(1, "模版名称不能为空").max(50, "模版名称不超过 50 字符"),
  template: z
    .string()
    .min(1, "格式模板不能为空")
    .refine((val) => parseTemplate(val) !== null, {
      message: "模板至少包含两个 {字段名}，且字段之间需有分隔符",
    }),
})

export type CardTemplateInput = z.infer<typeof cardTemplateSchema>
```

- [ ] **Step 2: 删除旧文件**

```bash
rm lib/validations/card-format.ts
```

- [ ] **Step 3: 更新测试文件**

将 `__tests__/lib/card-format.test.ts` 改名为 `__tests__/lib/card-template.test.ts`（Git rename）：

```bash
git mv __tests__/lib/card-format.test.ts __tests__/lib/card-template.test.ts
```

文件内容保持不变（测试的是 `lib/card-format.ts` 中的 `parseTemplate` 和 `resolveCardFields`，那个文件不改）。

- [ ] **Step 4: 运行测试确认不报错**

```bash
npx jest __tests__/lib/card-template.test.ts
```

预期：所有测试通过。

- [ ] **Step 5: Commit**

```bash
git add lib/validations/card-template.ts __tests__/lib/card-template.test.ts
git rm lib/validations/card-format.ts
git commit -m "refactor: rename card-format validation to card-template"
```

---

## Task 4: 更新 Product Validation Schema

**Files:**
- Modify: `lib/validations/product.ts`

- [ ] **Step 1: 在 `createProductSchema` 中添加 `cardTemplateIds`**

在 `tagIds: z.array(z.string()).optional(),` 一行后面加：

```typescript
    cardTemplateIds: z.array(z.string()).optional(),
```

同样在 `updateProductSchema` 的 `tagIds` 行后面加：

```typescript
    cardTemplateIds: z.array(z.string()).optional(),
```

同样在 `productFormSchema` 的 `tagIds: z.array(z.string()).optional(),` 行后面加：

```typescript
    cardTemplateIds: z.array(z.string()).optional(),
```

- [ ] **Step 2: 运行 Product 相关测试**

```bash
npx jest __tests__/lib/validations-product.test.ts
```

预期：所有测试通过（新字段 optional，不破坏现有测试）。

- [ ] **Step 3: Commit**

```bash
git add lib/validations/product.ts
git commit -m "feat(validations): add cardTemplateIds to product schemas"
```

---

## Task 5: 新建 Admin Card Templates API 路由

**Files:**
- Create: `app/api/admin/card-templates/route.ts`
- Create: `app/api/admin/card-templates/[id]/route.ts`

- [ ] **Step 1: 创建 `app/api/admin/card-templates/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError } from "@/lib/api-response"
import { cardTemplateSchema } from "@/lib/validations/card-template"

const TEMPLATE_SELECT = {
  id: true,
  name: true,
  template: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { products: true } },
} as const

export async function GET() {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const templates = await prisma.cardTemplate.findMany({
    orderBy: { sortOrder: "asc" },
    select: TEMPLATE_SELECT,
  })
  return NextResponse.json(templates)
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return invalidJsonBody()
  }

  const parsed = cardTemplateSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const maxOrder = await prisma.cardTemplate.aggregate({ _max: { sortOrder: true } })
  const nextSort = (maxOrder._max.sortOrder ?? -1) + 1

  const template = await prisma.cardTemplate.create({
    data: {
      name: parsed.data.name,
      template: parsed.data.template,
      sortOrder: nextSort,
    },
    select: TEMPLATE_SELECT,
  })
  return NextResponse.json(template, { status: 201 })
}
```

- [ ] **Step 2: 创建 `app/api/admin/card-templates/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import {
  unauthorized,
  invalidJsonBody,
  validationError,
  notFound,
  badRequest,
} from "@/lib/api-response"
import { cardTemplateSchema } from "@/lib/validations/card-template"

type RouteContext = { params: Promise<{ id: string }> }

const TEMPLATE_SELECT = {
  id: true,
  name: true,
  template: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { products: true } },
} as const

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params

  const existing = await prisma.cardTemplate.findUnique({ where: { id } })
  if (!existing) return notFound("模版不存在")

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return invalidJsonBody()
  }

  const parsed = cardTemplateSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const updated = await prisma.cardTemplate.update({
    where: { id },
    data: { name: parsed.data.name, template: parsed.data.template },
    select: TEMPLATE_SELECT,
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params

  const existing = await prisma.cardTemplate.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  })
  if (!existing) return notFound("模版不存在")

  if (existing._count.products > 0) {
    return badRequest("该模版已被商品使用，请先在商品中移除再删除")
  }

  await prisma.cardTemplate.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 3: 写 API 测试**

创建 `__tests__/api/admin/card-templates/route.test.ts`：

```typescript
import { NextRequest } from "next/server"
import { prismaMock } from "@/__mocks__/prisma"

jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
jest.mock("@/lib/auth-guard", () => ({ getAdminSession: jest.fn() }))

import { getAdminSession } from "@/lib/auth-guard"
import { GET, POST } from "@/app/api/admin/card-templates/route"
import { PATCH, DELETE } from "@/app/api/admin/card-templates/[id]/route"

const mockSession = { user: { id: "u1" } }

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })

describe("GET /api/admin/card-templates", () => {
  it("returns 401 when not authenticated", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns template list ordered by sortOrder", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const templates = [
      { id: "t1", name: "标准版", template: "{账号}----{密码}", sortOrder: 0, createdAt: new Date(), updatedAt: new Date(), _count: { products: 2 } },
    ]
    prismaMock.cardTemplate.findMany.mockResolvedValue(templates as never)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(prismaMock.cardTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { sortOrder: "asc" } })
    )
  })
})

describe("POST /api/admin/card-templates", () => {
  it("returns 401 when not authenticated", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const req = new NextRequest("http://localhost/", {
      method: "POST",
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 400 for invalid template string", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const req = new NextRequest("http://localhost/", {
      method: "POST",
      body: JSON.stringify({ name: "X", template: "no-placeholders" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("creates template and returns 201", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.cardTemplate.aggregate.mockResolvedValue({ _max: { sortOrder: null } } as never)
    const created = {
      id: "t1", name: "标准版", template: "{账号}----{密码}",
      sortOrder: 0, createdAt: new Date(), updatedAt: new Date(), _count: { products: 0 },
    }
    prismaMock.cardTemplate.create.mockResolvedValue(created as never)
    const req = new NextRequest("http://localhost/", {
      method: "POST",
      body: JSON.stringify({ name: "标准版", template: "{账号}----{密码}" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe("标准版")
  })
})

describe("DELETE /api/admin/card-templates/[id]", () => {
  it("returns 400 when template is in use", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.cardTemplate.findUnique.mockResolvedValue({
      id: "t1", _count: { products: 3 }
    } as never)
    const res = await DELETE(
      new NextRequest("http://localhost/"),
      makeParams("t1")
    )
    expect(res.status).toBe(400)
  })

  it("returns 204 when template is unused", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.cardTemplate.findUnique.mockResolvedValue({
      id: "t1", _count: { products: 0 }
    } as never)
    prismaMock.cardTemplate.delete.mockResolvedValue({} as never)
    const res = await DELETE(
      new NextRequest("http://localhost/"),
      makeParams("t1")
    )
    expect(res.status).toBe(204)
  })
})
```

- [ ] **Step 4: 运行 API 测试**

```bash
npx jest __tests__/api/admin/card-templates/
```

预期：所有测试通过。

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/card-templates/ __tests__/api/admin/card-templates/
git commit -m "feat(api): add global card-templates admin API routes"
```

---

## Task 6: 更新商品 API，支持 cardTemplateIds

**Files:**
- Modify: `app/api/products/[productId]/route.ts`

- [ ] **Step 1: 更新解构和 updateData**

在 `app/api/products/[productId]/route.ts` 的 PUT handler 中，找到：

```typescript
const { tagIds, productType, sourceUrl, price, validityHours, allowAccountSwitch, accountSwitchLimit, riskWarningEnabled, riskWarningTitle, riskWarningContent, riskWarningCountdown, riskWarningConfirmText, purchaseLimitEnabled, purchaseLimitQuantity, ...rest } = parsed.data;
```

替换为：

```typescript
const { tagIds, cardTemplateIds, productType, sourceUrl, price, validityHours, allowAccountSwitch, accountSwitchLimit, riskWarningEnabled, riskWarningTitle, riskWarningContent, riskWarningCountdown, riskWarningConfirmText, purchaseLimitEnabled, purchaseLimitQuantity, ...rest } = parsed.data;
```

找到：

```typescript
        ...(tagIds !== undefined && {
            tags: { set: tagIds.map((id) => ({ id })) },
        }),
```

在其后追加：

```typescript
        ...(cardTemplateIds !== undefined && {
            cardTemplates: { set: cardTemplateIds.map((id) => ({ id })) },
        }),
```

- [ ] **Step 2: 运行 lint 确认类型无误**

```bash
npm run lint
```

预期：无报错。

- [ ] **Step 3: Commit**

```bash
git add app/api/products/[productId]/route.ts
git commit -m "feat(api): support cardTemplateIds in product update"
```

---

## Task 7: Admin 卡密模版管理页 — 列定义

**Files:**
- Create: `app/admin/(main)/card-templates/card-templates-columns.tsx`

- [ ] **Step 1: 创建文件**

```typescript
"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { DataTableColumnHeader } from "@/app/admin/components"
import { parseTemplate } from "@/lib/card-format"
import { CardTemplateRowActions } from "./card-templates-row-actions"

export type CardTemplateRow = {
  id: string
  name: string
  template: string
  sortOrder: number
  createdAt: string
  updatedAt: string
  _count: { products: number }
}

export const cardTemplatesColumns: ColumnDef<CardTemplateRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="名称" />,
    cell: ({ row }) => (
      <span className="font-medium">{row.original.name}</span>
    ),
  },
  {
    accessorKey: "template",
    header: "模版字符串",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">{row.original.template}</span>
    ),
  },
  {
    id: "fields",
    header: "字段数",
    cell: ({ row }) => {
      const parsed = parseTemplate(row.original.template)
      return (
        <span className="tabular-nums text-sm">
          {parsed ? `${parsed.fields.length} 字段` : "—"}
        </span>
      )
    },
  },
  {
    id: "products",
    header: "使用商品数",
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground">
        {row.original._count.products}
      </span>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => <CardTemplateRowActions row={row.original} />,
  },
]
```

---

## Task 8: Admin 卡密模版管理页 — 行操作

**Files:**
- Create: `app/admin/(main)/card-templates/card-templates-row-actions.tsx`

- [ ] **Step 1: 创建文件**

```typescript
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Pencil, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { cardTemplateSchema, type CardTemplateInput } from "@/lib/validations/card-template"
import { parseTemplate } from "@/lib/card-format"
import type { CardTemplateRow } from "./card-templates-columns"

export function CardTemplateRowActions({ row }: { row: CardTemplateRow }) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const form = useForm<CardTemplateInput>({
    resolver: zodResolver(cardTemplateSchema),
    defaultValues: { name: row.name, template: row.template },
  })

  const templateValue = form.watch("template")
  const parsedPreview = parseTemplate(templateValue)

  const handleEdit = async (data: CardTemplateInput) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/card-templates/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error((json as { error?: string }).error ?? "保存失败")
        return
      }
      toast.success("模版已更新")
      setEditOpen(false)
      router.refresh()
    } catch {
      toast.error("操作失败，请重试")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/card-templates/${row.id}`, { method: "DELETE" })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error((json as { error?: string }).error ?? "删除失败")
        return
      }
      toast.success("模版已删除")
      setDeleteOpen(false)
      router.refresh()
    } catch {
      toast.error("删除失败，请重试")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="flex gap-1 justify-end">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => {
            form.reset({ name: row.name, template: row.template })
            setEditOpen(true)
          }}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-destructive hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑模版</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEdit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>模版名称</FormLabel>
                    <FormControl>
                      <Input placeholder="例如：带密保版" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="template"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>格式模板</FormLabel>
                    <FormControl>
                      <Input placeholder="{账号}----{密码}----{密保朋友}" className="font-mono" {...field} />
                    </FormControl>
                    <FormDescription>
                      用 <code className="text-xs rounded bg-muted px-1">{"{字段名}"}</code> 标记字段，字段间字符为分隔符
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {parsedPreview && (
                <div className="rounded-md border bg-muted/40 p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    分隔符：<code className="font-mono text-xs bg-background border rounded px-1 ml-1">{parsedPreview.delimiter}</code>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {parsedPreview.fields.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-0.5 text-xs">
                        <span className="text-muted-foreground">{i + 1}</span>
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  保存
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除模版「{row.name}」？</AlertDialogTitle>
            <AlertDialogDescription>
              {row._count.products > 0
                ? `该模版已被 ${row._count.products} 个商品使用，无法删除，请先在商品中移除。`
                : "此操作不可撤销。已导入的卡密不受影响，但展示时将退化为启发式解析或纯文本。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {row._count.products > 0 ? (
              <AlertDialogCancel>关闭</AlertDialogCancel>
            ) : (
              <>
                <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                  {deleting && <Loader2 className="size-4 animate-spin" />}
                  删除
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

---

## Task 9: Admin 卡密模版管理页 — DataTable + 新建 Dialog

**Files:**
- Create: `app/admin/(main)/card-templates/card-templates-data-table.tsx`

- [ ] **Step 1: 创建文件**

```typescript
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Plus, Loader2 } from "lucide-react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { DataTable, ClientDataTableToolbar, ClientDataTablePagination } from "@/app/admin/components"
import { cardTemplatesColumns, type CardTemplateRow } from "./card-templates-columns"
import { cardTemplateSchema, type CardTemplateInput } from "@/lib/validations/card-template"
import { parseTemplate } from "@/lib/card-format"

export function CardTemplatesDataTable({ data }: { data: CardTemplateRow[] }) {
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const form = useForm<CardTemplateInput>({
    resolver: zodResolver(cardTemplateSchema),
    defaultValues: { name: "", template: "" },
  })

  const templateValue = form.watch("template")
  const parsedPreview = parseTemplate(templateValue)

  const table = useReactTable({
    data,
    columns: cardTemplatesColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getRowId: (row) => row.id,
    initialState: { pagination: { pageSize: 20 } },
    state: { sorting, columnFilters },
  })

  const handleCreate = async (data: CardTemplateInput) => {
    setCreating(true)
    try {
      const res = await fetch("/api/admin/card-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error((json as { error?: string }).error ?? "创建失败")
        return
      }
      toast.success("模版已创建")
      form.reset({ name: "", template: "" })
      setCreateOpen(false)
      router.refresh()
    } catch {
      toast.error("操作失败，请重试")
    } finally {
      setCreating(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">卡密模版列表</CardTitle>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="size-4" />
                新建模版
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>新建卡密模版</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>模版名称</FormLabel>
                        <FormControl>
                          <Input placeholder="例如：带密保版" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="template"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>格式模板</FormLabel>
                        <FormControl>
                          <Input placeholder="{账号}----{密码}----{密保朋友}" className="font-mono" {...field} />
                        </FormControl>
                        <FormDescription>
                          用 <code className="text-xs rounded bg-muted px-1">{"{字段名}"}</code> 标记字段，字段间字符为分隔符
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {parsedPreview && (
                    <div className="rounded-md border bg-muted/40 p-3 space-y-2">
                      <p className="text-xs text-muted-foreground">
                        分隔符：<code className="font-mono text-xs bg-background border rounded px-1 ml-1">{parsedPreview.delimiter}</code>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {parsedPreview.fields.map((f, i) => (
                          <span key={i} className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-0.5 text-xs">
                            <span className="text-muted-foreground">{i + 1}</span>
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
                    <Button type="submit" disabled={creating}>
                      {creating && <Loader2 className="size-4 animate-spin" />}
                      创建
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <ClientDataTableToolbar table={table} searchColumn="name" searchPlaceholder="搜索模版名称…" />
        <Separator />
        <DataTable table={table} columns={cardTemplatesColumns} emptyMessage="暂无卡密模版" />
        <ClientDataTablePagination table={table} />
      </CardContent>
    </Card>
  )
}
```

---

## Task 10: Admin 卡密模版管理页 — page.tsx

**Files:**
- Create: `app/admin/(main)/card-templates/page.tsx`

- [ ] **Step 1: 创建 `page.tsx`**

```typescript
import { prisma } from "@/lib/prisma"
import { PageHeader } from "@/app/admin/components"
import { CardTemplatesDataTable } from "./card-templates-data-table"

export const dynamic = "force-dynamic"

export default async function CardTemplatesPage() {
  const templates = await prisma.cardTemplate.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      template: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { products: true } },
    },
  })

  const rows = templates.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="卡密模版"
        description="管理全局卡密格式模版，商品可按需选择挂载"
      />
      <CardTemplatesDataTable data={rows} />
    </div>
  )
}
```

- [ ] **Step 2: 确认页面可访问**

访问 `http://localhost:3000/admin/card-templates`，页面应正常渲染，显示已迁移的模版列表（若 Task 2 已执行）或空列表。

- [ ] **Step 3: Commit**

```bash
git add app/admin/(main)/card-templates/ __tests__/api/admin/card-templates/
git commit -m "feat: add global card templates admin page and API"
```

---

## Task 11: 商品模版选择器组件

**Files:**
- Create: `app/components/product-form-card-template-select.tsx`

- [ ] **Step 1: 创建文件**

```typescript
"use client"

import { useState } from "react"
import { useFormContext } from "react-hook-form"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Plus, X } from "lucide-react"
import { parseTemplate } from "@/lib/card-format"
import type { ProductFormSchema } from "@/lib/validations/product"

type CardTemplate = { id: string; name: string; template: string }

export function ProductFormCardTemplateSelect({
  initialTemplates,
}: {
  initialTemplates: CardTemplate[]
}) {
  const { watch, setValue } = useFormContext<ProductFormSchema>()
  const templateIds = (watch("cardTemplateIds") ?? []) as string[]

  const [templates, setTemplates] = useState<CardTemplate[]>(initialTemplates)
  const [newName, setNewName] = useState("")
  const [newTemplate, setNewTemplate] = useState("")
  const [creating, setCreating] = useState(false)

  const parsedPreview = parseTemplate(newTemplate)

  const toggleTemplate = (id: string) => {
    const next = templateIds.includes(id)
      ? templateIds.filter((t) => t !== id)
      : [...templateIds, id]
    setValue("cardTemplateIds", next)
  }

  const handleCreate = async () => {
    if (!newName.trim() || !newTemplate.trim()) return
    if (!parseTemplate(newTemplate)) {
      toast.error("模板格式无效，请至少包含两个 {字段名} 和分隔符")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/admin/card-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), template: newTemplate.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error((data as { error?: string }).error ?? "创建模版失败")
        return
      }
      const created = await res.json() as CardTemplate
      setTemplates((prev) => [...prev, created])
      setValue("cardTemplateIds", [...templateIds, created.id])
      setNewName("")
      setNewTemplate("")
      toast.success("模版已创建并选中")
    } catch {
      toast.error("创建模版失败")
    } finally {
      setCreating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>卡密模版</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {templates.length > 0 && (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {templates.map((t) => {
              const parsed = parseTemplate(t.template)
              return (
                <label
                  key={t.id}
                  className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                >
                  <Checkbox
                    checked={templateIds.includes(t.id)}
                    onCheckedChange={() => toggleTemplate(t.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{t.name}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">{t.template}</div>
                    {parsed && (
                      <div className="text-xs text-muted-foreground">{parsed.fields.length} 字段</div>
                    )}
                  </div>
                </label>
              )
            })}
          </div>
        )}

        {templateIds.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2 border-t">
            {templateIds.map((id) => {
              const t = templates.find((x) => x.id === id)
              return t ? (
                <Badge key={id} variant="secondary" className="gap-1 pr-1">
                  {t.name}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ml-0.5 size-5 rounded-full p-0 hover:bg-muted-foreground/20"
                    onClick={() => toggleTemplate(id)}
                    aria-label="移除模版"
                  >
                    <X className="size-3" />
                  </Button>
                </Badge>
              ) : null
            })}
          </div>
        )}

        <div className="space-y-2 pt-2 border-t">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="模版名称..."
            className="h-8 text-sm"
          />
          <div className="flex items-center gap-2">
            <Input
              value={newTemplate}
              onChange={(e) => setNewTemplate(e.target.value)}
              placeholder="{账号}----{密码}"
              className="h-8 text-sm font-mono"
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleCreate() }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCreate}
              disabled={creating || !newName.trim() || !newTemplate.trim()}
            >
              {creating ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
            </Button>
          </div>
          {parsedPreview && newTemplate && (
            <p className="text-xs text-muted-foreground">
              {parsedPreview.fields.join(" · ")}（{parsedPreview.fields.length} 字段）
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## Task 12: 更新 ProductForm — 接入模版选择器

**Files:**
- Modify: `app/components/product-form.tsx`

- [ ] **Step 1: 添加 import**

在现有 import 列表中，`import { ProductFormTagSelect }` 后面加：

```typescript
import { ProductFormCardTemplateSelect } from "./product-form-card-template-select"
```

- [ ] **Step 2: 扩展 `ProductData` 类型**

在 `type ProductData = {` 内部，`tags: Tag[]` 后面加：

```typescript
    cardTemplates: { id: string; name: string; template: string }[]
```

- [ ] **Step 3: 扩展函数签名**

在 `export function ProductForm({` 的参数部分，`allTags: Tag[]` 后面加：

```typescript
    allCardTemplates: { id: string; name: string; template: string }[]
```

- [ ] **Step 4: 更新 form defaultValues**

在 `tagIds: product?.tags.map((t) => t.id) ?? [],` 后面加：

```typescript
            cardTemplateIds: product?.cardTemplates.map((t) => t.id) ?? [],
```

- [ ] **Step 5: 更新 onSubmit body**

在 `tagIds: data.tagIds ?? [],` 后面加：

```typescript
            cardTemplateIds: data.cardTemplateIds ?? [],
```

- [ ] **Step 6: 渲染选择器**

在 `<ProductFormTagSelect initialTags={allTags} />` 后面加：

```tsx
                            <ProductFormCardTemplateSelect initialTemplates={allCardTemplates} />
```

- [ ] **Step 7: 运行 lint**

```bash
npm run lint
```

预期：无类型报错。

---

## Task 13: 更新商品编辑页

**Files:**
- Modify: `app/admin/(main)/products/[productId]/page.tsx`
- Delete: `app/admin/(main)/products/[productId]/product-card-formats.tsx`

- [ ] **Step 1: 更新 page.tsx**

完整替换文件内容：

```typescript
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"
import { ProductForm } from "@/app/components/product-form"
import { DeactivateProductButton } from "./product-actions"

export const dynamic = "force-dynamic"

type PageProps = {
    params: Promise<{ productId: string }>
}

export default async function AdminEditProductPage({ params }: PageProps) {
    const { productId } = await params

    const [product, tags, cardTemplates] = await Promise.all([
        prisma.product.findUnique({
            where: { id: productId },
            include: {
                tags: {
                    select: { id: true, name: true, slug: true },
                },
                cardTemplates: {
                    select: { id: true, name: true, template: true },
                },
            },
        }),
        prisma.tag.findMany({
            select: { id: true, name: true, slug: true },
            orderBy: { name: "asc" },
        }),
        prisma.cardTemplate.findMany({
            select: { id: true, name: true, template: true },
            orderBy: { sortOrder: "asc" },
        }),
    ])

    if (!product) {
        notFound()
    }

    return (
        <div className="space-y-6">
            <ProductForm
                product={{
                    ...product,
                    price: Number(product.price),
                }}
                allTags={tags}
                allCardTemplates={cardTemplates}
                sourceUrlOptions={config.autoFetchSourceUrls}
            />

            {/* Danger zone */}
            <div className="rounded-lg border border-destructive/20 p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-medium">
                            {product.status === "ACTIVE" ? "下架商品" : "上架商品"}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            {product.status === "ACTIVE"
                                ? "将商品从前台移除"
                                : "将商品重新在前台展示"}
                        </p>
                    </div>
                    <DeactivateProductButton
                        productId={product.id}
                        currentStatus={product.status}
                    />
                </div>
            </div>
        </div>
    )
}
```

- [ ] **Step 2: 删除旧组件**

```bash
git rm app/admin/(main)/products/[productId]/product-card-formats.tsx
```

- [ ] **Step 3: 删除旧 card-formats API 路由**

```bash
git rm app/api/products/[productId]/card-formats/route.ts
git rm "app/api/products/[productId]/card-formats/[formatId]/route.ts"
```

- [ ] **Step 4: Commit**

```bash
git add app/admin/(main)/products/[productId]/page.tsx app/components/product-form.tsx app/components/product-form-card-template-select.tsx
git commit -m "feat: replace per-product card formats with global template selector"
```

- [ ] **Step 5: 同步更新新建商品页**

完整替换 `app/admin/(main)/products/new/page.tsx`：

```typescript
import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"
import { ProductForm } from "@/app/components/product-form"

export const dynamic = "force-dynamic"

export default async function AdminNewProductPage() {
    const [tags, cardTemplates] = await Promise.all([
        prisma.tag.findMany({
            select: { id: true, name: true, slug: true },
            orderBy: { name: "asc" },
        }),
        prisma.cardTemplate.findMany({
            select: { id: true, name: true, template: true },
            orderBy: { sortOrder: "asc" },
        }),
    ])

    return (
        <ProductForm
            allTags={tags}
            allCardTemplates={cardTemplates}
            sourceUrlOptions={config.autoFetchSourceUrls}
        />
    )
}
```

---

## Task 14: 更新订单成功页（消费端）

**Files:**
- Modify: `app/orders/[orderNo]/success/page.tsx`

- [ ] **Step 1: 更新 Prisma 查询**

找到：

```typescript
                    cardFormats: {
                        orderBy: { sortOrder: "asc" },
                        select: { template: true },
                    },
```

替换为：

```typescript
                    cardTemplates: {
                        orderBy: { sortOrder: "asc" },
                        select: { template: true },
                    },
```

- [ ] **Step 2: 更新变量引用**

找到：

```typescript
    const cardFormats = order.product?.cardFormats ?? []
    const resolvedCards = order.cards.map((c) => resolveCardFields(c.content, cardFormats))
```

替换为：

```typescript
    const cardTemplates = order.product?.cardTemplates ?? []
    const resolvedCards = order.cards.map((c) => resolveCardFields(c.content, cardTemplates))
```

- [ ] **Step 3: 运行 lint**

```bash
npm run lint
```

预期：无报错（`resolveCardFields` 接受 `Array<{ template: string }>` 签名不变）。

- [ ] **Step 4: Commit**

```bash
git add app/orders/[orderNo]/success/page.tsx
git commit -m "fix: update order success page to use cardTemplates"
```

---

## Task 15: 更新侧边栏导航

**Files:**
- Modify: `app/components/admin-sidebar.tsx`

- [ ] **Step 1: 添加图标 import**

在现有 lucide-react import 中添加 `FileCode`（或 `LayoutTemplate`）：

```typescript
import {
    // ... 现有图标 ...
    LayoutTemplate,
} from "lucide-react"
```

- [ ] **Step 2: 在 `allNavItems` 中插入新条目**

在 `{ title: "卡密管理", href: "/admin/cards", icon: CreditCard },` 后面加：

```typescript
    { title: "卡密模版", href: "/admin/card-templates", icon: LayoutTemplate },
```

- [ ] **Step 3: Commit**

```bash
git add app/components/admin-sidebar.tsx
git commit -m "feat(sidebar): add card-templates nav entry"
```

---

## Task 16: Phase 2 — Schema：删除 ProductCardFormat

**Files:**
- Modify: `prisma/schema.prisma`

> ⚠️ 此步骤之前请确保 Task 2 的数据迁移 SQL 已成功执行。

- [ ] **Step 1: 编辑 `prisma/schema.prisma`**

1. 在 `Product` 模型中删除：`cardFormats ProductCardFormat[]`
2. 删除整个 `model ProductCardFormat { ... }` 块

- [ ] **Step 2: 生成并运行 Phase 2 迁移**

```bash
npm run db:migrate
```

迁移名称输入：`remove_product_card_format`

预期：迁移成功，`ProductCardFormat` 表被 DROP。

- [ ] **Step 3: 生成 Prisma Client**

```bash
npm run db:generate
```

- [ ] **Step 4: 运行 lint 和测试，确认无残留引用**

```bash
npm run lint
npm test
```

预期：无报错。

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): remove ProductCardFormat, complete migration to CardTemplate"
```

---

## Task 17: 最终冒烟测试

- [ ] **Step 1: 启动开发服务器**

```bash
npm run dev
```

- [ ] **Step 2: 验证卡密模版管理页**

访问 `/admin/card-templates`：
- 列表正常展示（若 Task 2 已跑，显示已迁移模版）
- 点击"新建模版"，创建一个 `{账号}----{密码}` 格式的模版
- 编辑模版，保存，列表更新
- 删除未被使用的模版，确认成功
- 尝试删除已关联商品的模版，应返回错误提示

- [ ] **Step 3: 验证商品编辑页**

访问 `/admin/products/{productId}`：
- "卡密模版"卡片出现在侧边栏（右列）
- 勾选一个模版，保存商品，再次进入页面确认勾选状态保留
- 内联创建新模版，创建后自动勾选

- [ ] **Step 4: 验证订单成功页**

访问一个已完成的 NORMAL 商品订单的 `/orders/{orderNo}/success?token=...`：
- 卡密字段按模版格式正确解析（非纯文本）

- [ ] **Step 5: 运行全量测试**

```bash
npm test
```

预期：所有测试通过。
