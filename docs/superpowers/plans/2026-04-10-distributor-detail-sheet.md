# Distributor Detail Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a right-side detail Sheet to the admin distributors page so all distributor info and actions are accessible on any screen size — row click opens the sheet, existing ⋯ menu stays untouched.

**Architecture:** Three-layer change: (1) `DataTable` gains optional `onRowClick` prop, (2) a new `DistributorDetailSheet` component encapsulates all info sections and all actions, (3) `distributors-data-table.tsx` wires them together and wraps the actions cell with `stopPropagation` so ⋯ clicks don't accidentally open the sheet.

**Tech Stack:** Next.js App Router, shadcn/ui Sheet + AlertDialog + Dialog, TanStack Table, React state, `router.refresh()`

---

## File Map

| File | Change |
|------|--------|
| `app/admin/components/data-table.tsx` | Add optional `onRowClick?: (row: TData) => void` prop; apply cursor-pointer + onClick to TableRow |
| `app/admin/(main)/distributors/distributor-detail-sheet.tsx` | **NEW** — Sheet with all info sections and all actions |
| `app/admin/(main)/distributors/distributors-columns.tsx` | Wrap `actions` cell in `<div onClick={e => e.stopPropagation()}>` |
| `app/admin/(main)/distributors/distributors-data-table.tsx` | Add `selectedRow` + `sheetOpen` state; pass `onRowClick` to DataTable; render `DistributorDetailSheet` |
| `__tests__/components/data-table-row-click.test.tsx` | **NEW** — test onRowClick fires, cursor class applied |
| `__tests__/components/distributor-detail-sheet.test.tsx` | **NEW** — test sheet renders all data sections |

---

### Task 1: Add `onRowClick` to DataTable

**Files:**
- Modify: `app/admin/components/data-table.tsx`
- Create: `__tests__/components/data-table-row-click.test.tsx`

- [ ] **Step 1: Write failing test**

Create `__tests__/components/data-table-row-click.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { render, screen, fireEvent } from "@testing-library/react"
import { useReactTable, getCoreRowModel, createColumnHelper } from "@tanstack/react-table"
import { DataTable } from "@/app/admin/components/data-table"

type Item = { id: string; name: string }
const columnHelper = createColumnHelper<Item>()
const columns = [
    columnHelper.accessor("name", { header: "Name", cell: (info) => info.getValue() }),
]
const data: Item[] = [{ id: "1", name: "Alice" }]

function Wrapper({ onRowClick }: { onRowClick?: (row: Item) => void }) {
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => row.id,
    })
    return <DataTable table={table} columns={columns} onRowClick={onRowClick} />
}

describe("DataTable onRowClick", () => {
    it("calls onRowClick with the row data when a row is clicked", () => {
        const handler = jest.fn()
        render(<Wrapper onRowClick={handler} />)
        fireEvent.click(screen.getByText("Alice"))
        expect(handler).toHaveBeenCalledTimes(1)
        expect(handler).toHaveBeenCalledWith({ id: "1", name: "Alice" })
    })

    it("applies cursor-pointer class to rows when onRowClick is provided", () => {
        const { container } = render(<Wrapper onRowClick={jest.fn()} />)
        const row = container.querySelector("tbody tr")
        expect(row).toHaveClass("cursor-pointer")
    })

    it("does not apply cursor-pointer when onRowClick is not provided", () => {
        const { container } = render(<Wrapper />)
        const row = container.querySelector("tbody tr")
        expect(row).not.toHaveClass("cursor-pointer")
    })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd /Users/idah/code/account-mall
npx jest __tests__/components/data-table-row-click.test.tsx --no-coverage 2>&1 | tail -15
```

Expected: FAIL — `onRowClick` prop does not exist on `DataTable`.

- [ ] **Step 3: Add `onRowClick` to DataTable**

Full updated `app/admin/components/data-table.tsx`:

