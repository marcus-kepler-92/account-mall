# Admin Table Sorting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add column sorting to all admin tables — URL-persisted via nuqs for server-side tables, in-memory for client-side tables.

**Architecture:** Install nuqs; add a pure-function `lib/table-sort.ts` utility; wire `useQueryStates` into each server-side data-table's `onSortingChange`; `page.tsx` validates sort column against a whitelist and passes to Prisma `orderBy`. Client-side tables already have `getSortedRowModel` — only column headers need updating.

**Tech Stack:** nuqs v2, TanStack Table v8, Next.js App Router, Prisma

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `package.json` | install nuqs | new dependency |
| `app/layout.tsx` | modify | wrap with `NuqsAdapter` |
| `lib/table-sort.ts` | **create** | pure sort utilities (parse, encode, server-validate) |
| `__tests__/lib/table-sort.test.ts` | **create** | unit tests for all exports |
| `app/admin/(main)/orders/orders-columns.tsx` | modify | remove `enableSorting: false` on amount, quantity, createdAt |
| `app/admin/(main)/orders/orders-data-table.tsx` | modify | add nuqs sort state + `manualSorting` |
| `app/admin/(main)/orders/page.tsx` | modify | add sort to SearchParams, use `parseServerSort` |
| `app/admin/(main)/cards/cards-columns.tsx` | modify | remove `enableSorting: false` on createdAt |
| `app/admin/(main)/cards/cards-data-table.tsx` | modify | add nuqs sort state + `manualSorting` |
| `app/admin/(main)/cards/page.tsx` | modify | add sort to SearchParams, use `parseServerSort` |
| `app/admin/(main)/distributors/distributors-columns.tsx` | modify | remove `enableSorting: false` on name |
| `app/admin/(main)/distributors/distributors-data-table.tsx` | modify | add nuqs sort state + `manualSorting` |
| `app/admin/(main)/distributors/page.tsx` | modify | add sort to SearchParams, use `parseServerSort` |
| `app/admin/(main)/withdrawals/withdrawals-columns.tsx` | modify | amount header → DataTableColumnHeader; remove `enableSorting: false` on createdAt |
| `app/admin/(main)/withdrawals/withdrawals-data-table.tsx` | modify | add nuqs sort state + `manualSorting` |
| `app/admin/(main)/withdrawals/page.tsx` | modify | add sort to SearchParams, use `parseServerSort` |
| `app/admin/(main)/products/[productId]/cards/product-cards-columns.tsx` | modify | remove `enableSorting: false` on createdAt |
| `app/admin/(main)/products/[productId]/cards/product-cards-data-table.tsx` | modify | add nuqs sort state + `manualSorting` |
| `app/admin/(main)/products/[productId]/cards/page.tsx` | modify | add sort to SearchParams, use `parseServerSort` |
| `app/admin/(main)/commission-tiers/commission-tiers-columns.tsx` | modify | minAmount + ratePercent headers → DataTableColumnHeader |
| `app/admin/(main)/payment-channels/payment-channels-data-table.tsx` | modify | add `getSortedRowModel` + SortingState |
| `app/admin/(main)/payment-channels/payment-channels-columns.tsx` | modify | nickname, balance, yearIncome headers → DataTableColumnHeader |
| `app/admin/(main)/payment-channels/[id]/withdrawal-columns.tsx` | modify | amount + createdAt headers → DataTableColumnHeader |

---

### Task 1: Install nuqs and add NuqsAdapter

**Files:**
- Modify: `package.json` (via npm)
- Modify: `app/layout.tsx`

- [ ] **Step 1: Install nuqs**

```bash
npm install nuqs
```

Expected: `nuqs` appears in `package.json` dependencies.

- [ ] **Step 2: Add NuqsAdapter to root layout**

In `app/layout.tsx`, add import and wrap `{children}`:

```tsx
import { NuqsAdapter } from "nuqs/adapters/next/app"
```

