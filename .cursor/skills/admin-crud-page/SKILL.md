---
name: admin-crud-page
description: Builds or refactors admin CRUD list pages following Ant Design Pro ProTable patterns with shadcn + TanStack Table. Use when adding a new admin list page, refactoring an existing admin table (e.g. cards, orders, products), or when the user asks for "后台管理页" / "ProTable 风格" / "admin CRUD page".
---

# Admin CRUD Page (ProTable-style)

Standard for backend list pages: list + filter + batch actions + add/edit/delete. Align with Ant Design Pro ProTable patterns using **shadcn + TanStack Table + Next.js App Router**.

## When to Apply

- New admin list page (e.g. `/admin/{resource}`)
- Refactoring an existing admin table to match ProTable patterns
- User asks for "后台白皮书" / "antd pro 风格" / "成熟后台管理方案"

## Eight Core Patterns (ProTable → This Stack)

| ProTable | This project |
|----------|----------------|
| PageContainer + header | Page title + primary actions (add, import) in page header |
| ProTable + request | RSC `page.tsx` fetches via Prisma; pass data to client DataTable |
| search + valueEnum | Toolbar: global search Input + Faceted Filter (Popover + Checkbox) |
| toolBarRender | `DataTableToolbar`: search + filters + view options + action buttons |
| tableAlertRender / tableAlertOptionRender | `DataTableSelectionBar`: "已选 N 项" + batch actions + clear |
| rowSelection | TanStack `rowSelection` + Checkbox column; optional cross-page preserve |
| options.setting | `DataTableViewOptions`: DropdownMenu column visibility |
| pagination | `DataTablePagination`: total text + pageSize Select + page links; **URL-driven** |

All filter/pagination state lives in **URL searchParams** (see `.cursor/rules/url-state-sync.mdc`). No duplicate React state for the same values.

**Next 15+ (incl. 16)**: `page` receives `searchParams` as a **Promise**. In RSC you must `await searchParams` before parsing (e.g. `const params = await searchParams` then `parseFilters(params)`). Use this when building filter/pagination in `page.tsx`.

## Three Block Layout

### 1. Filter block

- **DataTableToolbar**: Search input (debounced), Faceted Filter triggers, View Options dropdown, primary actions (e.g. Add, Import).
- **DataTableFacetedFilter**: Popover + Command + Checkbox list; show option counts; Badge for selected count; Clear.
- **DataTableViewOptions**: DropdownMenu with CheckboxItem per column; columns with `enableHiding: false` omitted.
- URL: `status`, `search`, `sort`, `page`, `pageSize` (and resource-specific params). Read in RSC; update via `router.push`/`router.replace` in handlers only.

### 2. Content block

- **DataTable**: Renders TanStack Table (TableHeader/TableBody); supports select column, sortable headers, visibility; empty state and loading skeleton.
- **DataTableColumnHeader**: Sortable header (Asc / Desc / none); optional "Hide column" in dropdown.
- **DataTableSelectionBar**: Shown when `selectedRowCount > 0`. Text "已选 N 项", batch action buttons (e.g. 批量删除, 批量停用, 批量启用), "清空选择". Disable batch buttons by business rule (e.g. only UNSOLD can be deleted).
- **Row actions**: One column with DropdownMenu (MoreHorizontal). Items: view, copy, disable/enable, delete. Use **AlertDialog** for delete confirmation.
- **Empty state**: Different copy for "no data" vs "no results for current filters"; optional CTA (e.g. Add, Reset filters).
- **Loading**: `loading.tsx` skeleton that matches table column layout.

### 3. Pagination block

- **DataTablePagination**: Left = "共 N 条记录" (or "已选 X / N 行"); center = page size Select (10/20/50/100); right = Prev / page numbers / Next.
- **URL-driven**: Read `page` and `pageSize` directly from `useSearchParams()` in the pagination component. Do NOT use `table.getState().pagination` for server-side pagination.
- **No client-side pagination state**: `useReactTable` should have `manualPagination: true` but do NOT pass `pagination` state or `onPaginationChange`. The pagination component updates URL via `router.push()`, RSC refetches with new skip/take.