```tsx
"use client";

import {
    ColumnDef,
    flexRender,
    Table as TanstackTable,
} from "@tanstack/react-table";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface DataTableProps<TData, TValue> {
    table: TanstackTable<TData>;
    columns: ColumnDef<TData, TValue>[];
    emptyMessage?: string;
    onRowClick?: (row: TData) => void;
}

export function DataTable<TData, TValue>({
    table,
    columns,
    emptyMessage = "暂无数据",
    onRowClick,
}: DataTableProps<TData, TValue>) {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <TableHead key={header.id} className={cn(header.column.columnDef.meta?.className)}>
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
                    {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => (
                            <TableRow
                                key={row.id}
                                data-state={row.getIsSelected() && "selected"}
                                onClick={() => onRowClick?.(row.original)}
                                className={cn(onRowClick && "cursor-pointer")}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell key={cell.id} className={cn(cell.column.columnDef.meta?.className)}>
                                        {flexRender(
                                            cell.column.columnDef.cell,
                                            cell.getContext()
                                        )}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell
                                colSpan={columns.length}
                                className="h-24 text-center text-muted-foreground"
                            >
                                {emptyMessage}
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx jest __tests__/components/data-table-row-click.test.tsx --no-coverage 2>&1 | tail -10
```

Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add app/admin/components/data-table.tsx \
        __tests__/components/data-table-row-click.test.tsx
git commit -m "feat(data-table): add onRowClick prop with cursor-pointer styling"
```

---

### Task 2: Create DistributorDetailSheet

**Files:**
- Create: `app/admin/(main)/distributors/distributor-detail-sheet.tsx`
- Create: `__tests__/components/distributor-detail-sheet.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `__tests__/components/distributor-detail-sheet.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { DistributorDetailSheet } from "@/app/admin/(main)/distributors/distributor-detail-sheet"
import type { DistributorRow } from "@/app/admin/(main)/distributors/distributors-columns"

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

const row: DistributorRow = {
    id: "u1",
    email: "alice@example.com",
    name: "Alice",
    distributorCode: "D001",
    discountCodeEnabled: true,
    discountPercent: 8,
    disabledAt: null,
    createdAt: "2024-01-01T00:00:00Z",
    completedOrderCount: 12,
    salesTotal: 3000,
    totalCommission: 300,
    level1CommissionTotal: 240,
    level2CommissionTotal: 60,
    level1Settled: 200,
    level2Settled: 50,
    paidTotal: 100,
    pendingTotal: 0,
    withdrawableBalance: 150,
    inviteeCount: 3,
    inviter: { id: "u2", name: "Bob", distributorCode: "D002" },
}

describe("DistributorDetailSheet", () => {
    it("renders name and email in header", () => {
        render(<DistributorDetailSheet row={row} open={true} onOpenChange={jest.fn()} onSuccess={jest.fn()} />)
        expect(screen.getByText("Alice")).toBeInTheDocument()
        expect(screen.getByText("alice@example.com")).toBeInTheDocument()
    })

    it("renders promo code", () => {
        render(<DistributorDetailSheet row={row} open={true} onOpenChange={jest.fn()} onSuccess={jest.fn()} />)
        expect(screen.getByText("D001")).toBeInTheDocument()
    })

    it("renders sales figures", () => {
        render(<DistributorDetailSheet row={row} open={true} onOpenChange={jest.fn()} onSuccess={jest.fn()} />)
        expect(screen.getByText("¥3000.00")).toBeInTheDocument()
        expect(screen.getByText("12 单")).toBeInTheDocument()
    })

    it("renders commission breakdown", () => {
        render(<DistributorDetailSheet row={row} open={true} onOpenChange={jest.fn()} onSuccess={jest.fn()} />)
        expect(screen.getByText("¥300.00")).toBeInTheDocument()
        expect(screen.getByText("¥240.00")).toBeInTheDocument()
        expect(screen.getByText("¥60.00")).toBeInTheDocument()
    })

    it("renders withdrawable balance", () => {
        render(<DistributorDetailSheet row={row} open={true} onOpenChange={jest.fn()} onSuccess={jest.fn()} />)
        expect(screen.getByText("¥150.00")).toBeInTheDocument()
    })

    it("renders team info with inviter and invitee count", () => {
        render(<DistributorDetailSheet row={row} open={true} onOpenChange={jest.fn()} onSuccess={jest.fn()} />)
        expect(screen.getByText(/Bob/)).toBeInTheDocument()
        expect(screen.getByText(/3 人/)).toBeInTheDocument()
    })

    it("shows 停用 action button when distributor is enabled", () => {
        render(<DistributorDetailSheet row={row} open={true} onOpenChange={jest.fn()} onSuccess={jest.fn()} />)
        expect(screen.getByRole("button", { name: /停用/ })).toBeInTheDocument()
    })

    it("shows 启用 action button when distributor is disabled", () => {
        render(<DistributorDetailSheet row={{ ...row, disabledAt: "2024-06-01T00:00:00Z" }} open={true} onOpenChange={jest.fn()} onSuccess={jest.fn()} />)
        expect(screen.getByRole("button", { name: /启用/ })).toBeInTheDocument()
    })

    it("shows 删除 button only when disabled", () => {
        const { rerender } = render(<DistributorDetailSheet row={row} open={true} onOpenChange={jest.fn()} onSuccess={jest.fn()} />)
        expect(screen.queryByRole("button", { name: /删除/ })).not.toBeInTheDocument()

        rerender(<DistributorDetailSheet row={{ ...row, disabledAt: "2024-06-01T00:00:00Z" }} open={true} onOpenChange={jest.fn()} onSuccess={jest.fn()} />)
        expect(screen.getByRole("button", { name: /删除/ })).toBeInTheDocument()
    })

    it("renders nothing when row is null", () => {
        const { container } = render(<DistributorDetailSheet row={null} open={true} onOpenChange={jest.fn()} onSuccess={jest.fn()} />)
        expect(container).toBeEmptyDOMElement()
    })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx jest __tests__/components/distributor-detail-sheet.test.tsx --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `DistributorDetailSheet` not found.

- [ ] **Step 3: Create the component**

Create `app/admin/(main)/distributors/distributor-detail-sheet.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Copy, UserCheck, UserX, Percent, Trash2, Loader2 } from "lucide-react"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { EditDiscountDialog } from "./edit-discount-dialog"
import type { DistributorRow } from "./distributors-columns"