Change:
```tsx
<QueryProvider>
  <SiteNameProvider ...>
    <PromoCodeSync />
    {children}
```
To:
```tsx
<QueryProvider>
  <NuqsAdapter>
    <SiteNameProvider ...>
      <PromoCodeSync />
      {children}
```
And close `</NuqsAdapter>` after `</SiteNameProvider>`:
```tsx
    </SiteNameProvider>
  </NuqsAdapter>
```

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx package.json package-lock.json
git commit -m "feat: install nuqs and add NuqsAdapter to root layout"
```

---

### Task 2: Write failing tests for lib/table-sort.ts

**Files:**
- Create: `__tests__/lib/table-sort.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// __tests__/lib/table-sort.test.ts
import { parseSortingState, encodeSortingState, parseServerSort } from "@/lib/table-sort"

describe("parseSortingState", () => {
  const defaults = { sort: "createdAt", sortDir: "desc" as const }

  it("returns default SortingState when both params are null", () => {
    expect(parseSortingState(null, null, defaults)).toEqual([{ id: "createdAt", desc: true }])
  })

  it("returns default SortingState when params are empty strings", () => {
    expect(parseSortingState("", "", defaults)).toEqual([{ id: "createdAt", desc: true }])
  })

  it("parses valid sort + asc sortDir", () => {
    expect(parseSortingState("amount", "asc", defaults)).toEqual([{ id: "amount", desc: false }])
  })

  it("parses valid sort + desc sortDir", () => {
    expect(parseSortingState("amount", "desc", defaults)).toEqual([{ id: "amount", desc: true }])
  })

  it("falls back to default sortDir when sortDir is invalid", () => {
    expect(parseSortingState("amount", "random", defaults)).toEqual([{ id: "amount", desc: true }])
  })

  it("uses provided sort when valid, even if same as default", () => {
    expect(parseSortingState("createdAt", "asc", defaults)).toEqual([{ id: "createdAt", desc: false }])
  })
})

describe("encodeSortingState", () => {
  const defaults = { sort: "createdAt", sortDir: "desc" as const }

  it("returns null params when sorting matches defaults exactly", () => {
    expect(encodeSortingState([{ id: "createdAt", desc: true }], defaults)).toEqual({
      sort: null,
      sortDir: null,
    })
  })

  it("returns null params when sorting array is empty", () => {
    expect(encodeSortingState([], defaults)).toEqual({ sort: null, sortDir: null })
  })

  it("encodes non-default column", () => {
    expect(encodeSortingState([{ id: "amount", desc: false }], defaults)).toEqual({
      sort: "amount",
      sortDir: "asc",
    })
  })

  it("encodes same column with non-default direction", () => {
    expect(encodeSortingState([{ id: "createdAt", desc: false }], defaults)).toEqual({
      sort: "createdAt",
      sortDir: "asc",
    })
  })

  it("encodes non-default column with default direction", () => {
    expect(encodeSortingState([{ id: "amount", desc: true }], defaults)).toEqual({
      sort: "amount",
      sortDir: "desc",
    })
  })
})

describe("parseServerSort", () => {
  const allowed = ["createdAt", "amount", "quantity"] as const
  const defaults = { sort: "createdAt" as const, sortDir: "desc" as const }

  it("returns default orderBy when sort is null", () => {
    expect(parseServerSort(null, null, allowed, defaults)).toEqual({ orderBy: { createdAt: "desc" } })
  })

  it("returns default orderBy when sort is empty string", () => {
    expect(parseServerSort("", "asc", allowed, defaults)).toEqual({ orderBy: { createdAt: "asc" } })
  })

  it("returns correct orderBy for valid column + asc", () => {
    expect(parseServerSort("amount", "asc", allowed, defaults)).toEqual({ orderBy: { amount: "asc" } })
  })

  it("returns correct orderBy for valid column + desc", () => {
    expect(parseServerSort("quantity", "desc", allowed, defaults)).toEqual({ orderBy: { quantity: "desc" } })
  })

  it("falls back to default column when column is not in whitelist", () => {
    expect(parseServerSort("injected_field", "asc", allowed, defaults)).toEqual({
      orderBy: { createdAt: "asc" },
    })
  })

  it("falls back to default sortDir when dir is invalid", () => {
    expect(parseServerSort("amount", "invalid", allowed, defaults)).toEqual({
      orderBy: { amount: "desc" },
    })
  })

  it("handles SQL injection attempt in column name", () => {
    expect(parseServerSort("createdAt; DROP TABLE", "asc", allowed, defaults)).toEqual({
      orderBy: { createdAt: "asc" },
    })
  })
})
```

- [ ] **Step 2: Run to confirm all tests fail**

```bash
npx jest __tests__/lib/table-sort.test.ts --no-coverage
```

Expected: all tests fail with "Cannot find module '@/lib/table-sort'"

---

### Task 3: Implement lib/table-sort.ts

**Files:**
- Create: `lib/table-sort.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/table-sort.ts
import type { SortingState } from "@tanstack/react-table"
import { parseAsString } from "nuqs"

