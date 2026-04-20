# Card Format Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to define card format templates per NORMAL product, enabling structured labeled display of multi-field cards on the order success page.

**Architecture:** New `ProductCardFormat` model stores per-product format templates in `{field}delimiter{field2}` syntax. Pure utility `resolveCardFields()` implements three-tier parsing (format match → label heuristic → plain text). The RSC order success page resolves fields server-side before passing `ResolvedCard[]` to the updated client component. Admin UI is a new section on the product edit page, hidden for AUTO_FETCH products.

**Tech Stack:** Prisma 6, Next.js 16 App Router (RSC + Client Components), shadcn/ui (Form, Dialog, AlertDialog), react-hook-form + Zod, Jest

---

### Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `ProductCardFormat` model and `Product` relation**

In `prisma/schema.prisma`, after the `Card` model block, add:

```prisma
model ProductCardFormat {
  id        String   @id @default(cuid())
  productId String
  name      String
  template  String
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([productId, sortOrder])
}
```

Also add to the `Product` model (after the `accountBlacklist` relation line):
```prisma
  cardFormats          ProductCardFormat[]
```

- [ ] **Step 2: Run migration**

```bash
npm run db:migrate
```

When prompted for migration name, enter: `add_product_card_formats`

Expected: migration created and applied, Prisma Client regenerated.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add ProductCardFormat model"
```

---

### Task 2: Core Utility — `lib/card-format.ts` (TDD)

**Files:**
- Create: `lib/card-format.ts`
- Create: `__tests__/lib/card-format.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/card-format.test.ts`:

```typescript
import { parseTemplate, resolveCardFields, type ResolvedCard } from "@/lib/card-format"

describe("parseTemplate", () => {
  it("parses template with ---- delimiter", () => {
    expect(parseTemplate("{账号}----{密码}----{生日}")).toEqual({
      delimiter: "----",
      fields: ["账号", "密码", "生日"],
    })
  })

  it("parses template with | delimiter", () => {
    expect(parseTemplate("{账号}|{密码}")).toEqual({
      delimiter: "|",
      fields: ["账号", "密码"],
    })
  })

  it("returns null for a single placeholder", () => {
    expect(parseTemplate("{账号}")).toBeNull()
  })

  it("returns null when placeholders are adjacent with no delimiter", () => {
    expect(parseTemplate("{账号}{密码}")).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(parseTemplate("")).toBeNull()
  })
})

