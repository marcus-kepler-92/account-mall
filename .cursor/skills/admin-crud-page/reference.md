# Admin CRUD Page — Reference

Detailed API mapping, component contracts, and code templates. See [SKILL.md](SKILL.md) for when to use and high-level layout.

---

## A. Filter block

### Design principles

- **Single source of truth**: Filter values come from URL searchParams. RSC parses them; client toolbar builds links/forms that navigate to new URLs (no controlled input state that mirrors URL).
- **ProTable mapping**: `search` + column `valueEnum` → Toolbar search Input + Faceted Filter(s). LightFilter-style: compact triggers, popover content.

### DataTableToolbar

**Role**: Search input, Faceted Filter triggers, View Options, primary action buttons.

**Typical props** (adapt to your table):

- `table`: `Table<TData>` from `useReactTable`
- `searchPlaceholder?: string`
- `searchParamKey?: string` (e.g. `"q"` or `"search"`)
- `filterConfigs?: Array<{ key: string; label: string; options: { value: string; label: string; count?: number }[] }>`
- `children?: ReactNode` (e.g. "Add", "Import" buttons)

**Behavior**: On search submit or filter apply, compute new query from current searchParams and call `router.push(pathname + "?" + query)` or `router.replace`. Do not hold filter values in React state for the same keys as URL.

### DataTableFacetedFilter

**Role**: One faceted filter (e.g. status). Popover with searchable Checkbox list; show count per option; Badge on trigger with selected count; Clear option.

**Typical props**:

- `column?: Column<TData, unknown>` (if bound to TanStack column)
- `title`: string
- `options`: `{ value: string; label: string; count?: number }[]`
- `selectedValues`: Set<string> or string[] (from URL)
- `onChange`: (values: string[]) => void → build new URL and navigate

**Implementation note**: Use shadcn Popover + Command (for search) + Checkbox list. When used with URL state, `selectedValues` is derived from searchParams; `onChange` updates URL.

### DataTableViewOptions

**Role**: Toggle column visibility. DropdownMenu with DropdownMenuCheckboxItem per column; columns with `enableHiding: false` are omitted.

**Typical props**: `table`: `Table<TData>`.

**Note**: Visibility can stay in client state (TanStack `onColumnVisibilityChange`) unless you want it in URL (e.g. `columns=id,name,status`).

### URL sync

- **Read**: In RSC, **await** `searchParams` first (Next 15+ / 16: `searchParams` is a Promise). Example: `const params = await props.searchParams`; then parse with e.g. `parseFilters(params)`.
- **Write**: In client, `const pathname = usePathname(); const router = useRouter();` then in handlers only: `router.replace(pathname + "?" + buildQuery(nextFilters))`.
- Do not use `useEffect` to push URL from React state; avoid duplicate state for the same keys as URL.

---

## B. Content block

### DataTable (core)

**Role**: Render table from TanStack Table instance; empty state when no rows.

**Props**:

- `table`: `Table<TData>`
- `columns`: `ColumnDef<TData, TValue>[]` (for colSpan on empty)
- `emptyMessage?: string` (e.g. "暂无数据" / "当前筛选无结果")

**Implementation**: `flexRender` for header and cells; one TableRow with colSpan and `emptyMessage` when `table.getRowModel().rows.length === 0`.

### DataTableColumnHeader

**Role**: Sortable column header: label + sort indicator; optional dropdown (Asc / Desc / Hide).

**Props**:

- `column`: `Column<TData, unknown>`
- `title`: string

**Behavior**: Click toggles sort; or use DropdownMenu with "升序" / "降序" / "取消排序". For server-side sort, sort key and direction go in URL; RSC applies to Prisma `orderBy`.

### DataTableSelectionBar

**Role**: Show when at least one row selected. Display "已选 N 项"; batch action buttons; "清空选择".

**Typical props**:

- `table`: `Table<TData>`
- `selectedCount`: number
- `onClearSelection`: () => void
- `onBatchDelete?: () => void`
- `onBatchDisable?: () => void`
- `onBatchEnable?: () => void`
- `canDelete?: boolean` (e.g. all selected are UNSOLD)
- `canDisable?: boolean`
- `canEnable?: boolean`

**Behavior**: Disable buttons when selection does not allow the action (e.g. 批量删除 only when all selected rows are UNSOLD). On confirm (e.g. AlertDialog for delete), call `POST /api/{resource}/batch`, then `router.refresh()` and clear selection.

### Row actions column

- **Trigger**: Button with icon (e.g. MoreHorizontal); wrap in DropdownMenu.
- **Items**: 查看 / 复制 / 停用|启用 / 删除. 删除 uses AlertDialog; others call API then `router.refresh()`.
- **Place**: Last column; `enableHiding: false` often.

### Empty state

- **No data at all**: e.g. "暂无数据"，CTA "新增".
- **Filtered no results**: e.g. "当前筛选无结果"，CTA "重置筛选".
- Reuse a single empty-state component with optional message and CTA.

### Loading skeleton

- `loading.tsx` in the route: skeleton that mirrors table structure (header row + N body rows). Reuse layout from existing admin loading (e.g. cards/loading.tsx) or a shared `DataTableSkeleton` component.

---

## C. Pagination block

### DataTablePagination

**Role**: Show total count, page size selector, and page navigation. **Server-side**: page and pageSize come from URL; RSC uses them for `skip`/`take` and returns `total`.