export type SortDir = "asc" | "desc"

export interface SortDefaults<T extends string> {
  sort: T
  sortDir: SortDir
}

/** nuqs query state shape — import this in each server-side data-table */
export const sortQueryStates = {
  sort: parseAsString,
  sortDir: parseAsString,
}

/**
 * URL params → TanStack SortingState.
 * Empty/null sort → uses default.sort.
 * Invalid sortDir → uses default.sortDir.
 */
export function parseSortingState<T extends string>(
  sort: string | null,
  sortDir: string | null,
  defaults: SortDefaults<T>
): SortingState {
  const id = sort || defaults.sort
  const validDir: SortDir =
    sortDir === "asc" || sortDir === "desc" ? sortDir : defaults.sortDir
  return [{ id, desc: validDir === "desc" }]
}

/**
 * TanStack SortingState → URL params.
 * Returns { sort: null, sortDir: null } when sorting equals defaults
 * so nuqs removes those params from the URL.
 */
export function encodeSortingState<T extends string>(
  sorting: SortingState,
  defaults: SortDefaults<T>
): { sort: string | null; sortDir: string | null } {
  if (sorting.length === 0) return { sort: null, sortDir: null }
  const { id, desc } = sorting[0]
  const dir: SortDir = desc ? "desc" : "asc"
  if (id === defaults.sort && dir === defaults.sortDir) {
    return { sort: null, sortDir: null }
  }
  return { sort: id, sortDir: dir }
}

/**
 * Server-side: validate sort column against whitelist, return Prisma-safe orderBy.
 * Unknown column silently falls back to default — never throws.
 */
