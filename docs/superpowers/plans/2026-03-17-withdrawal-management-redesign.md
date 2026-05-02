# 提现管理 UI/UX 重设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将提现处理流程从 3 步（收款码 Dialog + 操作 Dialog）合并为 1 步（Sheet + AlertDialog），同时精简移动端列表列。

**Architecture:** 新建 `WithdrawalProcessSheet` 组件承载 Sheet + AlertDialog 完整逻辑；将 `withdrawalsColumns` 静态数组改为工厂函数 `makeWithdrawalsColumns(onProcess)` 以传递回调；`WithdrawalsDataTable` 持有选中行状态并渲染 Sheet；移动端通过 `useIsMobile()` 动态隐藏次要列。

**Tech Stack:** Next.js 16 App Router, React 19, shadcn/ui (Sheet / AlertDialog / Badge / Button / Separator), TanStack Table v8, TypeScript, `hooks/use-mobile.ts`

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `app/admin/(main)/withdrawals/withdrawal-process-sheet.tsx` | **新建** | Sheet + AlertDialog + API 调用 |
| `app/admin/(main)/withdrawals/withdrawal-row-actions.tsx` | **修改** | 简化为单一「处理」按钮，接收 `onProcess` 回调 |
| `app/admin/(main)/withdrawals/withdrawals-columns.tsx` | **修改** | 静态数组 → 工厂函数，响应式 `actualAmount` header |
| `app/admin/(main)/withdrawals/withdrawals-data-table.tsx` | **修改** | 持有 `selectedRow` state，响应式列隐藏，渲染 Sheet |

---

## Task 1: 新建 `withdrawal-process-sheet.tsx`

**Files:**
- Create: `app/admin/(main)/withdrawals/withdrawal-process-sheet.tsx`

- [ ] **Step 1: 创建文件，写入完整组件**

```tsx
"use client"

import Image from "next/image"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { formatCurrency, formatDateTime } from "@/lib/utils"
import type { WithdrawalRow } from "./withdrawals-columns"

interface WithdrawalProcessSheetProps {
    row: WithdrawalRow | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

export function WithdrawalProcessSheet({
    row,
    open,
    onOpenChange,
    onSuccess,
}: WithdrawalProcessSheetProps) {
    const router = useRouter()
    const [action, setAction] = useState<"PAID" | "REJECTED" | null>(null)
    const [note, setNote] = useState("")
    const [loading, setLoading] = useState(false)

    const resetDialog = () => {
        setAction(null)
        setNote("")
    }

    const handleConfirm = async () => {
        if (!action || !row) return
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/withdrawals/${row.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: action, note: note || undefined }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                toast.error(err?.error ?? "操作失败")
                return
            }
            toast.success(action === "PAID" ? "已标记打款" : "已拒绝")
            resetDialog()
            onOpenChange(false)
            onSuccess()
        } catch {
            toast.error("操作失败")
        } finally {
            setLoading(false)
        }
    }

    if (!row) return null

    const {
        distributor,
        amount,
        feeAmount,
        feePercent,
        actualAmount,
        receiptImageUrl,
        level1Settled,
        level2Settled,
        paidTotal,
        pendingTotal,
        currentBalance,
    } = row

    return (
        <>
            <Sheet
                open={open}
                onOpenChange={(o) => {
                    if (!o) resetDialog()
                    onOpenChange(o)
                }}
            >
                <SheetContent className="flex flex-col w-full sm:max-w-md">
                    <SheetHeader className="border-b pb-4 shrink-0">
                        <SheetTitle className="flex items-center gap-2 flex-wrap">
                            {distributor.name}
                            <Badge variant="warning" className="text-xs">待处理</Badge>
                        </SheetTitle>
                        <p className="text-sm text-muted-foreground">
                            {distributor.email ?? distributor.username ?? "—"} · {formatDateTime(row.createdAt)}
                        </p>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {/* Amount banner */}
                        <div className="rounded-lg bg-primary/10 px-4 py-3 text-center">
                            <p className="text-xs font-semibold text-primary mb-1">打款金额</p>
                            <p className="text-3xl font-bold tabular-nums text-primary">
                                {formatCurrency(actualAmount)}
                            </p>
                            {feeAmount > 0 && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                    申请 {formatCurrency(amount)} · 手续费 {feePercent}% = -{formatCurrency(feeAmount)}
                                </p>
                            )}
                        </div>

                        {/* QR code */}
                        {receiptImageUrl ? (
                            <div className="flex justify-center overflow-hidden rounded-md border bg-muted/30 p-4">
                                <Image
                                    src={receiptImageUrl}
                                    alt="收款码"
                                    width={600}
                                    height={600}
                                    className="max-h-[40vh] max-w-full object-contain"
                                />
                            </div>
                        ) : (
                            <p className="text-center text-sm text-muted-foreground">未上传收款码</p>
                        )}

                        <Separator />

                        {/* Balance details */}
                        <div>
                            <h4 className="text-sm font-medium mb-3">余额明细</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">一级佣金（已结算）</span>
                                    <span className="tabular-nums">¥{level1Settled.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">二级佣金（已结算）</span>
                                    <span className="tabular-nums">¥{level2Settled.toFixed(2)}</span>
                                </div>
                                <div className="border-t pt-2 flex justify-between">
                                    <span className="text-muted-foreground">已打款</span>
                                    <span className="tabular-nums">-¥{paidTotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">提现中（含本次）</span>
                                    <span className="tabular-nums">-¥{pendingTotal.toFixed(2)}</span>
                                </div>
                                <div className="border-t pt-2 flex justify-between font-medium">
                                    <span>可提现余额</span>
                                    <span className="tabular-nums">¥{currentBalance.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2">
                            <Button className="flex-1" onClick={() => setAction("PAID")}>
                                <CheckCircle className="size-4" />
                                已打款
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1 text-destructive hover:text-destructive"
                                onClick={() => setAction("REJECTED")}
                            >
                                <XCircle className="size-4" />
                                拒绝
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            <AlertDialog
                open={!!action}
                onOpenChange={(o) => { if (!o) resetDialog() }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {action === "PAID" ? "确认已打款" : "确认拒绝"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {distributor.name} 申请提现 {formatCurrency(amount)}
                            {feeAmount > 0 && (
                                <>，实付 <strong>{formatCurrency(actualAmount)}</strong></>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="px-1 pb-2 space-y-1.5">
                        <Label>备注（可选）</Label>
                        <Input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder={action === "PAID" ? "打款方式、流水号等" : "拒绝原因"}
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={loading}>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => { e.preventDefault(); handleConfirm() }}
                            disabled={loading}
                        >
                            {loading && <Loader2 className="size-4 animate-spin" />}
                            {action === "PAID" ? "确认已打款" : "确认拒绝"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
```