**Props**:

- `table`: `Table<TData>` (only used for selection count display)
- `total`: number (total row count from server)
- `pageSizeOptions?: number[]` (default: [10, 20, 30, 50, 100])

**Critical: URL as Single Source of Truth**

For server-side pagination, the component must read page/pageSize from URL directly, NOT from `table.getState().pagination`:

```tsx
// Inside DataTablePagination
const searchParams = useSearchParams();
const page = Math.max(1, parseInt(searchParams.get("page") ?? "", 10) || 1);
const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "", 10) || 20));
const pageCount = Math.max(1, Math.ceil(total / pageSize));
```

**URL Update Pattern**:

```tsx
const updateUrl = (newPage: number, newPageSize?: number) => {
    const params = new URLSearchParams(searchParams.toString());
    
    // Only set non-default values
    if (newPage > 1) {
        params.set("page", String(newPage));
    } else {
        params.delete("page");
    }
    
    if (newPageSize !== undefined && newPageSize !== 20) {
        params.set("pageSize", String(newPageSize));
    } else if (newPageSize === 20) {
        params.delete("pageSize");
    }
    
    router.push(params.toString() ? `?${params.toString()}` : "?");
};
```

**UI**:

- Left: "共 {total} 条记录" or "已选择 X / {total} 行" when rows selected
- Center: Select for page size; `onValueChange` calls `updateUrl(1, newSize)` (reset to page 1)
- Right: First / Prev / "第 X / Y 页" / Next / Last buttons; each `onClick` calls `updateUrl(targetPage)`

**Do NOT**:
- Use `table.setPageSize()` or `table.setPageIndex()` — these are for client-side pagination
- Read from `table.getState().pagination` — it won't reflect URL changes after navigation
- Pass `pagination` state to `useReactTable` — just set `manualPagination: true`

---

## D. ProTable → This stack (summary)

| ProTable | This project |
|----------|----------------|
| `request(params)` | RSC `page.tsx`: read searchParams → Prisma → pass `data`, `total`, `page`, `pageSize` to client |
| `columns` (valueType, valueEnum) | `ColumnDef[]` in `{resource}-columns.tsx`; valueEnum → Faceted Filter options; valueType → cell renderer (Badge, date format) |
| `toolBarRender` | `DataTableToolbar` |
| `tableAlertRender` / `tableAlertOptionRender` | `DataTableSelectionBar` |
| `rowSelection` | `rowSelection` in `useReactTable` + Checkbox column |
| `search` (form) | Toolbar search Input + Faceted Filters; params from URL |
| `pagination` (showSizeChanger, showTotal) | `DataTablePagination` + URL `page`, `pageSize` |
| `actionRef.reload()` | `router.refresh()` after mutation |
| ModalForm / DrawerForm | shadcn Dialog (or Sheet) + react-hook-form |
| Delete confirm | shadcn AlertDialog |

---

## E. Page file structure template

```
app/admin/(main)/{resource}/
  page.tsx                    # RSC: await searchParams → parseFilters → Prisma findMany + count → pass to client
  {resource}-data-table.tsx    # Client: useReactTable (manualPagination, manualFiltering) + Toolbar + SelectionBar + DataTable + Pagination
  {resource}-columns.tsx       # ColumnDef[] including select, data columns, actions
  {resource}-filters.ts        # parseFilters(raw), buildQuery(filters), DEFAULT_FILTERS
  loading.tsx                  # Skeleton table
```

**RSC page.tsx (concept)**  
Next 15+ (incl. 16): `searchParams` is a Promise — always await before use.

```ts
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const filters = parseFilters(params)
  const [data, total] = await Promise.all([
    prisma.resource.findMany({ where: buildWhere(filters), skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize, orderBy: buildOrderBy(filters) }),
    prisma.resource.count({ where: buildWhere(filters) })
  ])
  return (
    <>
      <PageHeader ... />
      <ResourceDataTable data={data} total={total} filters={filters} />
    </>
  )
}
```

**Client DataTable (concept)**:

```tsx
// useReactTable for server-side pagination — NO pagination state!
const table = useReactTable({
    data,
    columns,
    state: {
        columnFilters,
        columnVisibility,
        rowSelection,
        // ❌ Do NOT include pagination state for server-side pagination
    },
    enableRowSelection: true,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => row.id,
    manualPagination: true, // ✅ Server handles pagination
    // ❌ Do NOT set pageCount — pagination component reads from URL
});
```

Render: Toolbar (URL-derived filter state) → SelectionBar (if selected > 0) → DataTable → Pagination (reads page/pageSize from URL, updates URL on click).

---

## F. Batch API template

**Route**: `POST /api/{resource}/batch`

**Body (Zod)**:

```ts
z.object({
  action: z.enum(["DELETE", "DISABLE", "ENABLE"]),
  ids: z.array(z.string()).min(1).max(100)
})
```

**Response**:

```ts
{ success: number; skipped?: number; errors?: string[] }
```

**Logic**: Ensure admin auth. For each id, load record; if status allows the action (e.g. DELETE only for UNSOLD), perform it; else count as skipped. Return counts; optionally return `errors` for failed validations. Use transaction if multiple updates.

**Client**: SelectionBar calls this API with `ids: table.getSelectedRowModel().rows.map(r => r.original.id)`. On success, `router.refresh()` and clear selection (e.g. `table.resetRowSelection()`).
