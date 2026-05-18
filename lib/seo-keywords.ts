/**
 * SEO keyword pool — kept for internal content planning & report generation.
 * NOT emitted as <meta keywords> (Google ignored that tag since 2009).
 *
 * Title/description constants follow Google 2024+ Helpful Content guidance:
 * brand-led, concise, no comma-separated keyword stuffing.
 */

export type KeywordIntent = "transactional" | "navigational" | "informational" | "commercial"

export interface SeoKeywordItem {
  kw: string
  intent?: KeywordIntent
  trends_avg?: number | string
  trends_peak?: number | string
  note?: string
}

/** P0 — top organic queries from GSC + primary category anchor */
export const P0_CORE: SeoKeywordItem[] = [
  { kw: "苹果ID商城", intent: "transactional", note: "GSC #1 query, 25% CTR" },
  { kw: "苹果ID购买", intent: "transactional" },
  { kw: "Apple ID", intent: "navigational" },
  { kw: "海外Apple ID", intent: "transactional" },
  { kw: "临时苹果ID", intent: "transactional", note: "GSC 16 impressions, 0 CTR — landing page needed" },
]

/** P1 — region & brand co-occurrence */
export const P1_HIGH: SeoKeywordItem[] = [
  { kw: "美区Apple ID购买", intent: "transactional" },
  { kw: "港区Apple ID", intent: "transactional" },
  { kw: "日区Apple ID", intent: "transactional" },
  { kw: "苹果账号商城", intent: "navigational" },
  { kw: "苹果ID批发", intent: "transactional" },
]

/** P2 — share/dedicated & ecosystem */
export const P2_MEDIUM: SeoKeywordItem[] = [
  { kw: "独享Apple ID", intent: "transactional" },
  { kw: "共享Apple ID", intent: "informational" },
  { kw: "Shadowrocket账号", intent: "transactional" },
  { kw: "小火箭已购账号", intent: "transactional" },
  { kw: "iCloud账号", intent: "informational" },
  { kw: "App Store账号", intent: "informational" },
]

/** P3 — long tail / niche regions */
export const P3_LONGTAIL: SeoKeywordItem[] = [
  { kw: "台区苹果ID", intent: "transactional" },
  { kw: "韩区苹果ID", intent: "transactional" },
  { kw: "马来苹果ID", intent: "transactional" },
  { kw: "泰区苹果ID", intent: "transactional" },
  { kw: "英区苹果ID", intent: "transactional" },
  { kw: "免费苹果ID", intent: "informational" },
]

/** Seasonal hotspots — for content/announcement planning, not meta */
export const SEASONAL_HOTSPOTS = [
  "圣诞新年（12月）",
  "iPhone发布季（9月）",
  "春节（1-2月）",
]

/** Rising / related search themes — for landing page expansion */
export const RISING_ASSOCIATED = [
  "美区Apple ID购买",
  "Apple ID not active",
  "支付宝美区礼品卡",
]

/**
 * Default SEO title — brand-led, ≤30 Chinese chars to survive mobile SERP truncation.
 * Pattern: [primary keyword] | [secondary keyword] - [brand]
 */
export const DEFAULT_SEO_TITLE =
  "苹果ID商城 | 海外Apple ID购买 - 空域账号商城"

/**
 * Default SEO description — 70-90 Chinese chars, natural prose, primary keyword once.
 */
export const DEFAULT_SEO_DESCRIPTION =
  "空域账号商城是专注海外Apple ID购买的电商平台，覆盖美区、港区、日区、台区、韩区等地区的独享与共享苹果ID账号，支持已购小火箭Shadowrocket，下单后24小时自动发货，安全稳定。"

/**
 * Default site H1 — SEO-optimized, decoupled from siteTagline (which may be
 * overridden by env for marketing purposes).
 */
export const DEFAULT_SEO_H1 = "苹果ID商城 · 海外Apple ID一站购买"

/** Default sub-headline (paragraph under H1) */
export const DEFAULT_SEO_SUBTITLE =
  "美区/港区/日区/台区/韩区独享与共享Apple ID，已购小火箭Shadowrocket，24小时自动发货。"