- [ ] **Step 2: 验证 TypeScript**

```bash
cd /Users/idah/code/account-mall && npx tsc --noEmit 2>&1 | grep "withdrawal-process-sheet"
```

期望：无输出（无错误）。

- [ ] **Step 3: Commit**

```bash
git add app/admin/\(main\)/withdrawals/withdrawal-process-sheet.tsx
git commit -m "feat(withdrawals): add WithdrawalProcessSheet with Sheet + AlertDialog"
```

---

## Task 2: 简化 `withdrawal-row-actions.tsx`

**Files:**
- Modify: `app/admin/(main)/withdrawals/withdrawal-row-actions.tsx`

- [ ] **Step 1: 替换整个文件内容**

用以下内容完整替换 `withdrawal-row-actions.tsx`：

```tsx
"use client"

import { Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { WithdrawalRow } from "./withdrawals-columns"

interface WithdrawalRowActionsProps {
    row: WithdrawalRow
    onProcess: (row: WithdrawalRow) => void
}

export function WithdrawalRowActions({ row, onProcess }: WithdrawalRowActionsProps) {
    if (row.status !== "PENDING") return null

    return (
        <Button size="sm" variant="outline" onClick={() => onProcess(row)}>
            <Settings2 className="size-4" />
            处理
        </Button>
    )
}
```

> 注意：此时 `withdrawals-columns.tsx` 仍用旧 props 调用 `WithdrawalRowActions`，TypeScript 会报错。Task 3 立即修复。

- [ ] **Step 2: 验证修改正确（不跑 typecheck，下一步修）**

确认文件内容已替换，只有一个 `Button`，无任何 `Dialog` 或 `useState`。

---

## Task 3: 重构 `withdrawals-columns.tsx` 为工厂函数

**Files:**
- Modify: `app/admin/(main)/withdrawals/withdrawals-columns.tsx`

- [ ] **Step 1: 替换整个文件内容**