export function parseServerSort<T extends string>(
  sort: string | null,
  sortDir: string | null,
  allowed: readonly T[],
  defaults: SortDefaults<T>
): { orderBy: Record<string, SortDir> } {
  const column =
    sort && allowed.includes(sort as T) ? (sort as T) : defaults.sort
  const dir: SortDir =
    sortDir === "asc" || sortDir === "desc" ? sortDir : defaults.sortDir
  return { orderBy: { [column]: dir } }
}
```

- [ ] **Step 2: Run tests — all should pass**

```bash
npx jest __tests__/lib/table-sort.test.ts --no-coverage
```

Expected: all 17 tests pass.

- [ ] **Step 3: Commit**

```bash
git add lib/table-sort.ts __tests__/lib/table-sort.test.ts
git commit -m "feat: add table-sort utility with tests (parseSortingState, encodeSortingState, parseServerSort)"
```

---

### Task 4: Orders — server-side sorting

**Files:**
- Modify: `app/admin/(main)/orders/orders-columns.tsx`
- Modify: `app/admin/(main)/orders/orders-data-table.tsx`
- Modify: `app/admin/(main)/orders/page.tsx`

- [ ] **Step 1: Enable sorting on amount, quantity, createdAt columns**

In `app/admin/(main)/orders/orders-columns.tsx`, remove `enableSorting: false` from three columns:

**quantity column** (around line 127–134): remove `enableSorting: false,`

**amount column** (around line 137–146): remove `enableSorting: false,`

**createdAt column** (around line 173–198): remove `enableSorting: false,`

Leave `enableSorting: false` on `orderNo`, `distributor`, `product`, `cards` — these cannot be sorted server-side.

- [ ] **Step 2: Add nuqs sort state to OrdersDataTable**

In `app/admin/(main)/orders/orders-data-table.tsx`:

Add imports after the existing imports:
```tsx
import { useQueryStates, parseAsInteger } from "nuqs"
import type { SortingState, Updater } from "@tanstack/react-table"
import { sortQueryStates, parseSortingState, encodeSortingState } from "@/lib/table-sort"
```

Add constant before the component:
```tsx
const SORT_DEFAULTS = { sort: "createdAt", sortDir: "desc" } as const
```

Inside `OrdersDataTable`, after the existing `useState` declarations, add:
```tsx
const [sortState, setSortState] = useQueryStates(
  { ...sortQueryStates, page: parseAsInteger },
  { history: "push" }
)
const sorting: SortingState = parseSortingState(sortState.sort, sortState.sortDir, SORT_DEFAULTS)
```

In `useReactTable`, add to `state`:
```tsx
state: {
  columnVisibility,
  rowSelection,
  sorting,
},
```

Add after `getCoreRowModel: getCoreRowModel(),`:
```tsx
manualSorting: true,
onSortingChange: (updater: Updater<SortingState>) => {
  const next = typeof updater === "function" ? updater(sorting) : updater
  setSortState({ ...encodeSortingState(next, SORT_DEFAULTS), page: null })
},
```

- [ ] **Step 3: Add parseServerSort to orders page.tsx**

In `app/admin/(main)/orders/page.tsx`:

Add import at top:
```typescript
import { parseServerSort } from "@/lib/table-sort"
```

Extend SearchParams type:
```typescript
type SearchParams = Promise<{
  page?: string
  pageSize?: string
  status?: string
  search?: string
  email?: string
  orderNo?: string
  dateFrom?: string
  dateTo?: string
  sort?: string
  sortDir?: string
}>
```

Replace the hardcoded `orderBy: { createdAt: "desc" }` in `prisma.order.findMany` with:
```typescript
const { orderBy } = parseServerSort(
  rawParams.sort ?? null,
  rawParams.sortDir ?? null,
  ["createdAt", "amount", "quantity"] as const,
  { sort: "createdAt", sortDir: "desc" }
)
```

Then use `orderBy` in the Prisma call:
```typescript
prisma.order.findMany({
  where,
  include: { ... },
  orderBy,
  skip: (page - 1) * pageSize,
  take: pageSize,
}),
```

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add app/admin/\(main\)/orders/
git commit -m "feat(orders): add server-side sorting via nuqs (createdAt, amount, quantity)"
```

---

### Task 5: Cards — server-side sorting

**Files:**
- Modify: `app/admin/(main)/cards/cards-columns.tsx`
- Modify: `app/admin/(main)/cards/cards-data-table.tsx`
- Modify: `app/admin/(main)/cards/page.tsx`

- [ ] **Step 1: Enable sorting on createdAt column**

In `app/admin/(main)/cards/cards-columns.tsx`:

Remove `enableSorting: false,` from the `createdAt` column (around line 118–128).

Leave `enableSorting: false` on `maskedContent` and `product`.

- [ ] **Step 2: Add nuqs sort state to CardsDataTable**

In `app/admin/(main)/cards/cards-data-table.tsx`:

Add imports:
```tsx
import { useQueryStates, parseAsInteger } from "nuqs"
import type { SortingState, Updater } from "@tanstack/react-table"
import { sortQueryStates, parseSortingState, encodeSortingState } from "@/lib/table-sort"
```

Add constant before component:
```tsx
const SORT_DEFAULTS = { sort: "createdAt", sortDir: "desc" } as const
```

Inside `CardsDataTable`, after existing `useState` calls, add:
```tsx
const [sortState, setSortState] = useQueryStates(
  { ...sortQueryStates, page: parseAsInteger },
  { history: "push" }
)
const sorting: SortingState = parseSortingState(sortState.sort, sortState.sortDir, SORT_DEFAULTS)
```

In `useReactTable`:
```tsx
state: {
  columnVisibility,
  rowSelection,
  sorting,
},
manualSorting: true,
onSortingChange: (updater: Updater<SortingState>) => {
  const next = typeof updater === "function" ? updater(sorting) : updater
  setSortState({ ...encodeSortingState(next, SORT_DEFAULTS), page: null })
},
```

