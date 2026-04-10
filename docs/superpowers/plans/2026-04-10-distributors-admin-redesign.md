# Distributors Admin Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the admin distributors table from 12 unstructured columns to 7 well-abstracted, mobile-responsive columns, and add missing 销售额 (GMV) data.

**Architecture:** Merge related identity/team/financial info into single cells with secondary lines. Apply Tailwind responsive visibility (`hidden sm:table-cell`, `hidden lg:table-cell`) directly on `<th>`/`<td>` via column `meta` or cell class. Add a `salesTotal` groupBy query in `page.tsx`.

**Tech Stack:** Next.js App Router, TanStack Table, Prisma, Tailwind CSS, shadcn/ui, Jest + Testing Library

---

## File Map

| File | Change |
|------|--------|
| `app/admin/(main)/distributors/distributors-columns.tsx` | Full rewrite — 7 columns, merged cells, responsive classes, add `salesTotal` to `DistributorRow` type |
| `app/admin/(main)/distributors/page.tsx` | Add `salesTotal` groupBy query; add field to mapped row objects; add `salesTotal` to sort fields |
| `app/admin/components/data-table.tsx` | Pass `meta.className` to `<TableHead>` and `<TableCell>` |
| `app/admin/(main)/distributors/distributors-data-table.tsx` | No change |
| `app/admin/(main)/distributors/distributor-row-actions.tsx` | No change |
| `__tests__/components/distributors-columns.test.tsx` | New — tests for merged cell rendering |

---

### Task 1: Add `salesTotal` to data layer

**Files:**
- Modify: `app/admin/(main)/distributors/distributors-columns.tsx` (type only)
- Modify: `app/admin/(main)/distributors/page.tsx`

- [ ] **Step 1: Write failing test for salesTotal appearing in row data**

Create `__tests__/components/distributors-columns.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

// Minimal cell component to test — will be extracted in Task 2
// For now just assert the type shape is correct at compile time via the import
import type { DistributorRow } from "@/app/admin/(main)/distributors/distributors-columns"

describe("DistributorRow type includes salesTotal", () => {
  it("accepts salesTotal field", () => {
    const row: DistributorRow = {
      id: "1",
      email: "a@b.com",
      name: "Alice",
      distributorCode: "D001",
      discountCodeEnabled: false,
      discountPercent: null,
      disabledAt: null,
      createdAt: new Date().toISOString(),
      completedOrderCount: 3,
      salesTotal: 500,
      totalCommission: 50,
      level1CommissionTotal: 40,
      level2CommissionTotal: 10,
      level1Settled: 40,
      level2Settled: 10,
      paidTotal: 0,
      pendingTotal: 0,
      withdrawableBalance: 50,
      inviteeCount: 2,
      inviter: null,
    }
    expect(row.salesTotal).toBe(500)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/components/distributors-columns.test.tsx --no-coverage
```

Expected: TypeScript compile error — `salesTotal` does not exist on `DistributorRow`.

- [ ] **Step 3: Add `salesTotal` to `DistributorRow` type**

In `app/admin/(main)/distributors/distributors-columns.tsx`, add `salesTotal: number` after `completedOrderCount`:

```ts
export type DistributorRow = {
    id: string
    email: string
    name: string
    distributorCode: string | null
    discountCodeEnabled: boolean
    discountPercent: number | null
    disabledAt: string | null
    createdAt: string
    completedOrderCount: number
    salesTotal: number          // ← add this
    totalCommission: number
    level1CommissionTotal: number
    level2CommissionTotal: number
    level1Settled: number
    level2Settled: number
    paidTotal: number
    pendingTotal: number
    withdrawableBalance: number
    inviteeCount: number
    inviter: { id: string; name: string; distributorCode: string | null } | null
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/components/distributors-columns.test.tsx --no-coverage
```

Expected: PASS

- [ ] **Step 5: Wire salesTotal query in page.tsx**

In `app/admin/(main)/distributors/page.tsx`, add the sales groupBy alongside the existing queries in the `ids.length > 0` block:

```ts
// Add to the destructured array (after withdrawalPending, before inviteeCounts):
salesTotals,

// Add to the Promise.all array:
prisma.order.groupBy({
    by: ["distributorId"],
    where: { distributorId: { in: ids }, status: "COMPLETED" },
    _sum: { amount: true },
}),
```