interface DistributorDetailSheetProps {
    row: DistributorRow | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

export function DistributorDetailSheet({
    row,
    open,
    onOpenChange,
    onSuccess,
}: DistributorDetailSheetProps) {
    const router = useRouter()
    const [toggleLoading, setToggleLoading] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [discountOpen, setDiscountOpen] = useState(false)

    if (!row) return null

    const disabled = !!row.disabledAt

    const handleToggle = async () => {
        setToggleLoading(true)
        try {
            const res = await fetch(`/api/admin/distributors/${row.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ disabled: !disabled }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                toast.error(err?.error ?? "操作失败")
                return
            }
            toast.success(disabled ? "已启用" : "已停用")
            onOpenChange(false)
            onSuccess()
        } catch {
            toast.error("操作失败")
        } finally {
            setToggleLoading(false)
        }
    }

    const handleCopyCode = async () => {
        if (!row.distributorCode) return
        try {
            await navigator.clipboard.writeText(row.distributorCode)
            toast.success("已复制推荐码")
        } catch {
            toast.error("复制失败")
        }
    }

    const handleDelete = async () => {
        setDeleteLoading(true)
        try {
            const res = await fetch(`/api/admin/distributors/${row.id}`, { method: "DELETE" })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                toast.error(err?.error ?? "删除失败")
                return
            }
            setDeleteOpen(false)
            onOpenChange(false)
            toast.success("分销员已删除")
            onSuccess()
        } catch {
            toast.error("删除失败")
        } finally {
            setDeleteLoading(false)
        }
    }

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                    <SheetHeader className="pb-4">
                        <SheetTitle className="flex items-center gap-2 flex-wrap">
                            {row.name}
                            <Badge variant={disabled ? "destructive" : "default"} className="text-xs">
                                {disabled ? "已停用" : "启用"}
                            </Badge>
                        </SheetTitle>
                        <p className="text-sm text-muted-foreground">{row.email}</p>
                        {row.distributorCode && (
                            <div className="flex items-center gap-2">
                                <code className="text-xs font-mono">{row.distributorCode}</code>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                    onClick={handleCopyCode}
                                >
                                    <Copy className="size-3 mr-1" />复制
                                </Button>
                            </div>
                        )}
                    </SheetHeader>

                    <div className="space-y-6">
                        {/* Actions */}
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleToggle}
                                disabled={toggleLoading}
                            >
                                {toggleLoading
                                    ? <Loader2 className="size-4 animate-spin" />
                                    : disabled
                                        ? <UserCheck className="size-4" />
                                        : <UserX className="size-4" />
                                }
                                {disabled ? "启用" : "停用"}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setDiscountOpen(true)}>
                                <Percent className="size-4" />优惠码设置
                            </Button>
                            {disabled && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                                    onClick={() => setDeleteOpen(true)}
                                >
                                    <Trash2 className="size-4" />删除
                                </Button>
                            )}
                        </div>

                        <Separator />

                        {/* 业绩 */}
                        <div>
                            <h4 className="text-sm font-medium mb-3">业绩</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-muted-foreground">累计销售额</p>
                                    <p className="text-lg font-bold tabular-nums">¥{row.salesTotal.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">成交订单</p>
                                    <p className="text-lg font-bold">{row.completedOrderCount} 单</p>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* 佣金 */}
                        <div>
                            <h4 className="text-sm font-medium mb-3">佣金</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">累计佣金</span>
                                    <span className="font-medium tabular-nums">¥{row.totalCommission.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">一级佣金</span>
                                    <span className="tabular-nums">¥{row.level1CommissionTotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">二级佣金</span>
                                    <span className="tabular-nums">¥{row.level2CommissionTotal.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* 余额 */}
                        <div>
                            <h4 className="text-sm font-medium mb-3">余额</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">可提现余额</span>
                                    <span className="font-medium tabular-nums">¥{row.withdrawableBalance.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">已结算（一级）</span>
                                    <span className="tabular-nums">¥{row.level1Settled.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">已结算（二级）</span>
                                    <span className="tabular-nums">¥{row.level2Settled.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">已打款</span>
                                    <span className="tabular-nums">¥{row.paidTotal.toFixed(2)}</span>
                                </div>
                                {row.pendingTotal > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">提现中</span>
                                        <span className="tabular-nums">¥{row.pendingTotal.toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <Separator />

                        {/* 团队 */}
                        <div>
                            <h4 className="text-sm font-medium mb-3">团队</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">上线</span>
                                    <span>
                                        {row.inviter
                                            ? `${row.inviter.name}${row.inviter.distributorCode ? ` (${row.inviter.distributorCode})` : ""}`
                                            : "—"}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">下线人数</span>
                                    <span>{row.inviteeCount} 人</span>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* 优惠码 */}
                        <div>
                            <h4 className="text-sm font-medium mb-3">优惠码</h4>
                            <p className="text-sm">
                                {row.discountCodeEnabled
                                    ? row.discountPercent != null
                                        ? `已启用 · ${row.discountPercent}% 折扣`
                                        : "已启用"
                                    : "未开启"}
                            </p>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            <EditDiscountDialog
                open={discountOpen}
                onOpenChange={setDiscountOpen}
                distributorId={row.id}
                distributorCode={row.distributorCode}
                discountCodeEnabled={row.discountCodeEnabled}
                discountPercent={row.discountPercent}
                onSuccess={() => {
                    onOpenChange(false)
                    onSuccess()
                }}
            />

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>删除分销员</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要永久删除该分销员吗？此操作不可恢复。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteLoading}>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => { e.preventDefault(); handleDelete() }}
                            disabled={deleteLoading}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleteLoading && <Loader2 className="size-4 animate-spin" />}
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx jest __tests__/components/distributor-detail-sheet.test.tsx --no-coverage 2>&1 | tail -15
```

Expected: 10/10 PASS.

- [ ] **Step 5: Commit**

```bash
git add app/admin/(main)/distributors/distributor-detail-sheet.tsx \
        __tests__/components/distributor-detail-sheet.test.tsx
git commit -m "feat(distributors): add DistributorDetailSheet with full info and actions"
```

---

### Task 3: Wire sheet into data table + stopPropagation on actions cell

**Files:**
- Modify: `app/admin/(main)/distributors/distributors-data-table.tsx`
- Modify: `app/admin/(main)/distributors/distributors-columns.tsx`

- [ ] **Step 1: Add stopPropagation wrapper in distributors-columns.tsx**

In `app/admin/(main)/distributors/distributors-columns.tsx`, find the `actions` column definition and wrap the cell:

```tsx
{
    id: "actions",
    cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
            <DistributorRowActions row={row.original} />
        </div>
    ),
    enableSorting: false,
    enableHiding: false,
},
```

- [ ] **Step 2: Wire sheet into distributors-data-table.tsx**

Full updated `app/admin/(main)/distributors/distributors-data-table.tsx`:

```tsx
"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
    useReactTable,
    getCoreRowModel,
    VisibilityState,
} from "@tanstack/react-table"
import { useQueryStates, parseAsInteger } from "nuqs"
import type { SortingState, Updater } from "@tanstack/react-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
    DataTable,
    DataTableToolbar,
    DataTablePagination,
} from "@/app/admin/components"
import { sortQueryStates, parseSortingState, encodeSortingState } from "@/lib/table-sort"
import { distributorsColumns, type DistributorRow } from "./distributors-columns"
import { InviteDistributorButtonClient } from "./invite-distributor-button-client"
import { DistributorDetailSheet } from "./distributor-detail-sheet"

interface DistributorsDataTableProps {
    data: DistributorRow[]
    total: number
    statusCounts: { enabled: number; disabled: number }
}

const statusOptions = [
    { label: "启用", value: "enabled" },
    { label: "已停用", value: "disabled" },
]

const SORT_DEFAULTS = { sort: "createdAt", sortDir: "desc" } as const

export function DistributorsDataTable({
    data,
    total,
    statusCounts,
}: DistributorsDataTableProps) {
    const router = useRouter()
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
    const [selectedRow, setSelectedRow] = useState<DistributorRow | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)

    const [isPending, startTransition] = useTransition()
    const [sortState, setSortState] = useQueryStates(
        { ...sortQueryStates, page: parseAsInteger },
        { history: "push", shallow: false, startTransition }
    )
    const sorting: SortingState = parseSortingState(sortState.sort, sortState.sortDir, SORT_DEFAULTS)

    const table = useReactTable({
        data,
        columns: distributorsColumns,
        state: { columnVisibility, sorting },
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => row.id,
        manualPagination: true,
        manualFiltering: true,
        manualSorting: true,
        onSortingChange: (updater: Updater<SortingState>) => {
            const next = typeof updater === "function" ? updater(sorting) : updater
            setSortState({ ...encodeSortingState(next, SORT_DEFAULTS), page: null })
        },
    })

    return (
        <>
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base">分销员列表</CardTitle>
                        <InviteDistributorButtonClient />
                    </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                    <DataTableToolbar
                        table={table}
                        searchPlaceholder="搜索昵称、邮箱、优惠码..."
                        searchParamKey="search"
                        statusOptions={statusOptions}
                        statusParamKey="status"
                    />
                    <Separator />
                    <div className={isPending ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
                        <DataTable
                            table={table}
                            columns={distributorsColumns}
                            emptyMessage="暂无分销员，分销员可通过前台注册成为分销员。"
                            onRowClick={(row) => {
                                setSelectedRow(row)
                                setSheetOpen(true)
                            }}
                        />
                        <DataTablePagination table={table} total={total} />
                    </div>
                </CardContent>
            </Card>

            <DistributorDetailSheet
                row={selectedRow}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
                onSuccess={() => router.refresh()}
            />
        </>
    )
}
```

- [ ] **Step 3: Build check**

```bash
cd /Users/idah/code/account-mall
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 4: Run full test suite**

```bash
npm test --no-coverage 2>&1 | tail -10
```

Expected: all tests pass (the 2 pre-existing failures in `distributor-ai-chat.test.ts` are unrelated and were failing before this work).

- [ ] **Step 5: Commit**

```bash
git add app/admin/(main)/distributors/distributors-data-table.tsx \
        app/admin/(main)/distributors/distributors-columns.tsx
git commit -m "feat(distributors): wire detail sheet — row click opens sheet, actions cell stops propagation"
```