- [ ] **Step 3: Add parseServerSort to cards page.tsx**

In `app/admin/(main)/cards/page.tsx`:

Add import:
```typescript
import { parseServerSort } from "@/lib/table-sort"
```

Extend SearchParams type — add `sort?: string; sortDir?: string`:
```typescript
type SearchParams = Promise<{
  page?: string
  pageSize?: string
  status?: string
  productKeyword?: string
  orderNo?: string
  codeLike?: string
  sort?: string
  sortDir?: string
}>
```

After `const filters = parseCardFilters(rawParams as CardFiltersInput)`, add:
```typescript
const { orderBy } = parseServerSort(
  rawParams.sort ?? null,
  rawParams.sortDir ?? null,
  ["createdAt"] as const,
  { sort: "createdAt", sortDir: "desc" }
)
```

Find the `prisma.card.findMany` call and replace its `orderBy: { createdAt: "desc" }` with `orderBy`.

- [ ] **Step 4: Commit**

```bash
git add app/admin/\(main\)/cards/
git commit -m "feat(cards): add server-side sorting via nuqs (createdAt)"
```

---

### Task 6: Distributors — server-side sorting

**Files:**
- Modify: `app/admin/(main)/distributors/distributors-columns.tsx`
- Modify: `app/admin/(main)/distributors/distributors-data-table.tsx`
- Modify: `app/admin/(main)/distributors/page.tsx`

- [ ] **Step 1: Enable sorting on name column**

In `app/admin/(main)/distributors/distributors-columns.tsx`:

Remove `enableSorting: false,` from the `name` column (around line 36).

Leave `enableSorting: false` on all other columns that have it (`inviteeCount`, `completedOrderCount`, `totalCommission`, `withdrawableBalance`) — these are JS-computed values and cannot be sorted in Prisma.

- [ ] **Step 2: Add nuqs sort state to DistributorsDataTable**

In `app/admin/(main)/distributors/distributors-data-table.tsx`:

Add imports:
```tsx
import { useQueryStates, parseAsInteger } from "nuqs"
import type { SortingState, Updater } from "@tanstack/react-table"
import { sortQueryStates, parseSortingState, encodeSortingState } from "@/lib/table-sort"
```

Add constant before component:
```tsx
const SORT_DEFAULTS = { sort: "createdAt", sortDir: "desc" } as const
```

Inside `DistributorsDataTable`, after the existing `useState(VisibilityState)` call, add:
```tsx
const [sortState, setSortState] = useQueryStates(
  { ...sortQueryStates, page: parseAsInteger },
  { history: "push" }
)
const sorting: SortingState = parseSortingState(sortState.sort, sortState.sortDir, SORT_DEFAULTS)
```

In `useReactTable`, update `state` and add `manualSorting`:
```tsx
state: {
  columnVisibility,
  sorting,
},
manualSorting: true,
onSortingChange: (updater: Updater<SortingState>) => {
  const next = typeof updater === "function" ? updater(sorting) : updater
  setSortState({ ...encodeSortingState(next, SORT_DEFAULTS), page: null })
},
```

- [ ] **Step 3: Add parseServerSort to distributors page.tsx**

In `app/admin/(main)/distributors/page.tsx`:

Add import:
```typescript
import { parseServerSort } from "@/lib/table-sort"
```

Extend SearchParams type to include sort/sortDir:
```typescript
type SearchParams = Promise<{
  page?: string
  pageSize?: string
  search?: string
  status?: string
  sort?: string
  sortDir?: string
}>
```

After `const filters = parseDistributorFilters(rawParams as DistributorFiltersInput)`, add:
```typescript
const { orderBy } = parseServerSort(
  rawParams.sort ?? null,
  rawParams.sortDir ?? null,
  ["createdAt", "name"] as const,
  { sort: "createdAt", sortDir: "desc" }
)
```

Replace `orderBy: { createdAt: "desc" }` in `prisma.user.findMany` with `orderBy`.

- [ ] **Step 4: Commit**

```bash
git add app/admin/\(main\)/distributors/
git commit -m "feat(distributors): add server-side sorting via nuqs (name, createdAt)"
```

