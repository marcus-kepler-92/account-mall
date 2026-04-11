# Product Drag-and-Drop Sort Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace pin-based product ordering with drag-and-drop sorting that persists to DB and syncs to storefront.

**Architecture:** Add `sortOrder` field to `Product`, remove `pinnedAt`. A new `PATCH /api/admin/products/reorder` API batch-updates sort order. The admin product list uses `@dnd-kit/sortable` for drag-and-drop with per-row grip handles; the storefront reads `sortOrder ASC`.

**Tech Stack:** Prisma (schema + migration), `@dnd-kit/core` + `@dnd-kit/sortable`, TanStack Table, Next.js App Router API routes, Jest

---

## File Map

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `sortOrder`, remove `pinnedAt` from Product |
| `lib/validations/product.ts` | Remove `pinned` from `updateProductSchema` |
| `app/api/products/route.ts` | Default orderBy → `sortOrder ASC`; new product gets `MAX(sortOrder)+1` |
| `app/api/products/[productId]/route.ts` | Remove `pinned` handling from PUT |
| `app/api/admin/products/reorder/route.ts` | **New** — `PATCH` batch reorder |
| `app/admin/(main)/products/products-columns.tsx` | Add drag handle column, remove `pinnedAt` |
| `app/admin/(main)/products/products-data-table.tsx` | Integrate dnd-kit, hide handles when filtered |
| `app/admin/(main)/products/product-row-actions.tsx` | Remove pin/unpin |
| `app/admin/(main)/products/page.tsx` | orderBy → `sortOrder ASC` |
| `__tests__/api/products-route.test.ts` | Update default sort assertion |
| `__tests__/api/products-productId.test.ts` | Remove `pinnedAt` from mock data, remove pin tests |
| `__tests__/api/products-reorder.test.ts` | **New** — reorder endpoint tests |
| `__tests__/schema/schema.test.ts` | Replace `pinnedAt: null` with `sortOrder: 0` |

---

## Task 1: Update Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Edit schema — remove `pinnedAt`, add `sortOrder`**

In `prisma/schema.prisma`, find the `model Product` block and make these changes:

Remove this line:
```
  pinnedAt         DateTime?
```

Add after `createdAt`:
```
  sortOrder        Int           @default(0)
```

Replace the existing index block (which currently contains `@@index([pinnedAt])` if any) or add the new index. The model's index section should include:
```
  @@index([sortOrder])
```

- [ ] **Step 2: Verify schema compiles**

```bash
npm run db:generate
```

Expected: no errors, Prisma client regenerated.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): replace pinnedAt with sortOrder on Product"
```

---

## Task 2: Remove `pinned` from validation schema

**Files:**
- Modify: `lib/validations/product.ts`

- [ ] **Step 1: Remove `pinned` field from `updateProductSchema`**

In `lib/validations/product.ts`, in the `updateProductSchema` object, remove this line:

```typescript
    pinned: z.boolean().optional(),
```

- [ ] **Step 2: Commit**

```bash
git add lib/validations/product.ts
git commit -m "feat(validation): remove pinned field from updateProductSchema"
```

---

## Task 3: Write and run failing tests for the reorder API

**Files:**
- Create: `__tests__/api/products-reorder.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// __tests__/api/products-reorder.test.ts
import { type NextRequest } from "next/server"
import { PATCH } from "@/app/api/admin/products/reorder/route"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getAdminSession: jest.fn(),
}))

import { getAdminSession } from "@/lib/auth-guard"

function createJsonRequest(body: unknown): NextRequest {
    return { json: async () => body } as unknown as NextRequest
}