```tsx
"use client"

import { formatDateTime, formatCurrency } from "@/lib/utils"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { DataTableColumnHeader } from "@/app/admin/components"
import { WithdrawalRowActions } from "./withdrawal-row-actions"
import { ReceiptCell } from "./receipt-cell"
import { BalanceCell } from "./balance-cell"

export type WithdrawalRow = {
    id: string
    distributorId: string
    distributor: { id: string; email: string | null; username: string | null; name: string }
    amount: number
    feePercent: number
    feeAmount: number
    actualAmount: number
    status: "PENDING" | "PAID" | "REJECTED"
    receiptImageUrl: string | null
    note: string | null
    processedAt: string | null
    createdAt: string
    level1Settled: number
    level2Settled: number
    paidTotal: number
    pendingTotal: number
    currentBalance: number
}

const statusMap: Record<
    WithdrawalRow["status"],
    { label: string; variant: "warning" | "success" | "destructive" }
> = {
    PENDING: { label: "待处理", variant: "warning" },
    PAID: { label: "已打款", variant: "success" },
    REJECTED: { label: "已拒绝", variant: "destructive" },
}

export function makeWithdrawalsColumns(
    onProcess: (row: WithdrawalRow) => void
): ColumnDef<WithdrawalRow>[] {
    return [
        {
            id: "distributor",
            accessorFn: (row) => row.distributor.name,
            header: "分销员",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium">{row.original.distributor.name}</span>
                    <span className="text-xs text-muted-foreground">
                        {row.original.distributor.email ?? row.original.distributor.username ?? "—"}
                    </span>
                </div>
            ),
        },
        {
            accessorKey: "amount",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="申请金额" className="justify-end" />
            ),
            cell: ({ row }) => (
                <div className="text-right font-medium">{formatCurrency(row.original.amount)}</div>
            ),
        },
        {
            id: "actualAmount",
            header: () => (
                <div className="text-right">
                    <span className="hidden md:inline">实付金额</span>
                    <span className="md:hidden">打款金额</span>
                </div>
            ),
            cell: ({ row }) => {
                const { feeAmount, actualAmount, feePercent } = row.original
                return (
                    <div className="text-right">
                        <span className="font-medium">{formatCurrency(actualAmount)}</span>
                        {feeAmount > 0 && (
                            <span className="block text-xs text-muted-foreground">
                                手续费 {feePercent}% = -¥{feeAmount.toFixed(2)}
                            </span>
                        )}
                    </div>
                )
            },
        },
        {
            id: "currentBalance",
            header: () => <div className="text-right">可提现余额</div>,
            cell: ({ row }) => (
                <div className="text-right">
                    <BalanceCell row={row.original} />
                </div>
            ),
        },
        {
            id: "receipt",
            header: "收款码",
            cell: ({ row }) => (
                <ReceiptCell
                    url={row.original.receiptImageUrl}
                    distributorName={row.original.distributor.name}
                    actualAmount={row.original.actualAmount}
                    amount={row.original.amount}
                    feeAmount={row.original.feeAmount}
                    feePercent={row.original.feePercent}
                />
            ),
        },
        {
            accessorKey: "status",
            header: "状态",
            cell: ({ row }) => {
                const { label, variant } = statusMap[row.original.status]
                return <Badge variant={variant}>{label}</Badge>
            },
        },
        {
            accessorKey: "createdAt",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="申请时间" />
            ),
            cell: ({ row }) => (
                <span className="text-muted-foreground text-sm">
                    {formatDateTime(row.original.createdAt)}
                </span>
            ),
        },
        {
            accessorKey: "note",
            header: "备注",
            cell: ({ row }) => (
                <span className="text-sm text-muted-foreground max-w-[200px] truncate block">
                    {row.original.note || "—"}
                </span>
            ),
        },
        {
            id: "actions",
            header: () => <div className="w-[100px]">操作</div>,
            cell: ({ row }) => (
                <WithdrawalRowActions row={row.original} onProcess={onProcess} />
            ),
        },
    ]
}
```

- [ ] **Step 2: 验证 TypeScript（Tasks 2+3 合并检查）**

```bash
cd /Users/idah/code/account-mall && npx tsc --noEmit 2>&1 | grep -E "withdrawal-row-actions|withdrawals-columns|withdrawals-data-table"
```

期望：只有 `withdrawals-data-table.tsx` 报错（仍在引用旧的 `withdrawalsColumns`），其他两个文件无错误。

- [ ] **Step 3: Commit**

```bash
git add app/admin/\(main\)/withdrawals/withdrawal-row-actions.tsx \
        app/admin/\(main\)/withdrawals/withdrawals-columns.tsx
git commit -m "refactor(withdrawals): simplify row-actions + convert columns to factory fn"
```

---

## Task 4: 更新 `withdrawals-data-table.tsx`

**Files:**
- Modify: `app/admin/(main)/withdrawals/withdrawals-data-table.tsx`

- [ ] **Step 1: 替换整个文件内容**

