# Domain Architecture Design

**Date:** 2026-04-16  
**Status:** Approved  
**Pilot domain:** `cards`

## Goal

Refactor the codebase from a flat `lib/` structure into self-contained domain modules. Each domain owns its types, validators, data access, and business logic. External consumers interact only through the domain's public `index.ts`.

This design is based on Feature-Sliced Design (FSD) principles adapted for a Next.js + Prisma server-side codebase, using a functional (not class-based) style.

---

## Directory Structure

```
lib/
├── domains/                    # All domain modules
│   ├── cards/                  # Pilot domain
│   │   ├── types.ts
│   │   ├── validators.ts
│   │   ├── repository.ts
│   │   ├── service.ts
│   │   ├── index.ts
│   │   └── __tests__/
│   │       ├── repository.test.ts
│   │       └── service.test.ts
│   ├── orders/
│   ├── products/
│   ├── payments/
│   ├── distributors/
│   └── ...
├── prisma.ts                   # Kept at lib/prisma.ts — not moved
├── auth.ts / auth-client.ts / auth-guard.ts
├── config.ts / config-client.ts
├── api-response.ts
└── ...                         # Existing files stay until their domain is migrated
```

`lib/prisma.ts` stays at its current path to avoid mass import changes. New shared utilities introduced after this design go into `lib/shared/`.

---

## Layer Definitions

### `types.ts` — Domain types, pure TypeScript

Derives from Prisma types and defines input/output contracts. No runtime dependencies.

```typescript
import type { Prisma } from "@prisma/client"

export type Card = Prisma.Card
export type CardStatus = "UNSOLD" | "SOLD" | "DISABLED"

export type CreateCardInput = { productId: string; code: string; password?: string }
export type CardFilter = { productId?: string; status?: CardStatus; page?: number }

// Domain errors
export class InsufficientStockError extends Error {
  constructor() { super("Insufficient card stock") }
}

export class CardAlreadySoldError extends Error {
  constructor(id: string) { super(`Card ${id} already sold`) }
}
```

Domain-specific error classes live in `types.ts`. Cross-domain base error classes may be placed in `lib/shared/errors.ts` if needed.

### `validators.ts` — Zod schemas

Responsible only for validating data shape. No business rules.

```typescript
import { z } from "zod"

export const createCardSchema = z.object({
  productId: z.string().min(1),
  code: z.string().min(1),
  password: z.string().optional(),
})

export const cardFilterSchema = z.object({
  productId: z.string().optional(),
  status: z.enum(["UNSOLD", "SOLD", "DISABLED"]).optional(),
  page: z.coerce.number().int().positive().default(1),
})
```

### `repository.ts` — Data access layer

All Prisma operations. No business logic, no "can this happen" decisions. Returns raw data.

Every write function accepts an optional `tx` parameter for transaction support:

```typescript
import { prisma } from "@/lib/prisma"
import type { PrismaClient } from "@prisma/client"

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

export async function findCardById(id: string, tx?: Tx): Promise<Card | null> {
  return (tx ?? prisma).card.findUnique({ where: { id } })
}

export async function findUnsoldCard(productId: string, tx?: Tx): Promise<Card | null> {
  return (tx ?? prisma).card.findFirst({
    where: { productId, status: "UNSOLD" },
  })
}

export async function updateCardStatus(id: string, status: CardStatus, tx?: Tx) {
  return (tx ?? prisma).card.update({ where: { id }, data: { status } })
}

export async function assignCardToOrder(cardId: string, orderId: string, tx?: Tx) {
  return (tx ?? prisma).card.update({ where: { id: cardId }, data: { orderId } })
}
```

### `service.ts` — Business logic layer

Enforces business rules, coordinates repository calls, handles domain errors. Imports from the domain's own `repository.ts` directly (within-domain imports are fine).

Multi-step writes must use `prisma.$transaction`. Bare sequential awaits for writes are forbidden.

```typescript
import { prisma } from "@/lib/prisma"
import { findUnsoldCard, updateCardStatus, assignCardToOrder } from "./repository"
import { InsufficientStockError } from "./types"

export async function allocateCard(orderId: string, productId: string): Promise<Card> {
  return prisma.$transaction(async (tx) => {
    const card = await findUnsoldCard(productId, tx)
    if (!card) throw new InsufficientStockError()
    await updateCardStatus(card.id, "SOLD", tx)
    await assignCardToOrder(card.id, orderId, tx)
    return card
  })
}
```

### `index.ts` — Public API (whitelist)

Only exports what external consumers are allowed to use. Repository functions are not exported.