---

### Task 7: Withdrawals — server-side sorting

**Files:**
- Modify: `app/admin/(main)/withdrawals/withdrawals-columns.tsx`
- Modify: `app/admin/(main)/withdrawals/withdrawals-data-table.tsx`
- Modify: `app/admin/(main)/withdrawals/page.tsx`

- [ ] **Step 1: Update columns**

In `app/admin/(main)/withdrawals/withdrawals-columns.tsx`:

Add `DataTableColumnHeader` import at the top (it's missing):
```tsx
import { DataTableColumnHeader } from "@/app/admin/components"
```

Change the `amount` column header from a function returning a div to a `DataTableColumnHeader`:
```tsx
// Before:
header: () => <div className="text-right">申请金额</div>,

// After:
header: ({ column }) => (
  <DataTableColumnHeader column={column} title="申请金额" className="justify-end" />
),
```

Remove `enableSorting: false,` from the `createdAt` column (around line 102).

- [ ] **Step 2: Add nuqs sort state to WithdrawalsDataTable**

In `app/admin/(main)/withdrawals/withdrawals-data-table.tsx`:

Add imports:
```tsx
import { useQueryStates, parseAsInteger } from "nuqs"
import type { SortingState, Updater } from "@tanstack/react-table"
import { sortQueryStates, parseSortingState, encodeSortingState } from "@/lib/table-sort"
```

Add constant before component:
```tsx
const SORT_DEFAULTS = { sort: "createdAt", sortDir: "desc" } as const
```

Inside `WithdrawalsDataTable`, after the existing `useState` call for `VisibilityState`, add:
```tsx
const [sortState, setSortState] = useQueryStates(
  { ...sortQueryStates, page: parseAsInteger },
  { history: "push" }
)
const sorting: SortingState = parseSortingState(sortState.sort, sortState.sortDir, SORT_DEFAULTS)
```

In `useReactTable`, add to `state` and add `manualSorting`:
```tsx
state: {
  columnVisibility,
  sorting,
},
manualSorting: true,
onSortingChange: (updater: Updater<SortingState>) => {
  const next = typeof updater === "function" ? updater(sorting) : updater
  setSortState({ ...encodeSortingState(next, SORT_DEFAULTS), page: null })
},
```

- [ ] **Step 3: Add parseServerSort to withdrawals page.tsx**

In `app/admin/(main)/withdrawals/page.tsx`:

Add import:
```typescript
import { parseServerSort } from "@/lib/table-sort"
```

The current SearchParams type is `Promise<WithdrawalFiltersInput>`. Change it to:
```typescript
type SearchParams = Promise<WithdrawalFiltersInput & { sort?: string; sortDir?: string }>
```

After `const { page, pageSize, statusList, search } = filters`, add:
```typescript
const rawParams = await searchParams  // already awaited above as `filters`, need to re-read
```

Wait — actually the current code does `const filters = parseWithdrawalFilters(await searchParams)` but doesn't keep the raw params. Change to:
```typescript
const raw = await searchParams
const filters = parseWithdrawalFilters(raw)
const { page, pageSize, statusList, search } = filters
const { orderBy } = parseServerSort(
  raw.sort ?? null,
  raw.sortDir ?? null,
  ["createdAt", "amount"] as const,
  { sort: "createdAt", sortDir: "desc" }
)
```

Replace `orderBy: { createdAt: "desc" }` in `prisma.withdrawal.findMany` with `orderBy`.

- [ ] **Step 4: Commit**

```bash
git add app/admin/\(main\)/withdrawals/
git commit -m "feat(withdrawals): add server-side sorting via nuqs (createdAt, amount)"
```

---

### Task 8: Product-cards — server-side sorting

**Files:**
- Modify: `app/admin/(main)/products/[productId]/cards/product-cards-columns.tsx`
- Modify: `app/admin/(main)/products/[productId]/cards/product-cards-data-table.tsx`
- Modify: `app/admin/(main)/products/[productId]/cards/page.tsx`

- [ ] **Step 1: Enable sorting on createdAt column**

In `app/admin/(main)/products/[productId]/cards/product-cards-columns.tsx`:

Remove `enableSorting: false,` from the `createdAt` column (around line 285–296).

Leave `enableSorting: false` on `maskedContent`.

- [ ] **Step 2: Add nuqs sort state to ProductCardsDataTable**

In `app/admin/(main)/products/[productId]/cards/product-cards-data-table.tsx`:

Add imports:
```tsx
import { useQueryStates, parseAsInteger } from "nuqs"
import type { SortingState, Updater } from "@tanstack/react-table"
import { sortQueryStates, parseSortingState, encodeSortingState } from "@/lib/table-sort"
```

Add constant before component:
```tsx
const SORT_DEFAULTS = { sort: "createdAt", sortDir: "desc" } as const
```

Inside the component, after existing `useState` calls, add:
```tsx
const [sortState, setSortState] = useQueryStates(
  { ...sortQueryStates, page: parseAsInteger },
  { history: "push" }
)
const sorting: SortingState = parseSortingState(sortState.sort, sortState.sortDir, SORT_DEFAULTS)
```

In `useReactTable`:
```tsx
state: {
  columnVisibility,
  rowSelection,
  sorting,
},
manualSorting: true,
onSortingChange: (updater: Updater<SortingState>) => {
  const next = typeof updater === "function" ? updater(sorting) : updater
  setSortState({ ...encodeSortingState(next, SORT_DEFAULTS), page: null })
},
```

- [ ] **Step 3: Add parseServerSort to product-cards page.tsx**

In `app/admin/(main)/products/[productId]/cards/page.tsx`:

Add import:
```typescript
import { parseServerSort } from "@/lib/table-sort"
```

Extend SearchParams type to include sort/sortDir:
```typescript
type PageProps = {
  params: Promise<{ productId: string }>
  searchParams: Promise<{
    action?: string
    page?: string
    pageSize?: string
    status?: string
    search?: string
    sort?: string
    sortDir?: string
  }>
}
```

After `const rawParams = await searchParams`, add:
```typescript
const { orderBy } = parseServerSort(
  rawParams.sort ?? null,
  rawParams.sortDir ?? null,
  ["createdAt"] as const,
  { sort: "createdAt", sortDir: "desc" }
)
```

Find `prisma.card.findMany` and replace `orderBy: { createdAt: "desc" }` with `orderBy`.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/(main)/products/[productId]/cards/"
git commit -m "feat(product-cards): add server-side sorting via nuqs (createdAt)"
```

---

### Task 9: Client-side — commission-tiers column headers

**Files:**
- Modify: `app/admin/(main)/commission-tiers/commission-tiers-columns.tsx`

- [ ] **Step 1: Add DataTableColumnHeader to minAmount and ratePercent**

In `app/admin/(main)/commission-tiers/commission-tiers-columns.tsx`:

The `DataTableColumnHeader` import is already present (used for sortOrder). Update `minAmount` and `ratePercent` column headers:

**minAmount** — change:
```tsx
// Before:
header: () => <div className="text-right">当周销售额下限（元）</div>,

// After:
header: ({ column }) => (
  <DataTableColumnHeader column={column} title="销售额下限" className="justify-end" />
),
```

**ratePercent** — change:
```tsx
// Before:
header: () => <div className="text-right">佣金比例（%）</div>,

// After:
header: ({ column }) => (
  <DataTableColumnHeader column={column} title="佣金比例（%）" className="justify-end" />
),
```

Leave `maxAmount` with plain header (not in spec scope).

- [ ] **Step 2: Commit**

```bash
git add app/admin/\(main\)/commission-tiers/commission-tiers-columns.tsx
git commit -m "feat(commission-tiers): enable client-side sorting on minAmount and ratePercent"
```

---

### Task 10: Client-side — payment-channels data-table and columns

**Files:**
- Modify: `app/admin/(main)/payment-channels/payment-channels-data-table.tsx`
- Modify: `app/admin/(main)/payment-channels/payment-channels-columns.tsx`

- [ ] **Step 1: Add getSortedRowModel to PaymentChannelsDataTable**

In `app/admin/(main)/payment-channels/payment-channels-data-table.tsx`:

Add to imports:
```tsx
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
} from "@tanstack/react-table"
import { useState } from "react"  // add if not present
```

Add state inside the component (after existing `useState` calls):
```tsx
const [sorting, setSorting] = useState<SortingState>([])
```

In `useReactTable`, add:
```tsx
getSortedRowModel: getSortedRowModel(),
onSortingChange: setSorting,
state: {
  ...existingState,
  sorting,
},
```

- [ ] **Step 2: Add DataTableColumnHeader to sortable columns**

In `app/admin/(main)/payment-channels/payment-channels-columns.tsx`:

Add import:
```tsx
import { DataTableColumnHeader } from "@/app/admin/components"
```

Update three column headers:

**nickname** column:
```tsx
// Before:
header: "渠道",