Add the map after the other maps:

```ts
const salesTotalMap = new Map(
    salesTotals.map((o) => [o.distributorId, Number(o._sum.amount ?? 0)])
)
```

And in the empty fallback array, add `[]`:
```ts
: [[], [], [], [], [], [], [], []]
//                              ^^  one more for salesTotals
```

Add `salesTotal` to the mapped row objects:

```ts
const data: DistributorRow[] = distributors.map((d) => {
    // ...existing fields...
    return {
        // ...existing fields...
        completedOrderCount: orderCountMap.get(d.id) ?? 0,
        salesTotal: salesTotalMap.get(d.id) ?? 0,   // ← add this
        // ...rest of fields...
    }
})
```

Also add `salesTotal` to the sortable fields:

```ts
const { orderBy } = parseServerSort(
    rawParams.sort ?? null,
    rawParams.sortDir ?? null,
    ["createdAt", "name", "salesTotal"] as const,
    { sort: "createdAt", sortDir: "desc" }
)
```

- [ ] **Step 6: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: No TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add app/admin/(main)/distributors/distributors-columns.tsx \
        app/admin/(main)/distributors/page.tsx \
        __tests__/components/distributors-columns.test.tsx
git commit -m "feat(distributors): add salesTotal field to DistributorRow and data query"
```

---

### Task 2: Rewrite columns — identity + team cells

**Files:**
- Modify: `app/admin/(main)/distributors/distributors-columns.tsx`
- Modify: `__tests__/components/distributors-columns.test.tsx`

- [ ] **Step 1: Write failing tests for merged identity and team cells**

Add to `__tests__/components/distributors-columns.test.tsx`:

```tsx
import { Badge } from "@/components/ui/badge"

// Test helpers — minimal row factories
const baseRow: DistributorRow = {
  id: "1",
  email: "alice@example.com",
  name: "Alice",
  distributorCode: "D001",
  discountCodeEnabled: false,
  discountPercent: null,
  disabledAt: null,
  createdAt: "2024-01-01T00:00:00Z",
  completedOrderCount: 3,
  salesTotal: 500,
  totalCommission: 50,
  level1CommissionTotal: 40,
  level2CommissionTotal: 10,
  level1Settled: 40,
  level2Settled: 10,
  paidTotal: 0,
  pendingTotal: 0,
  withdrawableBalance: 50,
  inviteeCount: 2,
  inviter: { id: "2", name: "Bob", distributorCode: "D002" },
}

import { DistributorIdentityCell, DistributorTeamCell } from "@/app/admin/(main)/distributors/distributors-columns"

describe("DistributorIdentityCell", () => {
  it("shows name, email, and promo code", () => {
    render(<DistributorIdentityCell row={baseRow} />)
    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.getByText("alice@example.com")).toBeInTheDocument()
    expect(screen.getByText("D001")).toBeInTheDocument()
  })

  it("shows '启用' badge when not disabled", () => {
    render(<DistributorIdentityCell row={baseRow} />)
    expect(screen.getByText("启用")).toBeInTheDocument()
  })

  it("shows '已停用' badge when disabledAt is set", () => {
    render(<DistributorIdentityCell row={{ ...baseRow, disabledAt: "2024-06-01T00:00:00Z" }} />)
    expect(screen.getByText("已停用")).toBeInTheDocument()
  })

  it("shows dash when promo code is null", () => {
    render(<DistributorIdentityCell row={{ ...baseRow, distributorCode: null }} />)
    expect(screen.queryByText("D001")).not.toBeInTheDocument()
  })
})

