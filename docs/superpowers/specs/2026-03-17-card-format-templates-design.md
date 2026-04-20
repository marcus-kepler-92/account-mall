# Card Format Templates Design

**Date:** 2026-03-17
**Scope:** NORMAL product type only

## Problem

A single product can have cards of different field structures (e.g., account+password only vs. account+password+security answers+birthday). Currently, NORMAL cards are displayed as raw text with no field labeling. Customers cannot distinguish which segment is the account, password, or security answer.

## Solution Overview

Allow admins to define named card format templates per product. Each template captures the delimiter and ordered field names. At display time, cards are matched to a format and rendered as labeled field rows. Customers never select a format — all cards in an order are displayed with whatever structure they have.

## Data Model

### New table: `ProductCardFormat`

```prisma
model ProductCardFormat {
  id        String   @id @default(cuid())
  productId String
  name      String               // display name, e.g. "带密保版" (admin-facing only)
  template  String               // e.g. "{账号}----{密码}----{密保朋友}----{生日}"
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([productId, sortOrder])
}
```

`Card.content` remains an opaque string — no schema changes to `Card`. Parsing is display-only.

`Product` gets a new relation: `cardFormats ProductCardFormat[]`.

## Template Syntax

A template is a string where `{field name}` marks each positional field. The characters between placeholders are the delimiter.

Example: `{账号}----{密码}----{密保朋友}----{工作答案}----{父母答案}----{生日}`

Parsed result:
- `delimiter`: `----`
- `fields`: `["账号", "密码", "密保朋友", "工作答案", "父母答案", "生日"]`

Parser: extract all `{...}` names in order; delimiter = the substring between the first two placeholders.

## Card Matching Logic

At display time, given a card `content` and the product's `cardFormats[]`:

1. **Try each format** in `sortOrder` order:
   - Split `content` by `format.delimiter`
   - If `parts.length === format.fields.length` → match found → render as labeled rows
2. **No format matched** → fall through to `parseByLabel` heuristic (existing `lib/auto-fetch-card.ts`)
   - Handles self-labeled content like `账号xxx@a.com----密码123----密保答案朋友答案abc`
   - If successful → render with detected labels
3. **Heuristic also fails** → render as plain text (existing behavior)

**Ambiguity rule:** If two formats have the same delimiter and same field count, the one with lower `sortOrder` wins.

## Admin UI

### Where

Product settings page (`/admin/products/[productId]`) — new "卡密格式" section, placed below the main form and above the danger zone. **Hidden entirely when `productType === AUTO_FETCH`.**

### Format list

A bordered list showing each format:
- Name, template string (truncated), field count badge
- Edit / Delete actions per row
- "添加格式" button in the section header

### Add / Edit dialog

Fields:
- **格式名称** (text) — admin-facing label, not shown to customers
- **格式模板** (text, monospace) — template string, e.g. `{账号}----{密码}----{密保朋友}`
- **Live preview** — parsed delimiter + numbered field badges, updates as user types

Validation: template must contain at least two `{...}` placeholders and a non-empty delimiter between them.

## Customer Display (Order Success Page)

**Parsing happens server-side** in the RSC page. The server resolves card content → `{ label: string; value: string }[]` pairs before passing to the client component. Raw card content is never sent to the client.

A new shared utility `resolveCardFields(content, formats)` encapsulates the three-tier matching logic and returns:
```ts
type ResolvedCard =
  | { type: "formatted"; fields: { label: string; value: string }[] }
  | { type: "plain"; content: string }
```

For the `parseByLabel` heuristic path, the existing `LABEL_PREFIXES` map in `lib/auto-fetch-card.ts` (which maps prefix strings like `"密保答案朋友答案"` → internal key `securityAnswerFriend`) is used in reverse to produce display labels. The original prefix string becomes the display label (e.g., field `securityAnswerFriend` detected via prefix `"朋友答案"` → label `"朋友答案"`).

Each card in the order is rendered as an independent bordered card:

- **Header row**: card index (№1, №2…) + "复制" button (copies the card's formatted text)
- **Field rows**: one row per field — label on left, monospace value + inline copy button on right
- **Plain text fallback**: single row with the raw content and a copy button

**"一键复制全部"** button at the top copies all cards as:

```
账号：user@example.com
密码：pass1234

账号：abc@qq.com
密码：mypassword
密保朋友：朋友答案abc
工作答案：工作xyz
父母答案：父母def
生日：1990-01-01
```

Each card separated by a blank line; each field as `label：value`.

## Degradation

| Condition | Behavior |
|-----------|----------|
| `productType === AUTO_FETCH` | Format section hidden; cards always parsed as JSON via existing `parseAutoFetchCardContent` |
| NORMAL, formats configured, card matches | Labeled field rows per format definition |
| NORMAL, formats configured, no match | Fall through to heuristic → labeled or plain text |
| NORMAL, no formats configured | Heuristic (`parseByLabel`) first, then plain text |

No breaking change to existing card display — cards that previously showed as plain text continue to do so unless a matching format or recognizable label pattern exists.

## API

### Format CRUD

```
GET    /api/products/[productId]/card-formats        → list formats (sorted by sortOrder)
POST   /api/products/[productId]/card-formats        → create format
PATCH  /api/products/[productId]/card-formats/[id]   → update format
DELETE /api/products/[productId]/card-formats/[id]   → delete format
```

All admin-only. Request/response shapes follow existing API conventions.

Order success page fetches formats alongside the order (server-side, in the RSC page):

```ts
prisma.product.findUnique({
  where: { id: order.productId },
  include: { cardFormats: { orderBy: { sortOrder: "asc" } } }
})
```

The RSC page calls `resolveCardFields` for each card and passes `ResolvedCard[]` to the client component — no raw card content on the client.

## Out of Scope

- Format selection by customers at purchase time
- Per-card format override (format is derived, never stored on `Card`)
- Format reuse across products (formats are product-scoped)
- Import UI changes (existing bulk import flow unchanged)
