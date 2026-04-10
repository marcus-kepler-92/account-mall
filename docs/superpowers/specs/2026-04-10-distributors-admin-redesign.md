# Admin Distributors Page Redesign

**Date:** 2026-04-10
**Scope:** `app/admin/(main)/distributors/`

## Problem

12 columns, unabstracted info, no mobile responsiveness, missing GMV (销售额) column.

## Design

### Column Structure (12 → 7)

| Column | Content | Mobile | Tablet (sm) | Desktop (lg) |
|--------|---------|--------|-------------|--------------|
| 分销员 | name (bold) + email (muted) + status badge + promo code (mono) | ✅ | ✅ | ✅ |
| 团队 | inviter name + "下线 N 人" badge | ❌ | ✅ | ✅ |
| 销售额 | GMV large + "N 单" secondary line | ✅ | ✅ | ✅ |
| 佣金 | 累计佣金 with tooltip (l1/l2 breakdown) | ❌ | ✅ | ✅ |
| 余额 | 可提现余额 with tooltip (settled/paid/pending breakdown) | ❌ | ❌ | ✅ |
| 优惠码 | single badge: `已启用 · 8%` or `关闭` | ❌ | ❌ | ✅ |
| 操作 | ⋯ dropdown | ✅ | ✅ | ✅ |

Responsive via Tailwind: `hidden sm:table-cell`, `hidden lg:table-cell` on column header and cell.

### New Data: 销售额

Add `salesTotal: number` to `DistributorRow`. Query in `page.tsx`:

```ts
prisma.order.groupBy({
  by: ["distributorId"],
  where: { distributorId: { in: ids }, status: "COMPLETED" },
  _sum: { amount: true },
})
```

### Sorting

Add `salesTotal` to sortable fields alongside existing `createdAt` / `name`.

## Files Changed

| File | Change |
|------|--------|
| `page.tsx` | Add salesTotal groupBy query; add to DistributorRow map |
| `distributors-columns.tsx` | Rewrite all columns per above structure; add `salesTotal` to type |
| `distributor-row-actions.tsx` | No change |
| `distributors-data-table.tsx` | No change |

## Out of Scope

- Card layout (overkill for admin)
- Expandable rows / drawer detail view
- Pagination / filter changes
