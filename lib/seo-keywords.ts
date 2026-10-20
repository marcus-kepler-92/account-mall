/**
 * SEO keyword pool — kept for internal content planning & report generation.
 * NOT emitted as <meta keywords> (Google ignored that tag since 2009).
 *
 * Title/description constants follow Google 2024+ Helpful Content guidance:
 * brand-led, concise, no comma-separated keyword stuffing.
 *
 * Evidence (2026-10-21, raw data in docs/seo-evidence/):
 * - Google Keyword Planner, all locations / all languages, 2025-10..2026-09.
 *   The account has no ad spend, so volumes are coarse buckets ("1k–10k").
 * - Google autocomplete, hl=zh-CN/gl=cn and hl=zh-TW/gl=hk.
 * - Live SERPs for the purchase phrases are transactional: small shops' product
 *   pages titled "{地区}Apple ID购买 + 独享/可改密/自动发货".
 * - Search Console (16 months): only 208 impressions site-wide. "苹果ID商城"
 *   has 15 impressions / 3 clicks and KP puts it at 10–100/month — it is a
 *   minor query, not the site's anchor.
 *
 * Region wording: "美区" beats "美国" by an order of magnitude (KP 1k–10k vs
 * 100–1k); "台湾" beats "台区"; 港区/香港 and 日区/日本 are on par.
 */

export type KeywordIntent = "transactional" | "navigational" | "informational" | "commercial"

export interface SeoKeywordItem {
  kw: string
  intent?: KeywordIntent
  /** Where the phrase is targeted: "/" or a product slug. */
  page?: string
  /** Keyword Planner monthly searches bucket, all locations, 2025-10..2026-09. */
  kp?: string
  note?: string
}

/** P0 — homepage hub: generic purchase phrases */
export const P0_CORE: SeoKeywordItem[] = [
  { kw: "苹果ID购买", intent: "transactional", page: "/", kp: "1k–10k" },
  { kw: "Apple ID购买", intent: "transactional", page: "/", kp: "1k–10k" },
  { kw: "海外Apple ID", intent: "transactional", page: "/", kp: "100–1k" },
  { kw: "苹果账号购买", intent: "transactional", page: "/", kp: "100–1k" },
  { kw: "苹果ID商城", intent: "navigational", page: "/", kp: "10–100", note: "GSC 16mo: 15 impressions, 3 clicks" },
]

/** P1 — region purchase phrases, one product page each */
export const P1_REGION: SeoKeywordItem[] = [
  { kw: "美区Apple ID购买", intent: "transactional", page: "apple-id-us", kp: "1k–10k", note: "variants 美区apple id / 美区id / 美区id购买 / 美区苹果id all 1k–10k; 美国apple id only 100–1k" },
  { kw: "香港Apple ID购买", intent: "transactional", page: "apple-id-hongkong", kp: "100–1k", note: "港区apple id 100–1k" },
  { kw: "日本Apple ID购买", intent: "transactional", page: "apple-id-japan", kp: "10–100", note: "日区apple id / 日本苹果id 100–1k; the only region with GSC clicks" },
  { kw: "台湾Apple ID购买", intent: "transactional", page: "apple-id-taiwan", kp: "100–1k", note: "台湾apple id 100–1k vs 台区apple id 10–100" },
  { kw: "韩国Apple ID购买", intent: "transactional", page: "apple-id-korea", kp: "10–100" },
]

/** P2 — Shadowrocket, gift card, temporary/free; split by intent */
export const P2_PRODUCT: SeoKeywordItem[] = [
  { kw: "小火箭账号购买", intent: "transactional", page: "apple-id-shadowrocket-us", kp: "1k–10k", note: "小火箭账号 / shadowrocket账号 1k–10k; 已购小火箭id has no KP data" },
  { kw: "小火箭共享账号", intent: "transactional", page: "apple-id-shadowrocket", kp: "1k–10k", note: "SERP mixes free-share blogs" },
  { kw: "美区礼品卡购买", intent: "transactional", page: "apple-gift-card-us", kp: "100–1k", note: "SERP led by guides + SEAGM/Bitrefill" },
  { kw: "苹果临时ID", intent: "transactional", page: "temporary-apple-id-random-region", kp: "10–100", note: "GSC: 临时id 16 impr @9.4, 苹果临时id 2 clicks" },
  { kw: "免费Apple ID", intent: "informational", page: "apple-id-free", kp: "100–1k", note: "GSC: free page has the most product clicks" },
]

/** P3 — long tail regions sold but with little observed demand */
export const P3_LONGTAIL: SeoKeywordItem[] = [
  { kw: "泰国Apple ID购买", intent: "transactional", page: "apple-id-thailand" },
  { kw: "马来西亚Apple ID购买", intent: "transactional", page: "apple-id-malaysia", note: "GSC: 马来西亚苹果id共享 2 impr" },
  { kw: "英国Apple ID购买", intent: "transactional", page: "apple-id-england" },
]

/**
 * Informational demand seen in autocomplete that product pages should NOT
 * chase — candidates for future guide pages (one guide per question cluster).
 */
export const GUIDE_OPPORTUNITIES = [
  "美区Apple ID注册教程 / 怎么注册（KP 1k–10k, +900% YoY）",
  "美区Apple ID付款方式 / 绑定PayPal / 付款方式被拒绝",
  "美区Apple ID充值 / 礼品卡怎么用",
  "美区Apple ID订阅ChatGPT",
  "美区Apple ID被禁用 / 被锁定",
]

/** Seasonal hotspots — for content/announcement planning, not meta */
export const SEASONAL_HOTSPOTS = [
  "圣诞新年（12月）",
  "iPhone发布季（9月）",
  "春节（1-2月）",
]

/**
 * Default SEO title — leads with the highest-volume generic purchase phrase
 * (苹果ID购买, KP 1k–10k), qualified by the regions with the most demand.
 * "Apple ID商城" keeps the minor 苹果ID商城 query matched.
 */
export const DEFAULT_SEO_TITLE =
  "苹果ID购买 | 美区/港区/日区海外Apple ID商城 - 空域账号商城"

/**
 * Default SEO description — natural prose, every claim true of the catalog:
 * Apple IDs are auto-delivered; the gift card is manually fulfilled, so the
 * auto-delivery promise is scoped to Apple IDs.
 */
export const DEFAULT_SEO_DESCRIPTION =
  "空域账号商城提供海外Apple ID购买：美国、香港、日本、台湾、韩国等地区的独享与共享苹果ID，已购小火箭Shadowrocket账号，以及美国Apple礼品卡。Apple ID付款后自动发货，7×24小时自助下单。"

/**
 * Default site H1 — SEO-optimized, decoupled from siteTagline (which may be
 * overridden by env for marketing purposes).
 */
export const DEFAULT_SEO_H1 = "苹果ID购买 · 海外Apple ID商城"

/** Default sub-headline (paragraph under H1) */
export const DEFAULT_SEO_SUBTITLE =
  "美区/港区/日区/台区/韩区独享与共享Apple ID、已购小火箭Shadowrocket账号、美国Apple礼品卡，Apple ID付款后自动发货。"