// After:
header: ({ column }) => <DataTableColumnHeader column={column} title="渠道" />,
```

**balance** column:
```tsx
// Before:
header: "当前余额",

// After:
header: ({ column }) => <DataTableColumnHeader column={column} title="当前余额" />,
```

**yearIncome** column:
```tsx
// Before:
header: "年度进度",

// After:
header: ({ column }) => <DataTableColumnHeader column={column} title="年度进度" />,
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/\(main\)/payment-channels/payment-channels-data-table.tsx app/admin/\(main\)/payment-channels/payment-channels-columns.tsx
git commit -m "feat(payment-channels): add client-side sorting (nickname, balance, yearIncome)"
```

---

### Task 11: Client-side — payment-channels/[id]/withdrawal columns

**Files:**
- Modify: `app/admin/(main)/payment-channels/[id]/withdrawal-columns.tsx`

- [ ] **Step 1: Add DataTableColumnHeader to amount and createdAt**

In `app/admin/(main)/payment-channels/[id]/withdrawal-columns.tsx`:

Add import:
```tsx
import { DataTableColumnHeader } from "@/app/admin/components"
```

Update `amount` column header:
```tsx
// Before:
header: "金额",

// After:
header: ({ column }) => <DataTableColumnHeader column={column} title="金额" />,
```

Update `createdAt` column header:
```tsx
// Before:
header: "记录时间",