## Standard File Structure

```
app/admin/(main)/{resource}/
  page.tsx                 # RSC: await searchParams → Prisma → pass data + total to client
  {resource}-data-table.tsx # Client: useReactTable + Toolbar + SelectionBar + DataTable + Pagination
  {resource}-columns.tsx    # ColumnDef[] (select, data columns, actions)
  {resource}-filters.ts     # parseFilters(searchParams), buildQuery(filters)
  loading.tsx               # Skeleton for table layout
```

Shared components live under `app/admin/components/` (or `components/` if project-wide):  
`data-table.tsx`, `data-table-toolbar.tsx`, `data-table-faceted-filter.tsx`, `data-table-view-options.tsx`, `data-table-column-header.tsx`, `data-table-selection-bar.tsx`, `data-table-pagination.tsx`.

## Public Component List

| Component | Path | Role |
|-----------|------|------|
| DataTable | `app/admin/components/data-table.tsx` | TanStack Table + shadcn Table; empty state |
| DataTableToolbar | `data-table-toolbar.tsx` | Search + faceted filters + view options + actions |
| DataTableFacetedFilter | `data-table-faceted-filter.tsx` | Popover filter with Checkbox + counts |
| DataTableViewOptions | `data-table-view-options.tsx` | Column visibility dropdown |
| DataTableColumnHeader | `data-table-column-header.tsx` | Sortable column header |
| DataTableSelectionBar | `data-table-selection-bar.tsx` | Selected count + batch actions + clear |
| DataTablePagination | `data-table-pagination.tsx` | Total + pageSize + page links (**reads from URL, not table state**) |
| (Optional) DataTableSkeleton | `data-table-skeleton.tsx` | Reusable table skeleton for loading.tsx |

## Server-Side Pagination Pattern (Critical)

For server-side pagination, the pagination component must:

1. **Read page/pageSize directly from URL** using `useSearchParams()`, NOT from `table.getState().pagination`
2. **Update URL only** via `router.push()` — no `table.setPageSize()` or `table.setPageIndex()` calls
3. **Do NOT pass `pagination` state to `useReactTable`** — just set `manualPagination: true`

This ensures URL is the single source of truth and RSC refetches data on navigation.

```tsx
// ❌ WRONG: Reading from table state (won't sync with URL on server-side pagination)
const pageSize = table.getState().pagination.pageSize;

// ✅ CORRECT: Reading from URL
const searchParams = useSearchParams();
const page = parseInt(searchParams.get("page") ?? "", 10) || 1;
const pageSize = parseInt(searchParams.get("pageSize") ?? "", 10) || 20;
```

## Batch API Convention

- **Route**: `POST /api/{resource}/batch`
- **Body**: `{ action: "DELETE" | "DISABLE" | "ENABLE", ids: string[] }` (or resource-specific id field name)
- **Response**: `{ success: number, skipped?: number, errors?: string[] }`
- Validate with Zod; enforce admin auth; apply action only to allowed statuses (e.g. DELETE only for UNSOLD).

## Checklist for New/Refactored Page

- [ ] RSC awaits `searchParams` (Next 15+), then reads filters + pagination from URL; single Prisma query with skip/take and filters
- [ ] Client table uses shared DataTable + Toolbar + SelectionBar + Pagination
- [ ] Filter/pagination changes update URL only in event handlers (no useEffect syncing URL ↔ state)
- [ ] Row actions use DropdownMenu; delete uses AlertDialog
- [ ] Empty and loading states implemented
- [ ] Batch API exists and SelectionBar calls it; buttons disabled when selection not allowed
- [ ] Columns and filters types match (e.g. status valueEnum ↔ Faceted Filter options)

## Additional Reference

- Detailed props, code templates, and ProTable API mapping: [reference.md](reference.md)
- URL/state rules: `.cursor/rules/url-state-sync.mdc`