describe("PATCH /api/admin/products/reorder", () => {
    const adminSessionMock = getAdminSession as jest.Mock

    beforeEach(() => {
        adminSessionMock.mockReset()
        prismaMock.$transaction.mockReset()
    })

    it("returns 401 when not authenticated", async () => {
        adminSessionMock.mockResolvedValueOnce(null)

        const res = await PATCH(createJsonRequest({ ids: ["p1", "p2"] }))
        const data = await res.json()

        expect(res.status).toBe(401)
        expect(data).toEqual({ error: "Unauthorized" })
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })

    it("returns 400 when ids is missing", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

        const res = await PATCH(createJsonRequest({}))
        const data = await res.json()

        expect(res.status).toBe(400)
    })

    it("returns 400 when ids is not an array", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

        const res = await PATCH(createJsonRequest({ ids: "p1" }))
        const data = await res.json()

        expect(res.status).toBe(400)
    })

    it("batch-updates sortOrder and returns 200", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.$transaction.mockResolvedValueOnce(undefined)

        const res = await PATCH(createJsonRequest({ ids: ["p3", "p1", "p2"] }))
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toEqual({ ok: true })
        expect(prismaMock.$transaction).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.anything(), // p3 → sortOrder 0
                expect.anything(), // p1 → sortOrder 1
                expect.anything(), // p2 → sortOrder 2
            ])
        )
    })
})
```

- [ ] **Step 2: Run to confirm tests fail (file doesn't exist yet)**

```bash
npx jest __tests__/api/products-reorder.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module '@/app/api/admin/products/reorder/route'"

---

## Task 4: Implement the reorder API

**Files:**
- Create: `app/api/admin/products/reorder/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/admin/products/reorder/route.ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, validationError } from "@/lib/api-response"

const reorderSchema = z.object({
    ids: z.array(z.string()).min(1),
})

export async function PATCH(request: NextRequest) {
    const session = await getAdminSession()
    if (!session) {
        return unauthorized()
    }

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const parsed = reorderSchema.safeParse(body)
    if (!parsed.success) {
        return validationError(parsed.error.flatten())
    }

    const { ids } = parsed.data

    await prisma.$transaction(
        ids.map((id, index) =>
            prisma.product.update({
                where: { id },
                data: { sortOrder: index },
            })
        )
    )

    return NextResponse.json({ ok: true })
}

export const runtime = "nodejs"
```

- [ ] **Step 2: Run the tests**

```bash
npx jest __tests__/api/products-reorder.test.ts --no-coverage
```

Expected: all 4 tests PASS

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/products/reorder/route.ts __tests__/api/products-reorder.test.ts
git commit -m "feat(api): add PATCH /api/admin/products/reorder endpoint"
```

---

## Task 5: Update `GET /api/products` default sort + new product sortOrder

**Files:**
- Modify: `app/api/products/route.ts`
- Modify: `__tests__/api/products-route.test.ts`

- [ ] **Step 1: Update default sort test assertion**

In `__tests__/api/products-route.test.ts`, find the test `"returns only ACTIVE products for public request (no admin param)"`. The `orderBy` assertion currently checks for `pinnedAt`. Replace it — the test only checks `where`, so this test doesn't need changing.

Find the test for default sort (if any that checks `orderBy` includes `pinnedAt`). Add a new test for default sort:

```typescript
it("uses sortOrder ASC as default sort", async () => {
    prismaMock.product.findMany.mockResolvedValueOnce([])
    prismaMock.product.count.mockResolvedValueOnce(0)

    await GET(createUrlRequest("http://localhost/api/products"))

    expect(prismaMock.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
            orderBy: [{ sortOrder: "asc" }],
        })
    )
})
```

- [ ] **Step 2: Run to confirm new test fails**

```bash
npx jest __tests__/api/products-route.test.ts --no-coverage
```

Expected: the new test FAIL (still uses `pinnedAt` orderBy)

- [ ] **Step 3: Update `GET /api/products` — default orderBy**

In `app/api/products/route.ts`, replace the `orderBy` construction block:

Old:
```typescript
    const sortOrder =
        sort === "price-asc"
            ? { price: "asc" as const }
            : sort === "price-desc"
              ? { price: "desc" as const }
              : { createdAt: "desc" as const };
    const orderBy = [
        { pinnedAt: { sort: "desc" as const, nulls: "last" as const } },
        sortOrder,
    ];