```tsx
"use client"

import { useState, useTransition, useMemo, useEffect } from "react"
import {
    useReactTable,
    getCoreRowModel,
    type VisibilityState,
} from "@tanstack/react-table"
import { useRouter } from "next/navigation"
import { useQueryStates, parseAsInteger } from "nuqs"
import type { SortingState, Updater } from "@tanstack/react-table"
import { sortQueryStates, parseSortingState, encodeSortingState } from "@/lib/table-sort"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
    DataTable,
    DataTableToolbar,
    DataTablePagination,
} from "@/app/admin/components"
import { makeWithdrawalsColumns, type WithdrawalRow } from "./withdrawals-columns"
import { WithdrawalProcessSheet } from "./withdrawal-process-sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import type { WithdrawalFiltersState } from "./withdrawals-filters"

interface WithdrawalsDataTableProps {
    data: WithdrawalRow[]
    total: number
    statusCounts: {
        PENDING: number
        PAID: number
        REJECTED: number
    }
    defaultFilters: WithdrawalFiltersState
}

const statusOptions = [
    { label: "待处理", value: "PENDING" },
    { label: "已打款", value: "PAID" },
    { label: "已拒绝", value: "REJECTED" },
]

const SORT_DEFAULTS = { sort: "createdAt", sortDir: "desc" } as const

const MOBILE_HIDDEN_COLUMNS: VisibilityState = {
    amount: false,
    currentBalance: false,
    receipt: false,
    createdAt: false,
    note: false,
}

export function WithdrawalsDataTable({
    data,
    total,
}: WithdrawalsDataTableProps) {
    const router = useRouter()
    const isMobile = useIsMobile()
    const [selectedRow, setSelectedRow] = useState<WithdrawalRow | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
    const [isPending, startTransition] = useTransition()
    const [sortState, setSortState] = useQueryStates(
        { ...sortQueryStates, page: parseAsInteger },
        { history: "push", shallow: false, startTransition }
    )
    const sorting: SortingState = parseSortingState(sortState.sort, sortState.sortDir, SORT_DEFAULTS)

    useEffect(() => {
        setColumnVisibility(isMobile ? MOBILE_HIDDEN_COLUMNS : {})
    }, [isMobile])

    const columns = useMemo(
        () =>
            makeWithdrawalsColumns((row) => {
                setSelectedRow(row)
                setSheetOpen(true)
            }),
        []
    )

    const table = useReactTable({
        data,
        columns,
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
                    <CardTitle className="text-base">提现记录</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                    <DataTableToolbar
                        table={table}
                        searchPlaceholder="搜索分销员姓名或邮箱..."
                        searchParamKey="search"
                        statusOptions={statusOptions}
                        statusParamKey="status"
                    />
                    <Separator />
                    <div
                        className={
                            isPending
                                ? "opacity-50 pointer-events-none transition-opacity"
                                : "transition-opacity"
                        }
                    >
                        <DataTable
                            table={table}
                            columns={columns}
                            emptyMessage="暂无提现记录"
                        />
                        <DataTablePagination table={table} total={total} />
                    </div>
                </CardContent>
            </Card>

            <WithdrawalProcessSheet
                row={selectedRow}
                open={sheetOpen}
                onOpenChange={(o) => {
                    setSheetOpen(o)
                    if (!o) setSelectedRow(null)
                }}
                onSuccess={() => router.refresh()}
            />
        </>
    )
}
```

- [ ] **Step 2: 验证 TypeScript 全量通过**

```bash
cd /Users/idah/code/account-mall && npx tsc --noEmit 2>&1 | grep -E "withdrawal|Error" | head -20
```

期望：无输出（无错误）。

- [ ] **Step 3: 验证 lint 通过**

```bash
cd /Users/idah/code/account-mall && npm run lint 2>&1 | grep -E "withdrawal" | head -10
```

期望：无新增 error。

- [ ] **Step 4: Commit**

```bash
git add app/admin/\(main\)/withdrawals/withdrawals-data-table.tsx
git commit -m "feat(withdrawals): wire up process sheet + responsive column visibility"
```

---

## 验收清单

完成所有 Task 后，在浏览器中手动验证：

- [ ] **桌面端（>= 768px）**：9 列全部可见，「操作」列显示「处理」按钮（PENDING 行），点击后右侧 Sheet 滑入
- [ ] **移动端（< 768px）**：只显示 分销员 / 打款金额 / 状态 / 处理 4 列
- [ ] **Sheet 内容**：金额 banner（打款金额大字）+ 收款码图片 + 余额明细 + 「已打款」/「拒绝」按钮
- [ ] **点「已打款」**：AlertDialog 弹出，显示分销员名 + 金额，含备注输入
- [ ] **确认打款**：toast 提示「已标记打款」，Sheet 关闭，列表刷新
- [ ] **点「拒绝」**：AlertDialog 显示正确标题，确认后 toast + 关闭 + 刷新
- [ ] **已处理行（PAID / REJECTED）**：不显示「处理」按钮
- [ ] **无收款码行**：Sheet 内显示「未上传收款码」文案
