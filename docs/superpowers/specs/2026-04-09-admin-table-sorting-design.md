# Admin Table Sorting — Design Spec

**Date:** 2026-04-09
**Status:** Draft — pending user review

---

## Goal

Add column sorting to all admin tables. URL-persisted for server-side tables (nuqs); in-memory for client-side tables (TanStack built-in).

---

## Background

There are two existing table patterns in `app/admin/(main)/`:

| Pattern | Tables | Current sorting |
|---------|--------|-----------------|
| **Client-side** (full data loaded, `getSortedRowModel`) | products, announcements, guides, commission-tiers, campaigns, payment-channels | products already works; others missing `getSortedRowModel` |
| **Server-side** (`manualPagination + manualFiltering`, URL-driven) | orders, cards, distributors, withdrawals, product-cards | all disabled (`enableSorting: false`) |

---

## Architecture Decision

**nuqs** is adopted as the URL state manager for server-side tables. It is the industry standard for Next.js App Router URL state (`useQueryStates` ≈ `useState` + URL sync, type-safe, 6 kB gzipped). Already referenced in CLAUDE.md as "可考虑".

Client-side tables use TanStack's built-in `getSortedRowModel()` — no URL persistence needed for small datasets.

---

## Implementation

### 1. Install nuqs

```bash
npm install nuqs
```

Wrap root layout in `NuqsAdapter`:

```tsx
// app/layout.tsx
import { NuqsAdapter } from "nuqs/adapters/next/app"

// inside RootLayout JSX:
<NuqsAdapter>{children}</NuqsAdapter>
```

---

### 2. Shared utility: `lib/table-sort.ts`

Pure functions — no React, no side effects. All testable in isolation.

```typescript
import type { SortingState } from "@tanstack/react-table"
import { parseAsString, type UseQueryStatesReturn } from "nuqs"

export type SortDir = "asc" | "desc"

export interface SortDefaults<T extends string> {
  sort: T
  sortDir: SortDir
}

/** URL params → TanStack SortingState */
export function parseSortingState<T extends string>(
  sort: string | null,
  sortDir: string | null,
  defaults: SortDefaults<T>
): SortingState

/** TanStack SortingState → URL params (null = remove from URL = default) */
export function encodeSortingState<T extends string>(
  sorting: SortingState,
  defaults: SortDefaults<T>
): { sort: string | null; sortDir: string | null }

/**
 * Server-side: validate sort column against whitelist, return Prisma-safe orderBy.
 * Invalid column silently falls back to default (no 400 error).
 */
export function parseServerSort<T extends string>(
  sort: string | null,
  sortDir: string | null,
  allowed: readonly T[],
  defaults: SortDefaults<T>
): { orderBy: { [K in T]?: SortDir } }

/** nuqs query state shape — reuse across all server-side data-tables */
export const sortQueryStates = {
  sort: parseAsString,
  sortDir: parseAsString,
}
```

---

### 3. Server-side tables

#### 3a. `*-data-table.tsx` pattern

```tsx
import { useQueryStates } from "nuqs"
import { sortQueryStates, parseSortingState, encodeSortingState } from "@/lib/table-sort"

const SORT_DEFAULTS = { sort: "createdAt", sortDir: "desc" } as const

export function OrdersDataTable({ data, total, ... }) {
  const [sortState, setSortState] = useQueryStates(sortQueryStates, { history: "push" })
  const sorting = parseSortingState(sortState.sort, sortState.sortDir, SORT_DEFAULTS)

  const table = useReactTable({
    // ... existing config ...
    manualSorting: true,
    state: { sorting, columnVisibility, rowSelection },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater
      setSortState(encodeSortingState(next, SORT_DEFAULTS))
    },
  })
  // ... rest unchanged
}
```

`history: "push"` is used so sort changes are browser-history entries (back button works).

#### 3b. `page.tsx` pattern

```typescript
// searchParams now includes sort + sortDir alongside existing params
const { orderBy } = parseServerSort(
  rawParams.sort ?? null,
  rawParams.sortDir ?? null,
  ["createdAt", "amount", "quantity"] as const,
  { sort: "createdAt", sortDir: "desc" }
)

await prisma.order.findMany({ where, orderBy, skip, take })
```

The existing `parse*Filters` functions are **not modified** — sort is read directly from `searchParams` in `page.tsx`.

#### 3c. `*-columns.tsx` — enable sorting on data columns

Remove `enableSorting: false` and ensure `DataTableColumnHeader` is used for sortable columns.

---

### 4. Client-side tables

Add `getSortedRowModel()` and `SortingState` state where missing:

```tsx
// Before (missing sorting):
const table = useReactTable({
  data, columns,
  getCoreRowModel: getCoreRowModel(),
  // ...
})

// After:
const [sorting, setSorting] = useState<SortingState>([])

const table = useReactTable({
  data, columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  onSortingChange: setSorting,
  state: { sorting, ... },
})
```