// After:
header: ({ column }) => <DataTableColumnHeader column={column} title="记录时间" />,
```

- [ ] **Step 2: Run full test suite**

```bash
npm test -- --no-coverage
```

Expected: all tests pass (at minimum the 17 new table-sort tests).

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/(main)/payment-channels/[id]/withdrawal-columns.tsx"
git commit -m "feat(payment-channel-withdrawals): enable client-side sorting on amount and createdAt"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Covered by task |
|-----------------|-----------------|
| Install nuqs + NuqsAdapter | Task 1 |
| `lib/table-sort.ts` with parseSortingState, encodeSortingState, parseServerSort, sortQueryStates | Task 3 |
| Tests for all three functions | Task 2 |
| orders: createdAt, amount, quantity sortable | Task 4 |
| cards: createdAt sortable | Task 5 |
| distributors: createdAt, name sortable | Task 6 |
| withdrawals: createdAt, amount sortable | Task 7 |
| product-cards: createdAt sortable | Task 8 |
| Default sort = createdAt desc, not written to URL | Task 3 (`encodeSortingState` returns null for defaults) |
| Page resets to 1 on sort change | Tasks 4–8 (`page: null` in setSortState) |
| commission-tiers: minAmount, ratePercent | Task 9 |
| payment-channels: nickname, balance, yearIncome | Task 10 |
| payment-channels/[id]/withdrawal: amount, createdAt | Task 11 |
| announcements, guides, campaigns — already have getSortedRowModel + DataTableColumnHeader columns | No action needed (confirmed from code) |

### Type consistency

- `SortingState`, `Updater` from `@tanstack/react-table` used consistently
- `sortQueryStates` exported from `lib/table-sort.ts`, imported in every server-side data-table
- `parseSortingState` / `encodeSortingState` signatures consistent across tasks 4–8
- `SORT_DEFAULTS` declared identically in each data-table
- `parseServerSort` return type `{ orderBy: Record<string, SortDir> }` — Prisma accepts `Record<string, "asc" | "desc">` ✓
