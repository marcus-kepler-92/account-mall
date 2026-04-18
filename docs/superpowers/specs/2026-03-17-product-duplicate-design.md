# Product Duplicate Feature — Design Spec

**Date:** 2026-03-17  
**Status:** Approved

## Overview

Add a "复制商品" action to the admin product list. Duplicating a product clones all its fields and tag associations into a new INACTIVE product, without copying cards. The user stays on the list page; the new product appears at the bottom after refresh.

## API

### `POST /api/products/[productId]/duplicate`

**File:** `app/api/products/[productId]/duplicate/route.ts`

**Auth:** `getSuperAdminSession()` — super admin only (same as product creation)

**Logic:**
1. Fetch original product including tags
2. Return 404 if product not found
3. Generate new name: `{original.name} 副本`
4. Generate new slug: try `{original.slug}-copy`, then `-copy-2`, `-copy-3`, ... until unique
5. Create new product with:
   - All fields copied from original (name, description, summary, image, price, maxQuantity, productType, sourceUrl, validityHours, allowAccountSwitch, accountSwitchLimit, riskWarning*, purchaseLimit*)
   - `status = INACTIVE`
   - `sortOrder` = current max + 1 (appended to end of list)
   - Tag associations copied via `connect`
   - Cards NOT copied

**Response:** `201 { id: string }`

**Error cases:**
- 401 if not super admin
- 404 if original product not found
- 500 on unexpected error

## UI

### `product-row-actions.tsx`

Add "复制商品" menu item:
- Position: after "复制链接" `DropdownMenuItem`, before the `DropdownMenuSeparator`
- Icon: `CopyPlus` (distinguishes from existing `Copy` icon used for link-copy)
- Behavior:
  - Click → call `POST /api/products/{productId}/duplicate`
  - Show inline loading state on the menu item (disable trigger button while loading)
  - On success: `toast.success("商品已复制")` + `router.refresh()`
  - On error: `toast.error(data?.error ?? "复制失败")`

## Naming Rules

| Field | Rule |
|-------|------|
| name | `{original} 副本` |
| slug | `{original}-copy`, then `{original}-copy-2`, `{original}-copy-3`, ... |
| status | Always `INACTIVE` |
| sortOrder | max existing + 1 |

## Out of Scope

- Cards are NOT duplicated
- No navigation to the new product's edit page (stay on list)
- No batch duplicate
