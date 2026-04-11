# Purchase Limit Feature Design

**Date:** 2026-03-17
**Status:** Approved

## Overview

Add a configurable per-product purchase limit mechanism. When enabled, a user can only successfully purchase a product up to a configured number of times (default: 1). Identification uses a multi-factor strategy: email (independent signal) + fingerprint/IP (auxiliary signals requiring corroboration).

## Schema Changes

Add two fields to `Product`:

```prisma
purchaseLimitEnabled  Boolean @default(false)
purchaseLimitQuantity Int     @default(1)
```

No new tables required. Existing `Order` fields (`email`, `fingerprintHash`, `clientIp`) are used for identification.

## Check Logic

### `lib/purchase-limit.ts`

Export `checkPurchaseLimit(params)`:

```typescript
params: {
  productId: string
  email: string
  fingerprintHash: string | null
  clientIp: string
  limitQuantity: number
}
returns: {
  blocked: boolean
  orderNo?: string   // only populated when isOwnOrder is true
  message: string
}
```

**Algorithm:**

1. Build multi-factor OR condition (same as existing AUTO_FETCH logic):
   - Email: independent signal — always included
   - Fingerprint: auxiliary — included only when corroborated by email OR IP
   - IP: auxiliary — included only when corroborated by email OR fingerprint
2. Count `Order` records where `{ productId, status: "COMPLETED", OR: [signals] }`
3. If `count >= limitQuantity` → blocked
4. Expose `orderNo` only when the matched order's email equals the request email (prevent leaking other users' order numbers via fingerprint/IP collision)

**Error response:** HTTP 429, message: `"该商品限购 {n} 件，您已购买 {count} 件。"`

### Placement in Order Flow

`POST /api/orders` — after product is fetched and validated, before the NORMAL/AUTO_FETCH branch:

```typescript
if (product.purchaseLimitEnabled) {
  const result = await checkPurchaseLimit({ productId, email, fingerprintHash, clientIp, limitQuantity: product.purchaseLimitQuantity })
  if (result.blocked) {
    return NextResponse.json(
      { error: result.message, ...(result.orderNo ? { orderNo: result.orderNo } : {}) },
      { status: 429 }
    )
  }
}
```

### AUTO_FETCH Time-Window Check Removal

The existing time-window duplicate check inside `createAutoFetchOrder` is **deleted entirely**. Purchase limiting for AUTO_FETCH products is now handled exclusively via `purchaseLimitEnabled`.

| Product Type | purchaseLimitEnabled | Check Applied |
|---|---|---|
| NORMAL | false | none |
| NORMAL | true | permanent limit (count-based) |
| AUTO_FETCH | false | none |
| AUTO_FETCH | true | permanent limit (count-based) |

## Admin UI

In the product form, add a "限购设置" section:

- `purchaseLimitEnabled`: toggle switch
- `purchaseLimitQuantity`: integer input, `type="number"`, `min={1}`, `step={1}`, only visible when toggle is on; default 1

Style follows the existing `riskWarningEnabled` conditional field pattern.

## Files Changed

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `purchaseLimitEnabled`, `purchaseLimitQuantity` to `Product` |
| `lib/purchase-limit.ts` | New file — `checkPurchaseLimit` function |
| `lib/validations/product.ts` | Add fields to product schema |
| `app/api/orders/route.ts` | Insert purchase limit check; remove AUTO_FETCH time-window check |
| `app/admin/(main)/products/product-form.tsx` | Add 限购 UI section |

## Out of Scope

- No admin override / whitelist mechanism
- No per-user exemption
- No frontend hint that a product has purchase limits (until the user hits the error)