describe("DistributorTeamCell", () => {
  it("shows inviter name and invitee count", () => {
    render(<DistributorTeamCell row={baseRow} />)
    expect(screen.getByText("Bob")).toBeInTheDocument()
    expect(screen.getByText("下线 2")).toBeInTheDocument()
  })

  it("shows dash when no inviter", () => {
    render(<DistributorTeamCell row={{ ...baseRow, inviter: null }} />)
    expect(screen.getByText("—")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/components/distributors-columns.test.tsx --no-coverage
```

Expected: FAIL — `DistributorIdentityCell` and `DistributorTeamCell` are not exported.

- [ ] **Step 3: Add exported cell components to distributors-columns.tsx**

Add these components at the top of `distributors-columns.tsx` (after imports, before `distributorsColumns`):

```tsx
export function DistributorIdentityCell({ row }: { row: DistributorRow }) {
    const disabled = !!row.disabledAt
    return (
        <div className="space-y-0.5">
            <div className="flex items-center gap-2">
                <span className="font-medium">{row.name}</span>
                <Badge variant={disabled ? "destructive" : "default"} className="text-xs">
                    {disabled ? "已停用" : "启用"}
                </Badge>
            </div>
            <div className="text-xs text-muted-foreground">{row.email}</div>
            {row.distributorCode && (
                <code className="text-xs font-mono text-muted-foreground">{row.distributorCode}</code>
            )}
        </div>
    )
}

export function DistributorTeamCell({ row }: { row: DistributorRow }) {
    if (!row.inviter) return <span className="text-muted-foreground">—</span>
    return (
        <div className="space-y-0.5">
            <div className="text-sm">{row.inviter.name}</div>
            <Badge variant="secondary" className="text-xs font-normal">
                下线 {row.inviteeCount}
            </Badge>
        </div>
    )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/components/distributors-columns.test.tsx --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/admin/(main)/distributors/distributors-columns.tsx \
        __tests__/components/distributors-columns.test.tsx
git commit -m "feat(distributors): add DistributorIdentityCell and DistributorTeamCell components"
```

---

### Task 3: Rewrite columns — sales + discount cells

**Files:**
- Modify: `app/admin/(main)/distributors/distributors-columns.tsx`
- Modify: `__tests__/components/distributors-columns.test.tsx`

- [ ] **Step 1: Write failing tests for sales and discount cells**

Add to the test file:

```tsx
import { DistributorSalesCell, DistributorDiscountCell } from "@/app/admin/(main)/distributors/distributors-columns"

describe("DistributorSalesCell", () => {
  it("shows formatted GMV and order count", () => {
    render(<DistributorSalesCell row={baseRow} />)
    expect(screen.getByText("¥500.00")).toBeInTheDocument()
    expect(screen.getByText("3 单")).toBeInTheDocument()
  })

  it("shows ¥0.00 when salesTotal is 0", () => {
    render(<DistributorSalesCell row={{ ...baseRow, salesTotal: 0, completedOrderCount: 0 }} />)
    expect(screen.getByText("¥0.00")).toBeInTheDocument()
    expect(screen.getByText("0 单")).toBeInTheDocument()
  })
})

describe("DistributorDiscountCell", () => {
  it("shows '关闭' when discount code is not enabled", () => {
    render(<DistributorDiscountCell row={baseRow} />)
    expect(screen.getByText("关闭")).toBeInTheDocument()
  })

  it("shows enabled badge with percent", () => {
    render(<DistributorDiscountCell row={{ ...baseRow, discountCodeEnabled: true, discountPercent: 8 }} />)
    expect(screen.getByText("已启用 · 8%")).toBeInTheDocument()
  })

  it("shows enabled badge without percent when percent is null", () => {
    render(<DistributorDiscountCell row={{ ...baseRow, discountCodeEnabled: true, discountPercent: null }} />)
    expect(screen.getByText("已启用")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/components/distributors-columns.test.tsx --no-coverage
```

Expected: FAIL — `DistributorSalesCell` and `DistributorDiscountCell` not exported.

- [ ] **Step 3: Add exported cell components**

```tsx
export function DistributorSalesCell({ row }: { row: DistributorRow }) {
    return (
        <div className="text-right space-y-0.5">
            <div className="font-medium tabular-nums">¥{row.salesTotal.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">{row.completedOrderCount} 单</div>
        </div>
    )
}

export function DistributorDiscountCell({ row }: { row: DistributorRow }) {
    if (!row.discountCodeEnabled) {
        return <span className="text-sm text-muted-foreground">关闭</span>
    }
    const label = row.discountPercent != null ? `已启用 · ${row.discountPercent}%` : "已启用"
    return <Badge variant="secondary">{label}</Badge>
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/components/distributors-columns.test.tsx --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/admin/(main)/distributors/distributors-columns.tsx \
        __tests__/components/distributors-columns.test.tsx
git commit -m "feat(distributors): add DistributorSalesCell and DistributorDiscountCell components"
```

---

### Task 4: Wire all columns with responsive visibility

**Files:**
- Modify: `app/admin/(main)/distributors/distributors-columns.tsx`
- Modify: `app/admin/components/data-table.tsx`

- [ ] **Step 1: Replace `distributorsColumns` array with 7-column definition**

Replace the entire `distributorsColumns` export in `distributors-columns.tsx`:

```tsx
export const distributorsColumns: ColumnDef<DistributorRow>[] = [
    {
        accessorKey: "name",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="分销员" />
        ),
        cell: ({ row }) => <DistributorIdentityCell row={row.original} />,
    },
    {
        accessorKey: "inviter",
        header: "团队",
        enableSorting: false,
        cell: ({ row }) => <DistributorTeamCell row={row.original} />,
        meta: { className: "hidden sm:table-cell" },
    },
    {
        accessorKey: "salesTotal",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="销售额" className="justify-end" />
        ),
        cell: ({ row }) => <DistributorSalesCell row={row.original} />,
    },
    {
        accessorKey: "totalCommission",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="累计佣金" className="justify-end" />
        ),
        enableSorting: false,
        cell: ({ row }) => (
            <div className="text-right font-medium">
                <CommissionTooltip row={row.original} />
            </div>
        ),
        meta: { className: "hidden sm:table-cell" },
    },
    {
        accessorKey: "withdrawableBalance",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="可提现余额" className="justify-end" />
        ),
        enableSorting: false,
        cell: ({ row }) => (
            <div className="text-right font-medium">
                <BalanceTooltip row={row.original} />
            </div>
        ),
        meta: { className: "hidden lg:table-cell" },
    },
    {
        accessorKey: "discountCodeEnabled",
        header: "优惠码",
        enableSorting: false,
        cell: ({ row }) => <DistributorDiscountCell row={row.original} />,
        meta: { className: "hidden lg:table-cell" },
    },
    {
        id: "actions",
        cell: ({ row }) => <DistributorRowActions row={row.original} />,
        enableSorting: false,
        enableHiding: false,
    },
]
```

- [ ] **Step 2: Update DataTable to pass meta.className to th/td**

`app/admin/components/data-table.tsx` currently does NOT forward `meta.className`. Make two changes:

**2a.** Add module augmentation for `ColumnMeta` at the top of `distributors-columns.tsx` (before imports are used):

```ts
// At the very top of distributors-columns.tsx, after "use client":
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    className?: string
  }
}
```

**2b.** In `app/admin/components/data-table.tsx`, add `import { cn } from "@/lib/utils"` and pass `meta.className`:

```tsx
import { cn } from "@/lib/utils"

// In the header render loop, change:
<TableHead key={header.id}>
// to:
<TableHead key={header.id} className={cn(header.column.columnDef.meta?.className)}>

// In the body cell render loop, change:
<TableCell key={cell.id}>
// to:
<TableCell key={cell.id} className={cn(cell.column.columnDef.meta?.className)}>
```

This is backwards-compatible — existing columns with no `meta` are unaffected.

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | tail -30
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add app/admin/(main)/distributors/distributors-columns.tsx
git commit -m "feat(distributors): wire 7-column layout with responsive visibility"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run all distributor tests**

```bash
npx jest __tests__/components/distributors-columns.test.tsx --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 2: Run full test suite**

```bash
npm test --no-coverage 2>&1 | tail -20
```

Expected: No regressions.

- [ ] **Step 3: Manual smoke test**

Start dev server (`npm run dev`) and verify:
- Desktop (≥1024px): all 7 columns visible
- Tablet (~768px): 团队, 余额, 优惠码 columns hidden
- Mobile (<640px): only 分销员, 销售额, 操作 visible
- 销售额 shows correct GMV and order count
- Sortable columns (分销员, 销售额) show sort arrows
- Tooltip on 累计佣金 and 可提现余额 still works