```typescript
// Service functions
export { allocateCard, getCardsByProduct, createCards } from "./service"

// Validators (for use in API routes)
export { createCardSchema, cardFilterSchema } from "./validators"

// Types (for TypeScript consumers)
export type { Card, CardFilter, CreateCardInput } from "./types"

// Domain errors (for catch blocks in API routes)
export { InsufficientStockError, CardAlreadySoldError } from "./types"
```

---

## Cross-Domain Dependency Rules

**Principle:** The domain that owns the data owns the write operation.

| Operation | Belongs to | Reason |
|-----------|-----------|--------|
| `Card.status = SOLD` | cards | Card is a cards domain entity |
| `Card.orderId = X` | cards | Card table field |
| `Order.status = PAID` | orders | Order is an orders domain entity |

Cross-domain calls must go through `index.ts` only:

```typescript
// orders/service.ts — correct
import { allocateCard } from "@/lib/domains/cards"

// orders/service.ts — forbidden
import { findUnsoldCard } from "@/lib/domains/cards/repository"
```

Complex cross-domain orchestration (e.g., place order → allocate card → calculate commission) lives in the **calling domain's service**, not in a separate orchestration layer. Keep it flat.

---

## Transaction Pattern

All repository write functions accept an optional `tx` parameter typed as `Tx` (Prisma transaction client without lifecycle methods). Service functions that need atomicity call `prisma.$transaction` and pass `tx` through.

```typescript
// Correct — atomic
return prisma.$transaction(async (tx) => {
  await updateCardStatus(card.id, "SOLD", tx)
  await assignCardToOrder(card.id, orderId, tx)
})

// Forbidden — non-atomic sequential writes
await updateCardStatus(card.id, "SOLD")
await assignCardToOrder(card.id, orderId)
```

---

## Domain Error Handling

Domain errors are defined as classes in `types.ts` and exported via `index.ts`. API routes catch and map them to HTTP responses:

```typescript
// app/api/orders/route.ts
import { InsufficientStockError } from "@/lib/domains/cards"

try {
  await allocateCard(orderId, productId)
} catch (e) {
  if (e instanceof InsufficientStockError) return badRequest("库存不足")
  throw e
}
```

---

## API Route Standard Template

Route handlers follow a strict 4-step pattern and stay under ~20 lines. Zero business logic in route handlers.

```typescript
// app/api/cards/route.ts
import { NextRequest } from "next/server"
import { badRequest, unauthorized, validationError } from "@/lib/api-response"
import { getAdminSession } from "@/lib/auth-guard"
import { createCardSchema, createCards } from "@/lib/domains/cards"

export async function POST(req: NextRequest) {
  // 1. Auth
  const session = await getAdminSession()
  if (!session) return unauthorized()

  // 2. Parse + validate
  const body = await req.json()
  const result = createCardSchema.safeParse(body)
  if (!result.success) return validationError(result.error)

  // 3. Delegate to service
  const cards = await createCards(result.data)

  // 4. Return
  return Response.json({ cards })
}
```

---

## Testing Conventions

Tests are co-located within the domain module under `__tests__/`.

- **`repository.test.ts`**: Integration tests against a real (test) database or Prisma mock. Verifies queries return correct data.
- **`service.test.ts`**: Unit tests with repository functions mocked at the module level (`jest.mock("./repository")`). Verifies business rules, error throwing, and transaction coordination.

```typescript
// cards/__tests__/service.test.ts
jest.mock("../repository")
import { findUnsoldCard, updateCardStatus, assignCardToOrder } from "../repository"
import { allocateCard } from "../service"
import { InsufficientStockError } from "../types"

it("throws InsufficientStockError when no unsold card exists", async () => {
  (findUnsoldCard as jest.Mock).mockResolvedValue(null)
  await expect(allocateCard("order-1", "product-1")).rejects.toThrow(InsufficientStockError)
})
```

---

## Migration Strategy

1. **Pilot**: Implement the full `cards` domain module. Migrate `lib/validations/card.ts` and relevant logic from existing lib files.
2. **Validate**: Ensure all existing API routes under `app/api/cards/` and admin pages that touch cards work correctly with the new domain module.
3. **Template**: The `cards/` directory becomes the reference template for all subsequent domain migrations.
4. **Incremental**: Migrate one domain at a time. Existing flat `lib/` files remain until their domain is migrated. No big-bang rewrite.

**Out of scope for pilot:** Moving `lib/prisma.ts`, migrating `lib/shared/`, changing unrelated domains.

---

## Enforcement

Add the following to `CLAUDE.md` under a new **Domain Architecture** section:

- All new business logic goes into `lib/domains/{domain}/service.ts`
- All new Prisma queries go into `lib/domains/{domain}/repository.ts`
- External consumers import only from `lib/domains/{domain}/index.ts`
- Route handlers follow the 4-step template (auth → validate → service → return)
- Multi-step writes require `prisma.$transaction`
