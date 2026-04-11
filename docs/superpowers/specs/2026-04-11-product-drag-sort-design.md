# Product Drag-and-Drop Sort — Design Spec

**Date:** 2026-04-11
**Status:** Approved

## Summary

Replace the existing pin-based product ordering with drag-and-drop sorting in the admin product list. The sort order persists to the database and is reflected in the storefront.

## Decisions

- **Replaces pinnedAt:** `pinnedAt` field and pin/unpin actions are removed entirely. Drag order is the single source of truth.
- **Storefront sync:** The storefront default ordering follows `sortOrder ASC`.
- **Drag interaction:** Drag is only triggered via a GripVertical handle icon in the first column. Drag handles are hidden when search or status filters are active.
- **Library:** `@dnd-kit/core` + `@dnd-kit/sortable` (active maintenance, good a11y, works well with TanStack Table).

## Data Layer

### Schema changes (`prisma/schema.prisma`)

- Add `sortOrder Int @default(0)` to `Product` model.
- Add `@@index([sortOrder])`.
- Remove `pinnedAt DateTime?` from `Product` model.

### Manual SQL migration (run against Vercel Postgres)

```sql
-- 1. Add column
ALTER TABLE "Product" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- 2. Backfill: preserve existing order (pinnedAt DESC NULLS LAST, createdAt DESC)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    ORDER BY "pinnedAt" DESC NULLS LAST, "createdAt" DESC
  ) - 1 AS rn
  FROM "Product"
)
UPDATE "Product" p SET "sortOrder" = r.rn FROM ranked r WHERE p.id = r.id;

-- 3. Drop pinnedAt
ALTER TABLE "Product" DROP COLUMN "pinnedAt";

-- 4. Add index
CREATE INDEX "Product_sortOrder_idx" ON "Product"("sortOrder");
```

After running SQL: run `prisma generate` locally and deploy.

## API Layer

### New: `PATCH /api/admin/products/reorder`

- Admin only (requires `getAdminSession()`).
- Body: `{ ids: string[] }` — full ordered list of product IDs.
- Uses `prisma.$transaction` to batch-update `sortOrder` (each id gets its array index as value).

### Modified: `GET /api/products`

- Default sort: `sortOrder ASC` (was `pinnedAt DESC NULLS LAST, createdAt DESC`).
- `sort=newest` still uses `createdAt DESC`.
- `sort=price-asc` / `sort=price-desc` unchanged.

### Modified: `POST /api/products`

- On create: query `MAX(sortOrder)` first, set new product's `sortOrder = max + 1` (appends to end).

### Modified: `PUT /api/products/[productId]`

- Remove handling of `pinned` parameter.

## Frontend

### `products-columns.tsx`

- Add first column `id: "drag-handle"`: renders `GripVertical` icon, no header, not sortable.
- Remove `pinnedAt` from `ProductRow` type.
- Remove 「置顶」badge from name cell.

### `products-data-table.tsx`

- Install `@dnd-kit/core` and `@dnd-kit/sortable`.
- Wrap table with `DndContext` + `SortableContext` (items = row IDs in order).
- Use `restrictToVerticalAxis` modifier.
- Each row uses `useSortable`; drag handle column binds `listeners` and `attributes`.
- When any filter is active (search text or status filter), drag handles are hidden (`pointer-events-none opacity-0`).
- `onDragEnd`: optimistic local reorder → `PATCH /api/admin/products/reorder` → on failure: toast error + `router.refresh()` to revert.

### `product-row-actions.tsx`

- Remove `pinnedAt` prop, `isPinned` state, `pinLoading` state, `handleTogglePin` handler.
- Remove Pin/PinOff menu items and separator.

### `app/admin/(main)/products/page.tsx`

- Change `orderBy` from `[{ pinnedAt: ... }, { createdAt: ... }]` to `[{ sortOrder: "asc" }]`.
- Remove `pinnedAt` from `ProductRow` mapping.

## Error Handling

- Reorder API failure: toast error message, `router.refresh()` to restore server state.
- New product creation with DB error: existing error handling unchanged.

## Out of Scope

- Drag-and-drop sorting for other entities (Announcement, DistributorGuide already have `sortOrder` but no UI — separate feature).
- Mobile drag support (dnd-kit pointer sensor covers this automatically).