```

New:
```typescript
    const orderBy =
        sort === "price-asc"
            ? [{ price: "asc" as const }]
            : sort === "price-desc"
              ? [{ price: "desc" as const }]
              : sort === "newest"
                ? [{ createdAt: "desc" as const }]
                : [{ sortOrder: "asc" as const }]
```

- [ ] **Step 4: Update `POST /api/products` — set sortOrder on create**

In `app/api/products/route.ts`, in the `POST` handler, before the `prisma.product.create` call, add:

```typescript
    const maxSortOrder = await prisma.product.aggregate({
        _max: { sortOrder: true },
    })
    const nextSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1
```

Then in the `prisma.product.create` `data` object, add:
```typescript
            sortOrder: nextSortOrder,
```

- [ ] **Step 5: Run all products-route tests**

```bash
npx jest __tests__/api/products-route.test.ts --no-coverage
```

Expected: all tests PASS (including new default sort test)

- [ ] **Step 6: Commit**

```bash
git add app/api/products/route.ts __tests__/api/products-route.test.ts
git commit -m "feat(api): use sortOrder for default product ordering; set sortOrder on create"
```

---

## Task 6: Remove `pinned` from PUT handler and update tests

**Files:**
- Modify: `app/api/products/[productId]/route.ts`
- Modify: `__tests__/api/products-productId.test.ts`

- [ ] **Step 1: Update product mock objects in test file — replace `pinnedAt` with `sortOrder`**

In `__tests__/api/products-productId.test.ts`, find every mock object that has `pinnedAt: null` and replace with `sortOrder: 0`. There are three occurrences (lines ~67, ~113 in the test file). Example:

```typescript
// Before
      pinnedAt: null,
// After
      sortOrder: 0,
```

- [ ] **Step 2: Remove pin-related test cases**

In `__tests__/api/products-productId.test.ts`, remove any `it(...)` blocks that test `pinned: true` or `pinned: false` PUT behavior (setting/clearing `pinnedAt`).

- [ ] **Step 3: Run tests to confirm they pass without pin logic**

```bash
npx jest __tests__/api/products-productId.test.ts --no-coverage
```

Expected: all remaining tests PASS

- [ ] **Step 4: Remove `pinned` handling from PUT route**

In `app/api/products/[productId]/route.ts`, in the `PUT` handler:

Remove `pinned` from the destructure line:
```typescript
    // Before
    const { tagIds, productType, sourceUrl, price, pinned, validityHours, ... } = parsed.data;

    // After
    const { tagIds, productType, sourceUrl, price, validityHours, ... } = parsed.data;
```

Remove these two lines from `updateData`:
```typescript
        ...(pinned === true && { pinnedAt: new Date() }),
        ...(pinned === false && { pinnedAt: null }),
```

- [ ] **Step 5: Run tests again**

```bash
npx jest __tests__/api/products-productId.test.ts --no-coverage
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add app/api/products/[productId]/route.ts __tests__/api/products-productId.test.ts
git commit -m "feat(api): remove pinnedAt/pinned logic from product PUT handler"
```

---

## Task 7: Update schema test fixtures

**Files:**
- Modify: `__tests__/schema/schema.test.ts`

- [ ] **Step 1: Replace `pinnedAt` references with `sortOrder`**

In `__tests__/schema/schema.test.ts`, replace all three occurrences of:
```typescript
      pinnedAt: null,
```
with:
```typescript
      sortOrder: 0,
```

- [ ] **Step 2: Run the schema tests**

```bash
npx jest __tests__/schema/schema.test.ts --no-coverage
```

Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add __tests__/schema/schema.test.ts
git commit -m "test(schema): replace pinnedAt with sortOrder in fixtures"
```

---

## Task 8: Install dnd-kit

**Files:**
- `package.json` (updated by npm)

- [ ] **Step 1: Install packages**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Verify install**

```bash
npm ls @dnd-kit/core
```