Ensure `DataTableColumnHeader` is used on sortable columns (already present on most).

---

### 5. Sortable columns per table

#### Server-side

| Table | Sortable columns | Default | Notes |
|-------|-----------------|---------|-------|
| orders | `createdAt`, `amount`, `quantity` | `createdAt desc` | |
| cards | `createdAt` | `createdAt desc` | |
| product-cards | `createdAt` | `createdAt desc` | |
| distributors | `createdAt`, `name` | `createdAt desc` | `totalCommission` / `withdrawableBalance` / `completedOrderCount` are JS-computed aggregates — not DB columns, cannot use in Prisma `orderBy` |
| withdrawals | `createdAt`, `amount` | `createdAt desc` | |

#### Client-side

| Table | Sortable columns |
|-------|-----------------|
| products | `name`, `price`, `stock` (already enabled) |
| announcements | `title`, `sortOrder`, `publishedAt`, `createdAt` |
| guides | `title`, `sortOrder`, `publishedAt`, `createdAt` |
| commission-tiers | `sortOrder`, `minAmount`, `ratePercent` |
| campaigns | `name`, `createdAt` |
| payment-channels | `nickname`, `balance`, `yearIncome` |
| payment-channels/[id]/withdrawal | `amount`, `createdAt` | (already has `getSortedRowModel`) |

---

### 6. URL schema

Sort params use short, predictable keys:

| Param | Values | Default (not written to URL) |
|-------|--------|------------------------------|
| `sort` | column key string | `createdAt` |
| `sortDir` | `asc` \| `desc` | `desc` |

Example: `?sort=amount&sortDir=asc&page=1&status=PENDING`

When sorting returns to default, both params are removed from URL.

---

## Testing

### `__tests__/lib/table-sort.test.ts` (new)

**`parseSortingState`:**
- null inputs → returns default SortingState
- valid sort + sortDir → correct SortingState
- invalid sortDir → falls back to default dir
- empty string → treated as null

**`encodeSortingState`:**
- default sorting → returns `{ sort: null, sortDir: null }`
- non-default column → returns encoded params
- same column, different dir → encodes dir only difference

**`parseServerSort`:**
- valid column → correct `orderBy`
- unknown column → falls back to default (no throw)
- `asc`/`desc` preserved correctly
- whitelist enforced (cannot inject arbitrary column names)

### Extend existing filter tests

Add sort param round-trip coverage to `__tests__/admin/orders-filters.test.ts` and `__tests__/admin/cards-filters.test.ts`.

---

## Files changed

### New
- `lib/table-sort.ts`
- `__tests__/lib/table-sort.test.ts`

### Modified
- `app/layout.tsx` — add `NuqsAdapter`
- `app/admin/(main)/orders/orders-data-table.tsx` — nuqs sort state
- `app/admin/(main)/orders/orders-columns.tsx` — enable sort on createdAt, amount, quantity
- `app/admin/(main)/orders/page.tsx` — parseServerSort → orderBy
- `app/admin/(main)/cards/cards-data-table.tsx`
- `app/admin/(main)/cards/cards-columns.tsx`
- `app/admin/(main)/cards/page.tsx`
- `app/admin/(main)/distributors/distributors-data-table.tsx`
- `app/admin/(main)/distributors/distributors-columns.tsx`
- `app/admin/(main)/distributors/page.tsx`
- `app/admin/(main)/withdrawals/withdrawals-data-table.tsx`
- `app/admin/(main)/withdrawals/withdrawals-columns.tsx`
- `app/admin/(main)/withdrawals/page.tsx`
- `app/admin/(main)/products/[productId]/cards/product-cards-data-table.tsx`
- `app/admin/(main)/products/[productId]/cards/product-cards-columns.tsx`
- `app/admin/(main)/products/[productId]/cards/page.tsx`
- `app/admin/(main)/products/products-data-table.tsx` — already has sort, verify columns
- `app/admin/(main)/announcements/announcements-data-table.tsx` — add getSortedRowModel
- `app/admin/(main)/guides/guides-data-table.tsx`
- `app/admin/(main)/commission-tiers/commission-tiers-data-table.tsx`
- `app/admin/(main)/email-marketing/campaigns-data-table.tsx`
- `app/admin/(main)/payment-channels/payment-channels-data-table.tsx`

### Already has sorting (verify columns)
- `app/admin/(main)/payment-channels/[id]/withdrawal-data-table.tsx` — already uses `getSortedRowModel()`, only needs column enablement

---

## Out of scope

- Migrating existing filter/search/pagination URL state to nuqs (separate task)
- Multi-column sorting (TanStack supports it; not needed here)
- Persisting sort preference to localStorage
