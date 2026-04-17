# SEO Keywords & Content Design — 2026-04-17

## Problem

The platform's title, description, and homepage copy are identical to at least two competitors
running the same codebase. Google treats this as near-duplicate content and suppresses rankings
for both. Additionally, the highest-intent keyword category in this market — Shadowrocket (小火箭)
— is completely absent from all on-page text.

`<meta name="keywords">` is explicitly ignored by Google (since 2009). All keyword changes must
land in visible page content (title, description, H1, H2) to affect rankings.

## Scope: Method A (1 session)

Two files, five string constants. No new routes, no new components.

## Target Values

### `lib/seo-keywords.ts`

**`DEFAULT_SEO_TITLE`** (~41 chars, core keyword first, differentiators added):
```
苹果ID购买 | 小火箭/成品号·美区港区台区Apple ID·独享可改密自动发货
```
Differentiators vs competitors: 小火箭, 成品号, 台区, 可改密

**`DEFAULT_SEO_DESCRIPTION`** (~150 chars):
```
提供苹果ID购买服务，支持美区/港区/台区/韩区独享成品号，手工注册账号可改密可绑定邮箱。已购小火箭Shadowrocket账号即买即用，已激活iCloud账号支持全功能，24小时自动发货，一号一密独享安全稳定。
```
New terms woven in: 台区, 韩区, 成品号, 手工注册, 可改密, 小火箭, Shadowrocket, 已激活iCloud

### `lib/config.ts` (default values only — env var overrides these in production)

**`siteTagline`** (H1 on homepage):
```
苹果ID购买，小火箭成品号即买即发
```

**`siteSubtitle`** (sub-headline on homepage):
```
美区/港区/台区/韩区独享成品号，手工注册可改密，支持已购小火箭Shadowrocket账号，24小时自动发货。
```

**`siteDescription`** (global metadata fallback for pages without specific descriptions):
```
提供苹果ID购买服务，支持美区/港区/台区/韩区独享成品号，手工注册可改密可绑定邮箱。已购小火箭Shadowrocket账号即买即用，已激活iCloud账号支持全功能，24小时自动发货，一号一密独享安全稳定。
```

## What Does NOT Change

- `KEYWORDS_META` / `P0_CORE` / `P1_HIGH` etc. — Google ignores `<meta name="keywords">`;
  expanding this list has zero SEO value and is not part of scope.
- Product page JSON-LD — already fully implemented (Product + Offer + ShippingDetails +
  MerchantReturnPolicy). No changes needed.
- `robots.ts` / `sitemap.ts` — already correct.

## Validation Source

All new terms (小火箭, 成品号, 台区, 韩区, 手工注册, 可改密, 已激活iCloud) were confirmed
present in titles, H1s, or meta keywords of top-ranking competitors:
- pgid.cn — title includes 小火箭Shadowrocket, 成品号, meta keywords include 台湾/韩服
- meiquappleid.com — title includes shadowrocket账号购买
- pinguoid.com — H2 sections for 台湾/韩国 regions
- guowaiid.com — product categories include 已开通iCloud, 手动注册

Google SEO guidance confirmed at developers.google.com/search/docs/fundamentals/seo-starter-guide:
title and description matter; meta keywords are explicitly documented as unused.
