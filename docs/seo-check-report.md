# SEO 检查报告（代码级 + 运行时）

## 一、代码级检查结果（已通过）

### 1. 关键词与文案 `lib/seo-keywords.ts`
- **P0_CORE / P1_HIGH / P2_MEDIUM / P3_LONGTAIL** 分层结构完整，与需求一致。
- **KEYWORDS_META** 由 P0→P1→P2 推导，约 13 个词，逗号分隔。
- **DEFAULT_SEO_TITLE**：约 50 字，含「苹果ID购买」「美区Apple ID」「苹果账号购买」等 P0/P1，自然融入。
- **DEFAULT_SEO_DESCRIPTION**：约 155 字，含 P0/P1 与卖点（即买即用、自动发货、iCloud、App Store、苹果礼品卡）。

### 2. 全站默认与首页 `lib/config.ts` + `app/layout.tsx` + `app/page.tsx`
- **config 默认**：`siteDescription`、`siteTagline`、`siteSubtitle` 与「自然融入」文案一致。
- **根 layout**：`metadataBase`、`title.template`、`description`、`keywords`（来自 KEYWORDS_META）、OG/Twitter、**WebSite JSON-LD**（name/url/description）均已配置。
- **首页**：`metadata` 显式设置 `title`/`description`/`keywords`/`openGraph`/`canonical`，与 DEFAULT_SEO_* 一致。

### 3. 商品页 `app/products/[productIdSlug]/page.tsx`
- **generateMetadata**：`title`、`description`（约 160 字）、`canonical`、`openGraph`、`twitter`，含商品图时带 `images`。
- **Product JSON-LD**：`@type: Product`、name/description/url/image、`Offer`（price、priceCurrency、availability）。

### 4. Sitemap 与 Robots
- **sitemap.ts**：首页（priority 1）、`/orders/lookup`（priority 0.5）、所有 ACTIVE 商品（priority 0.8）。
- **robots.ts**：`allow: /`、`disallow: /admin/`、`sitemap: {base}/sitemap.xml`。

---

## 二、运行时检查（需本地或线上服务 + 数据库）

执行：

```bash
# 本地（先 npm run dev 或 npm run start，并确保数据库可用）
node scripts/check-seo.mjs

# 或指定线上地址
node scripts/check-seo.mjs https://你的域名.com
```

脚本会检查：
- 首页是否存在 `<title>`、meta description、meta keywords、WebSite JSON-LD，以及标题是否含 P0 词。
- `/sitemap.xml` 是否可访问且包含首页与 `/orders/lookup`。
- `/robots.txt` 是否包含 Allow /、Disallow /admin/、Sitemap。

---

## 三、建议人工/工具校验

1. **Google Rich Results Test**：用线上首页与商品页 URL 校验 WebSite / Product 结构化数据。
2. **Lighthouse（Chrome DevTools）**：对首页与商品页跑 SEO 审计。
3. **查看网页源代码**：确认首页 `<title>` 为「苹果ID购买 | 美区Apple ID、苹果账号购买 - 独享即买即用自动发货」等预期文案。

当前实现符合「Google SEO 白皮书 + Next.js 官方」与「自然融入」P0/P1 的设定；运行时检查需在服务与数据库可用时执行。