describe("resolveCardFields", () => {
  const twoFieldFormat = [{ template: "{账号}----{密码}" }]
  const sixFieldFormat = [
    { template: "{账号}----{密码}----{密保朋友}----{工作答案}----{父母答案}----{生日}" },
  ]
  const bothFormats = [...twoFieldFormat, ...sixFieldFormat]

  it("matches a 2-field card", () => {
    const result = resolveCardFields("user@example.com----pass123", twoFieldFormat)
    expect(result).toEqual<ResolvedCard>({
      type: "formatted",
      fields: [
        { label: "账号", value: "user@example.com" },
        { label: "密码", value: "pass123" },
      ],
    })
  })

  it("matches the correct format among multiple", () => {
    const content =
      "user@example.com----pass123----friend_ans----work_ans----parent_ans----1990-01-01"
    const result = resolveCardFields(content, bothFormats)
    expect(result).toEqual<ResolvedCard>({
      type: "formatted",
      fields: [
        { label: "账号", value: "user@example.com" },
        { label: "密码", value: "pass123" },
        { label: "密保朋友", value: "friend_ans" },
        { label: "工作答案", value: "work_ans" },
        { label: "父母答案", value: "parent_ans" },
        { label: "生日", value: "1990-01-01" },
      ],
    })
  })

  it("trims whitespace from field values", () => {
    const result = resolveCardFields(" user@example.com ---- pass123 ", twoFieldFormat)
    expect(result).toEqual<ResolvedCard>({
      type: "formatted",
      fields: [
        { label: "账号", value: "user@example.com" },
        { label: "密码", value: "pass123" },
      ],
    })
  })

  it("falls back to label heuristic for self-labeled content with no formats", () => {
    const result = resolveCardFields("账号user@a.com----密码pass123", [])
    expect(result.type).toBe("formatted")
    if (result.type === "formatted") {
      expect(result.fields).toContainEqual({ label: "账号", value: "user@a.com" })
      expect(result.fields).toContainEqual({ label: "密码", value: "pass123" })
    }
  })

  it("falls back to label heuristic when no format matches field count", () => {
    // 3 parts but only 2-field format defined — content has labels so tier 2 kicks in
    const result = resolveCardFields(
      "账号user@a.com----密码pass123----密保答案朋友答案abc",
      twoFieldFormat
    )
    expect(result.type).toBe("formatted")
  })

  it("returns plain text for unlabeled content with no matching format", () => {
    const result = resolveCardFields("XXXX-XXXX-XXXX-XXXX", [])
    expect(result).toEqual<ResolvedCard>({ type: "plain", content: "XXXX-XXXX-XXXX-XXXX" })
  })

  it("returns plain text for positional card with no matching format", () => {
    // 3 parts, only 2-field format, no labels
    const result = resolveCardFields("part1----part2----part3", twoFieldFormat)
    expect(result).toEqual<ResolvedCard>({ type: "plain", content: "part1----part2----part3" })
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest __tests__/lib/card-format.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module '@/lib/card-format'"

- [ ] **Step 3: Implement `lib/card-format.ts`**

Create `lib/card-format.ts`:

```typescript
import { parseCardContentWithDelimiter } from "@/lib/auto-fetch-card"

export interface ParsedFormat {
  delimiter: string
  fields: string[]
}

export type ResolvedCard =
  | { type: "formatted"; fields: { label: string; value: string }[] }
  | { type: "plain"; content: string }

/**
 * Parse a template string like "{账号}----{密码}----{生日}" into delimiter and
 * ordered field names. Returns null if fewer than 2 placeholders or no delimiter.
 */
export function parseTemplate(template: string): ParsedFormat | null {
  const matches = [...template.matchAll(/\{([^}]+)\}/g)]
  if (matches.length < 2) return null

  const fields = matches.map((m) => m[1])
  const firstEnd = matches[0].index! + matches[0][0].length
  const secondStart = matches[1].index!
  const delimiter = template.slice(firstEnd, secondStart)

  if (!delimiter) return null

  return { delimiter, fields }
}

// Maps AutoFetchCardPayload keys to display labels for the heuristic path
const PAYLOAD_DISPLAY_LABELS: [string, string][] = [
  ["account", "账号"],
  ["password", "密码"],
  ["securityAnswerFriend", "密保朋友"],
  ["securityAnswerWork", "工作答案"],
  ["securityAnswerParents", "父母答案"],
  ["birthday", "生日"],
]

// Guard: only apply heuristic when content contains recognizable label prefixes
const LABEL_PATTERN = /账号|密码|password|account/i

/**
 * Resolve card content to labeled fields using three-tier logic:
 * 1. Match against configured product formats (delimiter + field count)
 * 2. Label-based heuristic for self-labeled content (e.g. "账号xxx----密码xxx")
 * 3. Plain text fallback
 */
export function resolveCardFields(
  content: string,
  formats: Array<{ template: string }>
): ResolvedCard {
  const trimmed = content.trim()

  // Tier 1: configured formats
  for (const fmt of formats) {
    const parsed = parseTemplate(fmt.template)
    if (!parsed) continue
    const parts = trimmed.split(parsed.delimiter).map((p) => p.trim())
    if (parts.length === parsed.fields.length && parts.every((p) => p !== "")) {
      return {
        type: "formatted",
        fields: parsed.fields.map((label, i) => ({ label, value: parts[i] })),
      }
    }
  }

  // Tier 2: label-based heuristic (only when content has recognizable label prefixes)
  if (LABEL_PATTERN.test(trimmed)) {
    const payload = parseCardContentWithDelimiter(trimmed, null)
    if (payload) {
      const fields: { label: string; value: string }[] = []
      for (const [key, label] of PAYLOAD_DISPLAY_LABELS) {
        const val = (payload as Record<string, unknown>)[key]
        if (typeof val === "string" && val && val !== "未知") {
          fields.push({ label, value: val })
        }
      }
      if (fields.length >= 2) {
        return { type: "formatted", fields }
      }
    }
  }

  // Tier 3: plain text
  return { type: "plain", content: trimmed }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest __tests__/lib/card-format.test.ts --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/card-format.ts __tests__/lib/card-format.test.ts
git commit -m "feat(lib): add card format parsing utility"
```

---

### Task 3: Zod Validation Schema

**Files:**
- Create: `lib/validations/card-format.ts`

- [ ] **Step 1: Create `lib/validations/card-format.ts`**

```typescript
import { z } from "zod"
import { parseTemplate } from "@/lib/card-format"

export const cardFormatSchema = z.object({
  name: z.string().min(1, "格式名称不能为空").max(50, "格式名称不超过 50 字符"),
  template: z
    .string()
    .min(1, "格式模板不能为空")
    .refine((val) => parseTemplate(val) !== null, {
      message: "模板至少包含两个 {字段名}，且字段之间需有分隔符",
    }),
})

export type CardFormatInput = z.infer<typeof cardFormatSchema>
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep card-format
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add lib/validations/card-format.ts
git commit -m "feat(validations): add card format Zod schema"
```

---

### Task 4: Admin API — Card Formats CRUD

**Files:**
- Create: `app/api/products/[productId]/card-formats/route.ts`
- Create: `app/api/products/[productId]/card-formats/[formatId]/route.ts`

- [ ] **Step 1: Create collection route**

Create `app/api/products/[productId]/card-formats/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError, notFound } from "@/lib/api-response"
import { cardFormatSchema } from "@/lib/validations/card-format"

type RouteContext = { params: Promise<{ productId: string }> }

const FORMAT_SELECT = {
  id: true,
  name: true,
  template: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { productId } = await params
  const formats = await prisma.productCardFormat.findMany({
    where: { productId },
    orderBy: { sortOrder: "asc" },
    select: FORMAT_SELECT,
  })
  return NextResponse.json(formats)
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { productId } = await params

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  })
  if (!product) return notFound("商品不存在")

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return invalidJsonBody()
  }

  const parsed = cardFormatSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const maxOrder = await prisma.productCardFormat.aggregate({
    where: { productId },
    _max: { sortOrder: true },
  })
  const nextSort = (maxOrder._max.sortOrder ?? -1) + 1

  const format = await prisma.productCardFormat.create({
    data: {
      productId,
      name: parsed.data.name,
      template: parsed.data.template,
      sortOrder: nextSort,
    },
    select: FORMAT_SELECT,
  })
  return NextResponse.json(format, { status: 201 })
}
```

- [ ] **Step 2: Create resource route**

Create `app/api/products/[productId]/card-formats/[formatId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError, notFound } from "@/lib/api-response"
import { cardFormatSchema } from "@/lib/validations/card-format"

type RouteContext = { params: Promise<{ productId: string; formatId: string }> }

const FORMAT_SELECT = {
  id: true,
  name: true,
  template: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { productId, formatId } = await params

  const existing = await prisma.productCardFormat.findFirst({
    where: { id: formatId, productId },
  })
  if (!existing) return notFound("格式不存在")

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return invalidJsonBody()
  }

  const parsed = cardFormatSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const updated = await prisma.productCardFormat.update({
    where: { id: formatId },
    data: { name: parsed.data.name, template: parsed.data.template },
    select: FORMAT_SELECT,
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { productId, formatId } = await params

  const existing = await prisma.productCardFormat.findFirst({
    where: { id: formatId, productId },
  })
  if (!existing) return notFound("格式不存在")

  await prisma.productCardFormat.delete({ where: { id: formatId } })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: "✓ Build passed."

- [ ] **Step 4: Commit**

```bash
git add app/api/products/
git commit -m "feat(api): add card formats CRUD endpoints"
```

---

### Task 5: Admin UI — ProductCardFormats Component

**Files:**
- Create: `app/admin/(main)/products/[productId]/product-card-formats.tsx`
- Modify: `app/admin/(main)/products/[productId]/page.tsx`

- [ ] **Step 1: Create `product-card-formats.tsx`**

Create `app/admin/(main)/products/[productId]/product-card-formats.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Pencil, Trash2, Plus, Loader2 } from "lucide-react"
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
import { cardFormatSchema, type CardFormatInput } from "@/lib/validations/card-format"
import { parseTemplate } from "@/lib/card-format"

type CardFormat = {
  id: string
  name: string
  template: string
  sortOrder: number
}

type ProductCardFormatsProps = {
  productId: string
  initialFormats: CardFormat[]
}

export function ProductCardFormats({ productId, initialFormats }: ProductCardFormatsProps) {
  const router = useRouter()
  const [formats, setFormats] = useState<CardFormat[]>(initialFormats)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingFormat, setEditingFormat] = useState<CardFormat | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CardFormat | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const form = useForm<CardFormatInput>({
    resolver: zodResolver(cardFormatSchema),
    defaultValues: { name: "", template: "" },
  })

  const templateValue = form.watch("template")
  const parsedPreview = parseTemplate(templateValue)

  const openAdd = () => {
    setEditingFormat(null)
    form.reset({ name: "", template: "" })
    setDialogOpen(true)
  }

  const openEdit = (fmt: CardFormat) => {
    setEditingFormat(fmt)
    form.reset({ name: fmt.name, template: fmt.template })
    setDialogOpen(true)
  }

  const handleSubmit = async (data: CardFormatInput) => {
    setSubmitting(true)
    try {
      const url = editingFormat
        ? `/api/products/${productId}/card-formats/${editingFormat.id}`
        : `/api/products/${productId}/card-formats`
      const method = editingFormat ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error((json as { error?: string }).error ?? "保存失败")
        return
      }
      toast.success(editingFormat ? "格式已更新" : "格式已添加")
      setDialogOpen(false)
      if (editingFormat) {
        setFormats((prev) => prev.map((f) => (f.id === editingFormat.id ? { ...f, ...data } : f)))
      } else {
        setFormats((prev) => [...prev, json as CardFormat])
      }
      router.refresh()
    } catch {
      toast.error("操作失败，请重试")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/products/${productId}/card-formats/${deleteTarget.id}`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error((json as { error?: string }).error ?? "删除失败")
        return
      }
      toast.success("格式已删除")
      setFormats((prev) => prev.filter((f) => f.id !== deleteTarget.id))
      setDeleteTarget(null)
      router.refresh()
    } catch {
      toast.error("删除失败，请重试")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">卡密格式</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            定义卡密字段结构，展示时按格式解析。多格式按字段数量自动匹配。
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={openAdd}>
          <Plus className="size-4" />
          添加格式
        </Button>
      </div>

      {formats.length > 0 && (
        <div className="rounded-md border divide-y text-sm">
          {formats.map((fmt) => {
            const preview = parseTemplate(fmt.template)
            return (
              <div key={fmt.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-24 shrink-0 font-medium truncate">{fmt.name}</span>
                <span className="flex-1 font-mono text-xs text-muted-foreground truncate">
                  {fmt.template}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {preview ? `${preview.fields.length} 字段` : "—"}
                </span>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(fmt)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(fmt)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFormat ? "编辑格式" : "添加卡密格式"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>格式名称</FormLabel>
                    <FormControl>
                      <Input placeholder="例如：带密保版" {...field} />
                    </FormControl>
                    <FormDescription>仅用于内部识别，不对用户展示</FormDescription>
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
                      <Input
                        placeholder="{账号}----{密码}----{密保朋友}"
                        className="font-mono"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      用{" "}
                      <code className="text-xs rounded bg-muted px-1">{"{字段名}"}</code>{" "}
                      标记每个字段，字段间字符为分隔符
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {parsedPreview && (
                <div className="rounded-md border bg-muted/40 p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    分隔符：
                    <code className="font-mono text-xs bg-background border rounded px-1 ml-1">
                      {parsedPreview.delimiter}
                    </code>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {parsedPreview.fields.map((f, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-0.5 text-xs"
                      >
                        <span className="text-muted-foreground">{i + 1}</span>
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  保存
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除格式「{deleteTarget?.name}」？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可撤销。已导入的卡密不受影响，但展示时将退化为启发式解析或纯文本。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="size-4 animate-spin" />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

- [ ] **Step 2: Update product edit page**

In `app/admin/(main)/products/[productId]/page.tsx`:

Add import after existing imports:
```ts
import { ProductCardFormats } from "./product-card-formats"
```

Update the `prisma.product.findUnique` include to add `cardFormats`:
```ts
include: {
  tags: {
    select: { id: true, name: true, slug: true },
  },
  cardFormats: {
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, template: true, sortOrder: true },
  },
},
```

In the return JSX, add after `<ProductForm ... />` and before the danger zone `<div className="rounded-lg border border-destructive/20 ...">`:
```tsx
{product.productType !== "AUTO_FETCH" && (
  <div className="rounded-lg border p-4">
    <ProductCardFormats
      productId={product.id}
      initialFormats={product.cardFormats}
    />
  </div>
)}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: "✓ Build passed."

- [ ] **Step 4: Commit**

```bash
git add app/admin/(main)/products/[productId]/
git commit -m "feat(admin): add card format management to product settings"
```

---

### Task 6: Customer Display — Order Success Page

**Files:**
- Modify: `app/orders/[orderNo]/success/order-success-copy-section.tsx`
- Modify: `app/orders/[orderNo]/success/page.tsx`

- [ ] **Step 1: Replace `order-success-copy-section.tsx`**

Replace the entire file `app/orders/[orderNo]/success/order-success-copy-section.tsx`:

```tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"
import { toast } from "sonner"
import type { ResolvedCard } from "@/lib/card-format"

type OrderSuccessCopySectionProps = {
  cards: ResolvedCard[]
}

export function OrderSuccessCopySection({ cards }: OrderSuccessCopySectionProps) {
  const [copiedAll, setCopiedAll] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copyAll = async () => {
    if (cards.length === 0) return
    const lines = cards.map((card) => {
      if (card.type === "formatted") {
        return card.fields.map((f) => `${f.label}：${f.value}`).join("\n")
      }
      return card.content
    })
    try {
      await navigator.clipboard.writeText(lines.join("\n\n"))
      setCopiedAll(true)
      toast.success(`已复制 ${cards.length} 条卡密`)
      setTimeout(() => setCopiedAll(false), 2000)
    } catch {
      toast.error("复制失败，请手动复制")
    }
  }

  const copyOne = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      toast.success("已复制")
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error("复制失败")
    }
  }

  if (cards.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无卡密数据</p>
  }

  const isMultiCard = cards.length > 1

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="secondary"
        className="w-full gap-2"
        onClick={copyAll}
      >
        {copiedAll ? <Check className="size-4" /> : <Copy className="size-4" />}
        一键复制全部卡密（{cards.length} 条）
      </Button>

      <ul className={isMultiCard ? "grid grid-cols-1 md:grid-cols-2 gap-3" : "space-y-2"}>
        {cards.map((card, i) => {
          if (card.type === "formatted") {
            const copyText = card.fields.map((f) => `${f.label}：${f.value}`).join("\n")
            return (
              <li
                key={i}
                className="rounded-lg border border-border/80 bg-card shadow-sm overflow-hidden"
              >
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/30 border-b border-border/60">
                  <span className="text-xs text-muted-foreground">№{i + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => copyOne(copyText, `card-${i}`)}
                  >
                    {copiedId === `card-${i}` ? (
                      <Check className="size-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    复制
                  </Button>
                </div>
                <div className="divide-y divide-border/60">
                  {card.fields.map((field, j) => (
                    <div
                      key={j}
                      className="flex items-center justify-between gap-4 px-4 py-2.5"
                    >
                      <span className="text-xs font-medium text-muted-foreground shrink-0 w-20">
                        {field.label}
                      </span>
                      <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                        <code className="min-w-0 break-all font-mono text-sm text-foreground">
                          {field.value}
                        </code>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0 rounded-full hover:bg-muted"
                          onClick={() => copyOne(field.value, `field-${i}-${j}`)}
                          aria-label={`复制${field.label}`}
                        >
                          {copiedId === `field-${i}-${j}` ? (
                            <Check className="size-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </li>
            )
          }

          return (
            <li
              key={i}
              className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 font-mono text-sm"
            >
              <span className="min-w-0 flex-1 break-words">{card.content}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => copyOne(card.content, `plain-${i}`)}
              >
                {copiedId === `plain-${i}` ? (
                  <Check className="size-4 text-green-600" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Update order success page to resolve fields server-side**

In `app/orders/[orderNo]/success/page.tsx`:

Add import (alongside existing imports at top):
```ts
import { resolveCardFields } from "@/lib/card-format"
```

Update the `product` select inside the `prisma.order.findFirst` call to include `cardFormats`:
```ts
product: {
  select: {
    name: true,
    productType: true,
    allowAccountSwitch: true,
    accountSwitchLimit: true,
    cardFormats: {
      orderBy: { sortOrder: "asc" },
      select: { template: true },
    },
  },
},
```

Replace:
```ts
const cards = order.cards.map((c) => c.content)
```
with:
```ts
const cardFormats = order.product?.cardFormats ?? []
const resolvedCards = order.cards.map((c) => resolveCardFields(c.content, cardFormats))
```

Replace the JSX prop (inside the non-AUTO_FETCH branch):
```tsx
<OrderSuccessCopySection cards={resolvedCards} />
```

- [ ] **Step 3: Run all tests**

```bash
npm test -- --no-coverage 2>&1 | tail -10
```

Expected: all test suites PASS.

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: "✓ Build passed."

- [ ] **Step 5: Commit**

```bash
git add app/orders/[orderNo]/success/
git commit -m "feat(orders): render card fields using format templates"
```
