/**
 * SEO 关键词：分层结构（P0–P3），对齐 Google SEO 与自然融入原则
 * seasonal_hotspots / rising_associated 供内容与运营规划，不直接写入 meta
 */

export type KeywordIntent = "transactional" | "navigational" | "informational" | "commercial"

export interface SeoKeywordItem {
  kw: string
  intent?: KeywordIntent
  trends_avg?: number | string
  trends_peak?: number | string
  note?: string
}

/** P0 核心词：最高优先级，自然融入 title/description 前部 */
export const P0_CORE: SeoKeywordItem[] = [
  { kw: "苹果id购买", intent: "transactional", trends_avg: 38, trends_peak: 100 },
  { kw: "Apple ID", intent: "navigational", trends_avg: 49, trends_peak: 100 },
  { kw: "苹果ID", intent: "navigational", trends_avg: 45, trends_peak: 100 },
]

/** P1 高优先级 */
export const P1_HIGH: SeoKeywordItem[] = [
  { kw: "美区id购买", intent: "transactional", trends_avg: 11, trends_peak: 78 },
  { kw: "美区apple id购买", intent: "transactional" },
  { kw: "美区苹果ID", intent: "transactional" },
  { kw: "苹果账号购买", intent: "transactional", trends_avg: 1, trends_peak: 52 },
]

/** P2 中优先级 */
export const P2_MEDIUM: SeoKeywordItem[] = [
  { kw: "苹果礼品卡", intent: "commercial" },
  { kw: "iCloud账号", intent: "informational" },
  { kw: "App Store账号", intent: "informational" },
  { kw: "独享苹果ID", intent: "transactional" },
  { kw: "即买即用苹果ID", intent: "transactional" },
  { kw: "自动发货苹果账号", intent: "transactional" },
]

/** P3 长尾 */
export const P3_LONGTAIL: SeoKeywordItem[] = [
  { kw: "日区苹果ID", intent: "transactional" },
  { kw: "港区苹果ID", intent: "transactional" },
  { kw: "苹果id批发", intent: "transactional", trends_avg: 1, note: "B2B低频" },
  { kw: "国外苹果ID", intent: "informational" },
]

/** 季节性热点：用于内容/公告规划，不写入 meta */
export const SEASONAL_HOTSPOTS = [
  "圣诞新年（12月）",
  "iPhone发布季（9月）",
  "春节（1-2月）",
]

/** 上升/关联词：用于内容与落地页规划 */
export const RISING_ASSOCIATED = [
  "美区 apple id 购买",
  "apple id not active",
  "支付宝 美区礼品卡",
]

/** 用于 meta keywords 的字符串：P0 → P1 → P2，约 12–18 个，逗号分隔 */
const META_KW_LIST = [
  ...P0_CORE.map((x) => x.kw),
  ...P1_HIGH.map((x) => x.kw),
  ...P2_MEDIUM.map((x) => x.kw),
].slice(0, 18)

export const KEYWORDS_META = META_KW_LIST.join(",")

/** 默认 SEO 标题（约 50–60 字，核心词靠前，自然融入 P0+P1） */
export const DEFAULT_SEO_TITLE =
  "苹果ID购买 | 美区Apple ID、苹果账号购买 - 独享即买即用自动发货"

/** 默认 SEO 描述（约 150–160 字，与页面内容一致，自然融入 P0/P1 与卖点） */
export const DEFAULT_SEO_DESCRIPTION =
  "提供苹果ID购买、美区Apple ID及苹果账号购买服务，独享账号可绑定邮箱，即买即用、自动发货。支持未开通/已激活 iCloud、App Store 账号与苹果礼品卡，安全可靠。"

// --- 兼容旧引用（若有）---
/** @deprecated 使用 P0_CORE / P1_HIGH / P2_MEDIUM 代替 */
export const TOP_KEYWORDS = [
  ...P0_CORE.map((x) => x.kw),
  ...P1_HIGH.map((x) => x.kw),
  "国外苹果ID",
  "苹果id批发",
  "独享",
  "即买即用",
  "自动发货",
  "iCloud账号",
  "App Store账号",
  "苹果礼品卡",
] as const

/** @deprecated 地区词可从商品/分类中派生 */
export const REGION_KEYWORDS = [
  "美区",
  "美国",
  "香港",
  "日本",
  "韩国",
  "台湾",
  "新加坡",
  "英国",
  "德国",
] as const