Expected: shows `@dnd-kit/core@x.x.x`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities"
```

---

## Task 9: Update products-columns — add drag handle, remove pinnedAt

**Files:**
- Modify: `app/admin/(main)/products/products-columns.tsx`

- [ ] **Step 1: Update `ProductRow` type and columns**

Replace the entire file content:

```typescript
"use client"

import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { GripVertical } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { DataTableColumnHeader } from "@/app/admin/components"
import { ProductRowActions } from "./product-row-actions"

export type ProductRow = {
    id: string
    name: string
    slug: string
    status: "ACTIVE" | "INACTIVE"
    productType: string
    price: number
    tags: { id: string; name: string; slug: string }[]
    stock: number
}

const statusMap: Record<ProductRow["status"], { label: string; variant: "default" | "secondary" }> = {
    ACTIVE: { label: "上架", variant: "default" },
    INACTIVE: { label: "下架", variant: "secondary" },
}

export const productsColumns: ColumnDef<ProductRow>[] = [
    {
        id: "drag-handle",
        header: () => null,
        cell: () => (
            <span className="drag-handle flex items-center justify-center cursor-grab text-muted-foreground">
                <GripVertical className="size-4" />
            </span>
        ),
        size: 40,
        enableSorting: false,
        enableHiding: false,
    },
    {
        accessorKey: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="名称" />,
        cell: ({ row }) => (
            <div>
                <div className="flex items-center gap-2">
                    <Link
                        href={`/admin/products/${row.original.id}`}
                        className="font-medium hover:underline"
                    >
                        {row.original.name}
                    </Link>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">/{row.original.slug}</div>
            </div>
        ),
    },
    {
        accessorKey: "price",
        header: ({ column }) => <DataTableColumnHeader column={column} title="价格" />,
        cell: ({ row }) => formatCurrency(row.original.price),
    },
    {
        accessorKey: "stock",
        header: ({ column }) => <DataTableColumnHeader column={column} title="库存" />,
    },
    {
        accessorKey: "status",
        header: "状态",
        cell: ({ row }) => {
            const { label, variant } = statusMap[row.original.status]
            return <Badge variant={variant}>{label}</Badge>
        },
        filterFn: (row, id, value: string) => !value || row.getValue(id) === value,
    },
    {
        id: "tags",
        accessorFn: (row) => row.tags.map((t) => t.name).join(", "),
        header: "标签",
        cell: ({ row }) => (
            <div className="flex flex-wrap gap-1">
                {row.original.tags.map((tag) => (
                    <Badge key={tag.id} variant="outline" className="text-xs">
                        {tag.name}
                    </Badge>
                ))}
            </div>
        ),
    },
    {
        id: "actions",
        header: () => <div className="text-right">操作</div>,
        cell: ({ row }) => (
            <div className="text-right">
                <ProductRowActions
                    productId={row.original.id}
                    productName={row.original.name}
                    slug={row.original.slug}
                    status={row.original.status}
                    productType={row.original.productType}
                    isFree={row.original.productType === "AUTO_FETCH" && row.original.price === 0}
                />
            </div>
        ),
    },
]
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/(main)/products/products-columns.tsx
git commit -m "feat(admin): add drag handle column, remove pinnedAt from ProductRow"
```

---

## Task 10: Update product-row-actions — remove pin/unpin

**Files:**
- Modify: `app/admin/(main)/products/product-row-actions.tsx`

- [ ] **Step 1: Remove all pin-related code**

In `product-row-actions.tsx`:

1. Remove `Pin, PinOff` from the lucide-react import.
2. Remove `pinnedAt` from `ProductRowActionsProps` type.
3. Remove `pinnedAt` from the function parameter destructure.
4. Remove `const isPinned = !!pinnedAt` line.
5. Remove `const [pinLoading, setPinLoading] = useState(false)` line.
6. Remove the entire `handleTogglePin` function.
7. Remove the `<DropdownMenuItem>` for pin/unpin (the one that calls `handleTogglePin`).

The resulting props type:
```typescript
type ProductRowActionsProps = {
    productId: string
    productName: string
    slug: string
    status: string
    productType: string
    isFree: boolean
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/(main)/products/product-row-actions.tsx
git commit -m "feat(admin): remove pin/unpin from product row actions"
```

---

## Task 11: Update admin products page — orderBy sortOrder

**Files:**
- Modify: `app/admin/(main)/products/page.tsx`

- [ ] **Step 1: Update the page**

In `app/admin/(main)/products/page.tsx`:

1. Change `orderBy` in `prisma.product.findMany`:

```typescript
// Before
            orderBy: [
                { pinnedAt: { sort: "desc", nulls: "last" } },
                { createdAt: "desc" },
            ],
```
```typescript
// After
            orderBy: [{ sortOrder: "asc" }],
```

2. Remove `pinnedAt` from the `ProductRow` mapping:

```typescript
// Before
        pinnedAt: p.pinnedAt?.toISOString() ?? null,
```

Remove that line entirely (field no longer in `ProductRow`).

- [ ] **Step 2: Commit**

```bash
git add app/admin/(main)/products/page.tsx
git commit -m "feat(admin): order products by sortOrder in admin list page"
```

---

## Task 12: Integrate dnd-kit into products-data-table

**Files:**
- Modify: `app/admin/(main)/products/products-data-table.tsx`

- [ ] **Step 1: Replace the entire file**

```typescript
"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core"
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from "@dnd-kit/sortable"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import { CSS } from "@dnd-kit/utilities"
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    flexRender,
    type SortingState,
    type ColumnFiltersState,
    type VisibilityState,
    type Row,
} from "@tanstack/react-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ClientDataTableToolbar, ClientDataTablePagination } from "@/app/admin/components"
import { productsColumns, type ProductRow } from "./products-columns"

// Sortable row wrapper — binds dnd-kit transform to the <tr> element.
// The drag-handle column cell uses .drag-handle class to receive listeners.
function SortableRow({ row, isFiltered }: { row: Row<ProductRow>; isFiltered: boolean }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: row.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: "relative" as const,
        zIndex: isDragging ? 1 : undefined,
    }

    return (
        <TableRow ref={setNodeRef} style={style} data-state={row.getIsSelected() && "selected"}>
            {row.getVisibleCells().map((cell) => {
                const isDragHandle = cell.column.id === "drag-handle"
                return (
                    <TableCell
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                        className={isDragHandle && isFiltered ? "pointer-events-none opacity-0" : undefined}
                        {...(isDragHandle && !isFiltered ? { ...attributes, ...listeners } : {})}
                    >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                )
            })}
        </TableRow>
    )
}

const statusOptions = [
    { label: "全部", value: "" },
    { label: "上架", value: "ACTIVE" },
    { label: "下架", value: "INACTIVE" },
]

export function ProductsDataTable({ data, actions }: { data: ProductRow[]; actions?: ReactNode }) {
    const router = useRouter()
    const [rows, setRows] = useState<ProductRow[]>(data)
    const [sorting, setSorting] = useState<SortingState>([])
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

    const isFiltered =
        columnFilters.length > 0 &&
        columnFilters.some((f) => f.value !== "" && f.value !== undefined)

    const table = useReactTable({
        data: rows,
        columns: productsColumns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        getRowId: (row) => row.id,
        initialState: { pagination: { pageSize: 20 } },
        state: { sorting, columnFilters, columnVisibility },
    })

    const sensors = useSensors(useSensor(PointerSensor))

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const oldIndex = rows.findIndex((r) => r.id === active.id)
        const newIndex = rows.findIndex((r) => r.id === over.id)
        const reordered = arrayMove(rows, oldIndex, newIndex)

        setRows(reordered) // optimistic update

        try {
            const res = await fetch("/api/admin/products/reorder", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: reordered.map((r) => r.id) }),
            })
            if (!res.ok) {
                throw new Error("reorder failed")
            }
        } catch {
            toast.error("排序保存失败，已恢复原顺序")
            router.refresh()
        }
    }

    const rowModel = table.getRowModel()

    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">商品列表</CardTitle>
                    {actions}
                </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
                <ClientDataTableToolbar
                    table={table}
                    searchColumn="name"
                    searchPlaceholder="搜索商品名称…"
                    statusColumn="status"
                    statusOptions={statusOptions}
                />
                <Separator />
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    modifiers={[restrictToVerticalAxis]}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={rowModel.rows.map((r) => r.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <Table>
                            <TableHeader>
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow key={headerGroup.id}>
                                        {headerGroup.headers.map((header) => (
                                            <TableHead
                                                key={header.id}
                                                style={{ width: header.getSize() }}
                                            >
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(
                                                          header.column.columnDef.header,
                                                          header.getContext()
                                                      )}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableHeader>
                            <TableBody>
                                {rowModel.rows.length ? (
                                    rowModel.rows.map((row) => (
                                        <SortableRow
                                            key={row.id}
                                            row={row}
                                            isFiltered={isFiltered}
                                        />
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell
                                            colSpan={productsColumns.length}
                                            className="h-24 text-center"
                                        >
                                            暂无商品
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </SortableContext>
                </DndContext>
                <ClientDataTablePagination table={table} />
            </CardContent>
        </Card>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/(main)/products/products-data-table.tsx
git commit -m "feat(admin): integrate dnd-kit drag-and-drop into products data table"
```

---

## Task 13: Run full test suite

- [ ] **Step 1: Run all tests**

```bash
npm test -- --no-coverage
```

Expected: all tests PASS. If any test references `pinnedAt` and fails, update the mock objects in that test file to use `sortOrder: 0` instead.

- [ ] **Step 2: Fix any remaining pinnedAt references in tests**

```bash
grep -r "pinnedAt" __tests__/
```

For each match, replace `pinnedAt: null` → `sortOrder: 0` and re-run the test.

- [ ] **Step 3: Commit any fixes**

```bash
git add __tests__/
git commit -m "test: fix remaining pinnedAt references in test fixtures"
```

---

## Task 14: Manual SQL migration (Vercel Postgres)

This task is performed manually — no code changes.

- [ ] **Step 1: Run the following SQL in Vercel Postgres dashboard or via psql**

```sql
-- 1. Add sortOrder column
ALTER TABLE "Product" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- 2. Backfill based on original ordering (pinnedAt DESC NULLS LAST, createdAt DESC)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    ORDER BY "pinnedAt" DESC NULLS LAST, "createdAt" DESC
  ) - 1 AS rn
  FROM "Product"
)
UPDATE "Product" p SET "sortOrder" = r.rn FROM ranked r WHERE p.id = r.id;

-- 3. Drop pinnedAt
ALTER TABLE "Product" DROP COLUMN "pinnedAt";

-- 4. Create index
CREATE INDEX "Product_sortOrder_idx" ON "Product"("sortOrder");
```

- [ ] **Step 2: Verify**

```sql
SELECT id, name, "sortOrder" FROM "Product" ORDER BY "sortOrder" ASC LIMIT 10;
```

Expected: rows appear in the original display order with incrementing `sortOrder` values.

---

## Task 15: Check remaining pinnedAt references across codebase

- [ ] **Step 1: Search for any lingering references**

```bash
grep -r "pinnedAt" app/ lib/ --include="*.ts" --include="*.tsx"
```

Expected: no matches. If any remain, remove them (they'll be in components or API routes that reference `pinnedAt` on a product object).

- [ ] **Step 2: Also check tests not covered above**

```bash
grep -r "pinnedAt" __tests__/ --include="*.ts"
```

Remove any remaining `pinnedAt` from mock product objects (replace with `sortOrder: 0`).

- [ ] **Step 3: Final test run**

```bash
npm test -- --no-coverage
```

Expected: all PASS

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(products): complete drag-and-drop sort, remove pinnedAt"
```
